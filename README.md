# Convex Jina AI Component

[![npm version](https://img.shields.io/npm/v/convex-jina)](https://www.npmjs.com/package/convex-jina)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Read any URL as clean markdown and search the web - with durable caching
and reactive queries, powered by [Jina AI](https://jina.ai).

```ts
const jina = new JinaAI(components.jina);

// Read a URL
const { cacheId } = await jina.read(ctx, { url: "https://example.com" });
const content = await jina.getReaderContent(ctx, { cacheId });

// Search the web
const result = await jina.search(ctx, { query: "convex database" });
const results = await jina.getSearchResults(ctx, { cacheId: result.cacheId });
```

## Key Features

- **URL Reader** - Convert any URL to clean markdown, HTML, or text
- **Web Search** - Structured search results optimized for LLMs
- **Durable Caching** - Configurable TTL, reactive cache status via Convex queries
- **Usage Tracking** - Monitor token consumption per user and operation
- **CSS Selectors** - Target or exclude specific page elements
- **ReaderLM v2** - Optional high-quality HTML-to-Markdown conversion
- **Retry Logic** - Automatic retries with exponential backoff for rate limits and server errors

## Installation

```bash
bun add convex-jina convex
```

## Quick Start

### 1. Add the component to your Convex app

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import jina from "convex-jina/convex.config";

const app = defineApp();
app.use(jina);
export default app;
```

### 2. Configure your Jina API key

Get a free API key from [jina.ai](https://jina.ai/api) (1M tokens/month free tier).

You can provide the key via environment variable (server-side):

```bash
npx convex env set JINA_API_KEY your_api_key_here
```

Or pass it explicitly per request (useful for user-provided keys):

```ts
const jina = new JinaAI(components.jina, {
  JINA_API_KEY: userProvidedKey,
});
```

### 3. Use the client in your Convex functions

```ts
// convex/myFunctions.ts
import { JinaAI } from "convex-jina";
import { components } from "./_generated/server";
import { action, query } from "./_generated/server";
import { v } from "convex/values";

const jina = new JinaAI(components.jina);

export const readUrl = action({
  args: { url: v.string() },
  handler: async (ctx, { url }) => {
    return await jina.read(ctx, { url });
  },
});

export const getContent = query({
  args: { cacheId: v.string() },
  handler: async (ctx, { cacheId }) => {
    return await jina.getReaderContent(ctx, { cacheId });
  },
});
```

## Configuration

### JinaAI Constructor

```ts
const jina = new JinaAI(components.jina, {
  // Explicitly pass API key (default: reads from process.env.JINA_API_KEY)
  JINA_API_KEY: process.env.JINA_API_KEY,

  // Default cache TTL in milliseconds (default: 24 hours)
  defaultCacheTtlMs: 12 * 60 * 60 * 1000, // 12 hours
});
```

## API Reference

### Reader API

#### `jina.read(ctx, args)`

Read a URL and convert its content to clean markdown.

```ts
const { cacheId, status, cached } = await jina.read(ctx, {
  url: "https://example.com",

  // Content format: "markdown" (default), "html", or "text"
  contentFormat: "markdown",

  // Cache TTL in ms (overrides default)
  cacheTtlMs: 60 * 60 * 1000, // 1 hour

  // Optional user ID for usage tracking
  userId: "user_123",

  // Advanced options
  options: {
    noCache: false,              // Skip cache, always fetch fresh
    targetSelector: "article",   // CSS selector to target
    removeSelector: ".ads",      // CSS selector to remove
    waitForSelector: ".content", // Wait for element to appear
    withLinksSummary: true,      // Include links summary
    withImagesSummary: true,     // Include images summary
    timeout: 30000,              // Request timeout in ms
    tokenBudget: 5000,           // Max tokens to return
    engine: "browser",           // Rendering engine
    useReaderLM: true,           // Use ReaderLM v2 for better extraction
    retainImages: false,         // Strip images from output
  },
});
```

**Returns:**
- `cacheId` - ID for reactive cache lookup
- `status` - `"completed"` or `"failed"`
- `cached` - `true` if result was served from cache

#### `jina.getReaderContent(ctx, { cacheId })`

Get cached reader content. Reactive - updates when the read completes.

```ts
const content = await jina.getReaderContent(ctx, { cacheId });
// content.title, content.description, content.content, content.tokensUsed, content.status
```

### Search API

#### `jina.search(ctx, args)`

Search the web and get structured results.

```ts
const { cacheId, status, cached } = await jina.search(ctx, {
  query: "convex database tutorials",

  // Optional filters
  site: "docs.convex.dev",  // Restrict to domain
  country: "US",            // Country code
  language: "en",           // Language code
  numResults: 5,            // Max results
  page: 0,                  // Pagination offset

  // Cache TTL in ms
  cacheTtlMs: 60 * 60 * 1000,

  // Optional user ID
  userId: "user_123",

  // Advanced options
  options: {
    noCache: false,
    withLinksSummary: true,
    withImagesSummary: true,
    timeout: 30000,
    engine: "browser",
  },
});
```

#### `jina.getSearchResults(ctx, { cacheId })`

Get cached search results. Reactive - updates when the search completes.

```ts
const data = await jina.getSearchResults(ctx, { cacheId });
// data.results - array of { title, description, url, content, tokensUsed }
// data.totalTokensUsed, data.status
```

### Cache Management

#### `jina.invalidateReader(ctx, { url })`

Remove cached reader content for a URL. Returns the number of entries removed.

```ts
const removed = await jina.invalidateReader(ctx, { url: "https://example.com" });
```

#### `jina.invalidateSearch(ctx, { query })`

Remove cached search results for a query. Returns the number of entries removed.

```ts
const removed = await jina.invalidateSearch(ctx, { query: "old search" });
```

### Usage Tracking

#### `jina.getUsage(ctx, args?)`

Get usage statistics.

```ts
// All usage
const usage = await jina.getUsage(ctx);

// Usage for a specific user since a timestamp
const usage = await jina.getUsage(ctx, {
  userId: "user_123",
  since: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
});

// usage.totalTokens, usage.readTokens, usage.searchTokens, usage.operationCount
```

## Integration Examples

### With @convex-dev/rag

```ts
import { JinaAI } from "convex-jina";
import { RAG } from "@convex-dev/rag";

const jina = new JinaAI(components.jina);
const rag = new RAG(components.rag);

export const indexUrl = action({
  args: { url: v.string() },
  handler: async (ctx, { url }) => {
    // Read the URL
    const { cacheId } = await jina.read(ctx, { url });
    const content = await jina.getReaderContent(ctx, { cacheId });

    // Index the content for RAG
    if (content && content.status === "completed") {
      await rag.add(ctx, {
        namespace: "docs",
        text: content.content,
        key: content.url,
      });
    }
  },
});
```

### With @convex-dev/agent as a Tool

```ts
import { JinaAI } from "convex-jina";

const jina = new JinaAI(components.jina);

// Define a search tool for your agent
const searchTool = {
  description: "Search the web for information",
  parameters: { query: { type: "string" } },
  execute: async (ctx, { query }) => {
    const { cacheId } = await jina.search(ctx, { query });
    const data = await jina.getSearchResults(ctx, { cacheId });
    if (!data) return "No results found.";
    return data.results
      .map((r) => `## ${r.title}\n${r.url}\n${r.content}`)
      .join("\n\n");
  },
};
```

## Security

- API keys are never stored in the component database
- Keys flow through action arguments at runtime only
- The component sandbox cannot access `process.env`
- All external API calls use HTTPS

## Development

```bash
# Install dependencies
bun install

# Run dev server (Convex backend + Vite frontend)
bun run dev

# Build the component
bun run build

# Type check
bun run typecheck

# Format and lint
bun run check

# Run tests
bun run test
```

## Demo App

Try the live demo: [convex-jina-demo.vercel.app](https://convex-jina-demo.vercel.app)

You will need your own Jina AI API key to use the demo. Get one for free at [jina.ai/api](https://jina.ai/api) (1M tokens/month on the free tier). The key is entered in the browser and stored in localStorage - it is never saved on the server.

The `example/` directory contains the demo source with:
- API Key input with localStorage persistence
- URL Reader - input a URL, see extracted markdown
- Web Search - search the web, see structured results
- Usage Dashboard - monitor token consumption

To run locally:
```bash
bun install
bun run dev
```

Then open `http://localhost:5173` and enter your Jina API key in the UI.

## License

Apache-2.0
