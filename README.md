# @anthropic/convex-jina

A Convex component for integrating Jina AI's Reader and Search APIs into your Convex application.

## Features

- **Jina Reader**: Fetch clean markdown content from any URL via `r.jina.ai`
- **Jina Search**: Web search returning structured results via `s.jina.ai`
- Automatic retry logic with exponential backoff
- Rate limit handling
- TypeScript support with full type definitions

## Installation

```bash
bun add @anthropic/convex-jina
```

Or with npm:

```bash
npm install @anthropic/convex-jina
```

## Setup

### 1. Configure the component in your Convex app

Create or update your `convex/convex.config.ts`:

```typescript
import { defineApp } from "convex/server";
import jina from "@anthropic/convex-jina/convex.config";

const app = defineApp();
app.use(jina);

export default app;
```

### 2. Set your Jina API key

Add your Jina API key as an environment variable in your Convex dashboard or `.env.local`:

```bash
JINA_API_KEY=your_jina_api_key_here
```

Get your API key from [https://jina.ai/api](https://jina.ai/api)

## Usage

### Jina Reader - Fetch content from URLs

```typescript
"use node";

import { action } from "./_generated/server";
import { components } from "./_generated/api";
import { v } from "convex/values";

export const fetchArticle = action({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    // Fetch as markdown (default)
    const result = await ctx.runAction(components.jina.reader.read, {
      url: args.url,
    });

    return {
      title: result.title,
      content: result.content,
    };
  },
});
```

#### Reader options

```typescript
const result = await ctx.runAction(components.jina.reader.read, {
  url: "https://example.com/article",
  json: true,                          // Return structured JSON instead of markdown
  includeLinks: true,                  // Include extracted links (default: true)
  includeImages: true,                 // Include extracted images (default: true)
  targetSelector: "article.main",      // Extract content from specific CSS selector
  waitForSelector: ".content-loaded",  // Wait for selector before extraction
  timeout: 30000,                      // Request timeout in ms (default: 30000)
});
```

#### Reader response

```typescript
interface ReaderResult {
  content: string;                     // Extracted content (markdown or text)
  title: string;                       // Page title
  description: string;                 // Page meta description
  url: string;                         // Final URL after redirects
  links?: Record<string, string>;      // Extracted links (if json=true)
  images?: Record<string, string>;     // Extracted images (if json=true)
  tokens?: number;                     // Token count (if available)
}
```

### Jina Search - Web search

```typescript
"use node";

import { action } from "./_generated/server";
import { components } from "./_generated/api";
import { v } from "convex/values";

export const searchWeb = action({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const result = await ctx.runAction(components.jina.search.search, {
      query: args.query,
      json: true,
      count: 5,
    });

    return result.results;
  },
});
```

#### Search options

```typescript
const result = await ctx.runAction(components.jina.search.search, {
  query: "convex database",
  json: true,                          // Return structured JSON (recommended)
  count: 5,                            // Number of results (default: 5, max: 10)
});
```

#### Search response

```typescript
interface SearchResult {
  results: SearchResultItem[] | string;  // Array if json=true, markdown string otherwise
  count: number;                         // Number of results returned
}

interface SearchResultItem {
  title: string;
  description: string;
  url: string;
  content: string;
}
```

## Error Handling

The component throws `JinaApiError` for API-related errors:

```typescript
import { JinaApiError } from "@anthropic/convex-jina";

try {
  const result = await ctx.runAction(components.jina.reader.read, {
    url: "https://example.com",
  });
} catch (error) {
  if (error instanceof JinaApiError) {
    console.error(`Jina API error: ${error.code} - ${error.message}`);
    // error.code: "MISSING_API_KEY" | "RATE_LIMIT_EXCEEDED" | "API_ERROR" | "REQUEST_FAILED"
    // error.statusCode: HTTP status code (if applicable)
  }
}
```

## Rate Limiting

The component automatically handles rate limiting:

- Respects `Retry-After` headers from Jina API
- Implements exponential backoff for retries
- Maximum 3 retry attempts for transient failures

## Development

```bash
# Install dependencies
bun install

# Run type checking
bun run typecheck

# Format and lint
bun run check

# Build
bun run build
```

## Example App

See the `example/` directory for a complete example Convex app demonstrating the component usage.

```bash
cd example
bun install
bun run dev
```

## License

MIT
