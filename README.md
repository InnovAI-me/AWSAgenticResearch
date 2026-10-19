# Firecrawl S3 Lambda

An AWS Lambda function that reads a single web document using [Firecrawl](https://firecrawl.dev) and stores the scraped content in an S3 bucket.

## How it works

1. The Lambda receives an event containing a `url` (and optional S3/format options).
2. It calls Firecrawl's `scrapeUrl` API to fetch the page in the requested format (markdown, html, rawHtml, links, or screenshot).
3. The resulting content is uploaded to S3 with the source URL recorded as object metadata.

## Requirements

- Node.js 22.x
- A [Firecrawl API key](https://firecrawl.dev)
- An AWS account with an S3 bucket and a Lambda execution role granted `s3:PutObject` on that bucket

## Setup

```bash
npm install
cp .env.example .env.local   # fill in FIRECRAWL_KEY and S3_BUCKET
```

### Local invocation

```bash
npm run invoke:local -- "https://example.com/some-article"
```

This requires valid AWS credentials in your environment (e.g. via `aws configure` or environment variables) so the AWS SDK can call S3.

### Build for deployment

```bash
npm run build
```

This bundles the handler into `dist/index.js` (CommonJS, Node 22 target) ready to zip and upload, or to point a Lambda function at via `index.handler`.

### Deploying

1. Build the bundle: `npm run build`
2. Zip `dist/index.js` (e.g. `cd dist && zip -r ../function.zip .`)
3. Create or update a Lambda function:
   - Runtime: Node.js 22.x
   - Handler: `index.handler`
   - Environment variables: `FIRECRAWL_KEY`, optionally `FIRECRAWL_BASE_URL`, and `S3_BUCKET`
   - Execution role permissions: `s3:PutObject` on the target bucket
4. Invoke with a test event:

```json
{
  "url": "https://example.com/some-article",
  "format": "markdown",
  "bucket": "my-bucket",
  "key": "scrapes/some-article.md"
}
```

## Event payload reference

| Field             | Required | Default                              | Description                                                        |
| ------------------ | -------- | ------------------------------------- | -------------------------------------------------------------------- |
| `url`              | yes      | –                                      | The web document to scrape                                          |
| `bucket`           | no       | `S3_BUCKET` env var                   | Destination S3 bucket                                                |
| `key`              | no       | `scrapes/<timestamp>.<ext>`           | Destination S3 object key                                            |
| `format`           | no       | `markdown`                            | One of `markdown`, `html`, `rawHtml`, `links`, `screenshot`          |
| `onlyMainContent`  | no       | `true`                                 | Passed through to Firecrawl to strip nav/ads/boilerplate             |
| `timeout`          | no       | `30000`                                | Firecrawl scrape timeout in milliseconds                              |

## License

MIT
