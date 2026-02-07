// React hooks for convex-jina component.
// These are thin wrappers that make it easy to use Jina queries in React components.
//
// Usage:
//   import { useQuery } from "convex/react";
//   import { api } from "../convex/_generated/api";
//
//   // In your component:
//   const content = useQuery(api.jina.getReaderContent, { cacheId });
//   const results = useQuery(api.jina.getSearchResults, { cacheId });
//   const usage = useQuery(api.jina.getUsage, {});
//
// Since Convex React hooks already work reactively with component queries,
// no additional wrapper hooks are needed. Use `useQuery` and `useAction` from
// "convex/react" directly with the exposed API functions.

export {};
