"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import {
	JinaApiError,
	type SearchJsonResponse,
	type SearchOptions,
	type SearchResult,
	type SearchResultItem,
} from "./types";

const JINA_SEARCH_BASE_URL = "https://s.jina.ai";
const DEFAULT_TIMEOUT = 30000;
const DEFAULT_COUNT = 5;
const MAX_COUNT = 10;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build the Jina Search URL with query.
 */
function buildSearchUrl(query: string): string {
	const encodedQuery = encodeURIComponent(query);
	return `${JINA_SEARCH_BASE_URL}/${encodedQuery}`;
}

/**
 * Build headers for the Jina Search API request.
 */
function buildHeaders(
	apiKey: string,
	options: Partial<SearchOptions>,
): Record<string, string> {
	const headers: Record<string, string> = {
		Authorization: `Bearer ${apiKey}`,
	};

	if (options.json) {
		headers.Accept = "application/json";
	}

	if (options.headers) {
		Object.assign(headers, options.headers);
	}

	return headers;
}

/**
 * Parse markdown search results into structured format.
 */
function parseMarkdownResults(content: string): SearchResultItem[] {
	const results: SearchResultItem[] = [];
	const sections = content.split(/\n---\n|\n\n(?=\[\d+\])/);

	for (const section of sections) {
		const trimmed = section.trim();
		if (!trimmed) continue;

		// Extract title and URL from markdown link pattern
		const titleUrlMatch = trimmed.match(/\[([^\]]+)\]\(([^)]+)\)/);
		if (!titleUrlMatch) continue;

		const title = titleUrlMatch[1] ?? "";
		const url = titleUrlMatch[2] ?? "";

		// Extract description - text after the title/url line
		const lines = trimmed.split("\n");
		const descriptionLines = lines.slice(1).filter((line) => line.trim());
		const description = descriptionLines.join(" ").trim();

		results.push({
			title,
			url,
			description,
			content: trimmed,
		});
	}

	return results;
}

/**
 * Parse the Jina Search API response.
 */
function parseResponse(
	response: string | SearchJsonResponse,
	isJson: boolean,
	count: number,
): SearchResult {
	if (isJson && typeof response === "object") {
		const jsonResponse = response as SearchJsonResponse;
		const results = jsonResponse.data.slice(0, count);
		return {
			results,
			count: results.length,
		};
	}

	// For markdown response
	const content = String(response);
	const parsedResults = parseMarkdownResults(content);

	return {
		results: parsedResults.slice(0, count),
		count: Math.min(parsedResults.length, count),
	};
}

/**
 * Fetch search results from Jina Search API with retry logic.
 */
async function fetchWithRetry(
	url: string,
	headers: Record<string, string>,
	timeout: number,
	retries: number = MAX_RETRIES,
): Promise<Response> {
	let lastError: Error | null = null;

	for (let attempt = 0; attempt < retries; attempt++) {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeout);

			const response = await fetch(url, {
				method: "GET",
				headers,
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			// Handle rate limiting
			if (response.status === 429) {
				const retryAfter = response.headers.get("Retry-After");
				const waitTime = retryAfter
					? Number.parseInt(retryAfter, 10) * 1000
					: RETRY_DELAY_MS * (attempt + 1);

				if (attempt < retries - 1) {
					await sleep(waitTime);
					continue;
				}
				throw new JinaApiError(
					"Rate limit exceeded. Please try again later.",
					"RATE_LIMIT_EXCEEDED",
					429,
				);
			}

			// Handle server errors with retry
			if (response.status >= 500 && attempt < retries - 1) {
				await sleep(RETRY_DELAY_MS * (attempt + 1));
				continue;
			}

			if (!response.ok) {
				const errorText = await response.text();
				throw new JinaApiError(
					`Jina Search API error: ${errorText}`,
					"API_ERROR",
					response.status,
				);
			}

			return response;
		} catch (error) {
			lastError = error as Error;

			if (error instanceof JinaApiError) {
				throw error;
			}

			if (
				error instanceof Error &&
				error.name === "AbortError" &&
				attempt < retries - 1
			) {
				await sleep(RETRY_DELAY_MS * (attempt + 1));
				continue;
			}

			if (attempt === retries - 1) {
				throw new JinaApiError(
					`Request failed after ${retries} attempts: ${lastError?.message}`,
					"REQUEST_FAILED",
				);
			}
		}
	}

	throw new JinaApiError(
		`Request failed after ${retries} attempts`,
		"REQUEST_FAILED",
	);
}

/**
 * Jina Search action - performs web search and returns structured results.
 *
 * @param query - The search query
 * @param json - Return JSON instead of markdown (default: false)
 * @param count - Number of results to return (default: 5, max: 10)
 *
 * @returns SearchResult with results array and count
 */
export const search = action({
	args: {
		query: v.string(),
		json: v.optional(v.boolean()),
		count: v.optional(v.number()),
	},
	returns: v.object({
		results: v.union(
			v.array(
				v.object({
					title: v.string(),
					description: v.string(),
					url: v.string(),
					content: v.string(),
				}),
			),
			v.string(),
		),
		count: v.number(),
	}),
	handler: async (_ctx, args): Promise<SearchResult> => {
		const apiKey = process.env.JINA_API_KEY;
		if (!apiKey) {
			throw new JinaApiError(
				"JINA_API_KEY environment variable is not set",
				"MISSING_API_KEY",
			);
		}

		const count = Math.min(args.count ?? DEFAULT_COUNT, MAX_COUNT);
		const options: Partial<SearchOptions> = {
			json: args.json,
			count,
		};

		const requestUrl = buildSearchUrl(args.query);
		const headers = buildHeaders(apiKey, options);

		const response = await fetchWithRetry(requestUrl, headers, DEFAULT_TIMEOUT);

		const isJson = args.json ?? false;
		const responseData: string | SearchJsonResponse = isJson
			? ((await response.json()) as SearchJsonResponse)
			: await response.text();

		return parseResponse(responseData, isJson, count);
	},
});
