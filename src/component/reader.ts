"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import {
	JinaApiError,
	type ReaderJsonResponse,
	type ReaderOptions,
	type ReaderResult,
} from "./types";

const JINA_READER_BASE_URL = "https://r.jina.ai";
const DEFAULT_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build the Jina Reader URL with options.
 */
function buildReaderUrl(url: string, _options: Partial<ReaderOptions>): string {
	const encodedUrl = encodeURIComponent(url);
	return `${JINA_READER_BASE_URL}/${encodedUrl}`;
}

/**
 * Build headers for the Jina Reader API request.
 */
function buildHeaders(
	apiKey: string,
	options: Partial<ReaderOptions>,
): Record<string, string> {
	const headers: Record<string, string> = {
		Authorization: `Bearer ${apiKey}`,
	};

	if (options.json) {
		headers.Accept = "application/json";
	}

	if (options.targetSelector) {
		headers["X-Target-Selector"] = options.targetSelector;
	}

	if (options.waitForSelector) {
		headers["X-Wait-For-Selector"] = options.waitForSelector;
	}

	if (options.includeLinks === false) {
		headers["X-With-Links-Summary"] = "false";
	}

	if (options.includeImages === false) {
		headers["X-With-Images-Summary"] = "false";
	}

	if (options.headers) {
		Object.assign(headers, options.headers);
	}

	return headers;
}

/**
 * Parse the Jina Reader API response.
 */
function parseResponse(
	response: string | ReaderJsonResponse,
	isJson: boolean,
	url: string,
): ReaderResult {
	if (isJson && typeof response === "object") {
		const jsonResponse = response as ReaderJsonResponse;
		return {
			content: jsonResponse.data.content,
			title: jsonResponse.data.title,
			description: jsonResponse.data.description,
			url: jsonResponse.data.url,
			links: jsonResponse.data.links,
			images: jsonResponse.data.images,
			tokens: jsonResponse.data.usage?.tokens,
		};
	}

	// For markdown response, extract title from first line if present
	const content = String(response);
	const lines = content.split("\n");
	let title = "";
	const description = "";

	// Try to extract title from markdown heading
	const titleMatch = lines[0]?.match(/^#\s+(.+)$/);
	if (titleMatch) {
		title = titleMatch[1] ?? "";
	}

	return {
		content,
		title,
		description,
		url,
	};
}

/**
 * Fetch content from a URL using Jina Reader API with retry logic.
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
					`Jina Reader API error: ${errorText}`,
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
 * Jina Reader action - fetches clean markdown content from any URL.
 *
 * @param url - The URL to fetch content from
 * @param json - Return JSON instead of markdown (default: false)
 * @param includeLinks - Include links in the output (default: true)
 * @param includeImages - Include images in the output (default: true)
 * @param targetSelector - CSS selector to extract specific content
 * @param waitForSelector - Wait for this selector before extraction
 * @param timeout - Request timeout in milliseconds (default: 30000)
 *
 * @returns ReaderResult with content, title, description, and URL
 */
export const read = action({
	args: {
		url: v.string(),
		json: v.optional(v.boolean()),
		includeLinks: v.optional(v.boolean()),
		includeImages: v.optional(v.boolean()),
		targetSelector: v.optional(v.string()),
		waitForSelector: v.optional(v.string()),
		timeout: v.optional(v.number()),
	},
	returns: v.object({
		content: v.string(),
		title: v.string(),
		description: v.string(),
		url: v.string(),
		links: v.optional(v.record(v.string(), v.string())),
		images: v.optional(v.record(v.string(), v.string())),
		tokens: v.optional(v.number()),
	}),
	handler: async (_ctx, args): Promise<ReaderResult> => {
		const apiKey = process.env.JINA_API_KEY;
		if (!apiKey) {
			throw new JinaApiError(
				"JINA_API_KEY environment variable is not set",
				"MISSING_API_KEY",
			);
		}

		const options: Partial<ReaderOptions> = {
			json: args.json,
			includeLinks: args.includeLinks,
			includeImages: args.includeImages,
			targetSelector: args.targetSelector,
			waitForSelector: args.waitForSelector,
			timeout: args.timeout,
		};

		const requestUrl = buildReaderUrl(args.url, options);
		const headers = buildHeaders(apiKey, options);
		const timeout = args.timeout ?? DEFAULT_TIMEOUT;

		const response = await fetchWithRetry(requestUrl, headers, timeout);

		const isJson = args.json ?? false;
		const responseData: string | ReaderJsonResponse = isJson
			? ((await response.json()) as ReaderJsonResponse)
			: await response.text();

		return parseResponse(responseData, isJson, args.url);
	},
});
