import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import FirecrawlApp from '@mendable/firecrawl-js';
import type { Handler } from 'aws-lambda';

const s3 = new S3Client({});

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_KEY ?? '',
  apiUrl: process.env.FIRECRAWL_BASE_URL,
});

type ScrapeFormat = 'markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot';

type ScrapeEvent = {
  // the web document URL to read
  url: string;
  bucket?: string;
  key?: string;
  // Firecrawl output format to store, defaults to markdown
  format?: ScrapeFormat;
  onlyMainContent?: boolean;
  timeout?: number;
};

function log(...args: unknown[]) {
  console.log(...args);
}

function extensionFor(format: ScrapeFormat) {
  switch (format) {
    case 'html':
    case 'rawHtml':
      return 'html';
    case 'links':
      return 'json';
    case 'screenshot':
      return 'png';
    default:
      return 'md';
  }
}

function contentTypeFor(format: ScrapeFormat) {
  switch (format) {
    case 'html':
    case 'rawHtml':
      return 'text/html';
    case 'links':
      return 'application/json';
    case 'screenshot':
      return 'text/plain';
    default:
      return 'text/markdown';
  }
}

// AWS Lambda entry point: reads a single document from the web using
// Firecrawl and stores the scraped content in an S3 bucket.
export const handler: Handler<ScrapeEvent> = async event => {
  const {
    url,
    format = 'markdown',
    onlyMainContent = true,
    timeout = 30_000,
    bucket = process.env.S3_BUCKET,
    key,
  } = event;

  if (!url) {
    throw new Error('"url" is required in the Lambda event payload');
  }
  if (!bucket) {
    throw new Error(
      '"bucket" must be provided in the event or via the S3_BUCKET env var',
    );
  }

  log(`Scraping document: ${url}`);
  const result = await firecrawl.scrapeUrl(url, {
    formats: [format],
    onlyMainContent,
    timeout,
  });

  if (!result.success) {
    throw new Error(`Firecrawl failed to scrape ${url}: ${result.error}`);
  }

  const content =
    format === 'links'
      ? JSON.stringify(result.links ?? [], null, 2)
      : (result[format] ?? '');

  if (!content) {
    throw new Error(`Firecrawl returned no "${format}" content for ${url}`);
  }

  const objectKey = key ?? `scrapes/${Date.now()}-${extensionFor(format)}.${extensionFor(format)}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: content,
      ContentType: contentTypeFor(format),
      Metadata: { 'source-url': url },
    }),
  );
  log(`Uploaded scraped document to s3://${bucket}/${objectKey}`);

  return {
    bucket,
    key: objectKey,
    url,
    title: result.metadata?.title,
  };
};
