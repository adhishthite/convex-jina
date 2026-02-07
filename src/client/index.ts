/**
 * Client-side exports for the Jina AI Convex Component.
 *
 * This module provides TypeScript types and utilities for working with
 * the Jina AI component from host applications.
 */

import type { FunctionReference } from "convex/server";

// Re-export types from component
export type {
	JinaError,
	ReaderJsonResponse,
	ReaderOptions,
	ReaderResult,
	SearchJsonResponse,
	SearchOptions,
	SearchResult,
	SearchResultItem,
} from "../component/types";

export { JinaApiError } from "../component/types";

/**
 * Type definitions for the Jina component API.
 */
export interface JinaComponentApi {
	reader: {
		read: FunctionReference<
			"action",
			"public",
			{
				url: string;
				json?: boolean;
				includeLinks?: boolean;
				includeImages?: boolean;
				targetSelector?: string;
				waitForSelector?: string;
				timeout?: number;
			},
			{
				content: string;
				title: string;
				description: string;
				url: string;
				links?: Record<string, string>;
				images?: Record<string, string>;
				tokens?: number;
			}
		>;
	};
	search: {
		search: FunctionReference<
			"action",
			"public",
			{
				query: string;
				json?: boolean;
				count?: number;
			},
			{
				results:
					| Array<{
							title: string;
							description: string;
							url: string;
							content: string;
					  }>
					| string;
				count: number;
			}
		>;
	};
}

/**
 * Helper function to create typed references to Jina component actions.
 *
 * @example
 * ```typescript
 * import { api } from "./_generated/api";
 * import { createJinaClient } from "@adhishthite/convex-jina";
 *
 * // In your Convex function
 * const jina = createJinaClient(components.jina);
 * const result = await ctx.runAction(jina.reader.read, { url: "https://example.com" });
 * ```
 */
export function createJinaClient<T extends JinaComponentApi>(
	component: T,
): JinaComponentApi {
	return component;
}

/**
 * Utility type to extract the result type from a reader action.
 */
export type ReaderActionResult = {
	content: string;
	title: string;
	description: string;
	url: string;
	links?: Record<string, string>;
	images?: Record<string, string>;
	tokens?: number;
};

/**
 * Utility type to extract the result type from a search action.
 */
export type SearchActionResult = {
	results:
		| Array<{
				title: string;
				description: string;
				url: string;
				content: string;
		  }>
		| string;
	count: number;
};
