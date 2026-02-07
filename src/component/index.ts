/**
 * Jina AI Convex Component
 *
 * This component provides actions for interacting with Jina AI's Reader and Search APIs:
 * - Reader: Fetch clean markdown content from any URL
 * - Search: Web search returning structured results
 */

// Re-export actions
export { read } from "./reader";
export { search } from "./search";

// Re-export types
export type {
	JinaError,
	ReaderJsonResponse,
	ReaderOptions,
	ReaderResult,
	SearchJsonResponse,
	SearchOptions,
	SearchResult,
	SearchResultItem,
} from "./types";

export { JinaApiError } from "./types";
