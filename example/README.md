# Convex Jina Example

Example Convex application demonstrating the `@anthropic/convex-jina` component.

## Setup

1. Install dependencies:

```bash
bun install
```

2. Create a `.env.local` file with your Jina API key:

```bash
cp .env.example .env.local
# Edit .env.local and add your JINA_API_KEY
```

3. Start Convex development server:

```bash
bun run dev
```

## Actions

This example provides three actions:

### `readUrl`

Fetch and extract content from any URL:

```typescript
const result = await ctx.runAction(api.actions.readUrl, {
  url: "https://example.com/article",
  json: true, // optional
});
```

### `searchWeb`

Perform web searches:

```typescript
const result = await ctx.runAction(api.actions.searchWeb, {
  query: "convex database",
  count: 5, // optional
});
```

### `readWithSelector`

Extract specific content using CSS selectors:

```typescript
const result = await ctx.runAction(api.actions.readWithSelector, {
  url: "https://example.com",
  targetSelector: "article.main",
});
```

## Testing

You can test the actions using the Convex dashboard or CLI:

```bash
npx convex run actions:readUrl '{"url": "https://example.com"}'
npx convex run actions:searchWeb '{"query": "convex database"}'
```
