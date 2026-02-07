# CLAUDE.md — Convex Jina AI Component

## Project Context
Building a **Convex Component** wrapping Jina AI's Reader and Search APIs for the **Convex Components Authoring Challenge** (Third-Party Sync category).

This must be **production-ready, professionally built, and submission-quality**.

## Critical Rules — NEVER Violate
- **TypeScript only** — never plain JavaScript
- **Bun** as package manager — never npm/npx/yarn/pnpm
- **Biome** for linting/formatting — never ESLint/Prettier
- **NEVER commit secrets** — all API keys via environment variables
- **NEVER use `@anthropic` namespace** — package name is `convex-jina`
- **Follow Convex component conventions EXACTLY** — study the official template

## Convex Component Conventions
- Start from `npx create-convex@latest --component` template structure
- `src/component/` — isolated sandboxed code (cannot access process.env)
- `src/client/` — runs in app context (CAN access process.env)
- `src/react/` — React hooks (optional but recommended)
- `example/` — working demo app
- `convex.json` points to `example/convex`
- All public functions MUST have argument AND return validators
- Component cannot access `ctx.auth` — pass userId explicitly
- API keys flow: process.env → client class → action args → component
- Use class-based client pattern (like @convex-dev/agent, @convex-dev/rag)
- Package exports must follow canonical pattern (see plan)

## Jina AI APIs
- **Reader**: POST https://r.jina.ai/ with `{ "url": "..." }` — returns clean markdown
- **Search**: POST https://s.jina.ai/ with `{ "q": "..." }` — returns structured results
- Both use `Authorization: Bearer {JINA_API_KEY}` and `Accept: application/json`
- Both return token usage in response

## Architecture Decisions
- 3 schema tables: `readerCache`, `searchCache`, `usage`
- Class-based `JinaAI` client + `exposeApi()` helper
- Built-in caching with configurable TTL
- Usage tracking per operation
- Retry logic with exponential backoff
- Support both read and search in one component (dual API = differentiator)

## Package Details
- **Name**: `convex-jina` (npm)
- **License**: Apache-2.0
- **GitHub**: github.com/adhishthite/convex-jina

## Quality Standards
- Every function has proper validators (args + returns)
- Comprehensive error handling
- Clean, documented types exported
- README with usage examples, API reference
- Tests with vitest + convex-test
- CI-ready (typecheck, lint, test)

## Learnings & Mistakes Log
(Update this as you work — track what went wrong and what was corrected)

- Session 1: Starting fresh from official template
