import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import { action } from "./_generated/server.js";

const SEARCH_URL = "https://s.jina.ai/";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;

export const search = action({
	args: {
		query: v.string(),
		apiKey: v.string(),
		site: v.optional(v.string()),
		country: v.optional(v.string()),
		language: v.optional(v.string()),
		numResults: v.optional(v.number()),
		page: v.optional(v.number()),
		options: v.optional(
			v.object({
				noCache: v.optional(v.boolean()),
				withLinksSummary: v.optional(v.boolean()),
				withImagesSummary: v.optional(v.boolean()),
				timeout: v.optional(v.number()),
				engine: v.optional(v.string()),
			}),
		),
		cacheTtlMs: v.optional(v.number()),
		userId: v.optional(v.string()),
	},
	returns: v.object({
		cacheId: v.id("searchCache"),
		status: v.string(),
		cached: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const ttl = args.cacheTtlMs ?? DEFAULT_TTL_MS;

		// Check cache first (unless noCache is set)
		if (!args.options?.noCache) {
			const cached: any = await ctx.runQuery(internal.cache.getSearchCache, {
				query: args.query,
				site: args.site,
			});
			if (cached && cached.status === "completed" && cached.expiresAt > Date.now()) {
				return { cacheId: cached._id, status: "completed", cached: true };
			}
		}

		// Create pending cache entry
		const cacheId: any = await ctx.runMutation(internal.cache.createSearchEntry, {
			query: args.query,
			site: args.site,
			expiresAt: Date.now() + ttl,
		});

		// Call Jina Search API with retry logic
		try {
			const headers: Record<string, string> = {
				Authorization: `Bearer ${args.apiKey}`,
				"Content-Type": "application/json",
				Accept: "application/json",
			};

			// Add optional headers
			if (args.site) {
				headers["X-Site"] = args.site;
			}
			if (args.options?.withLinksSummary) {
				headers["X-With-Links-Summary"] = "true";
			}
			if (args.options?.withImagesSummary) {
				headers["X-With-Images-Summary"] = "true";
			}
			if (args.options?.timeout) {
				headers["X-Timeout"] = String(args.options.timeout);
			}
			if (args.options?.engine) {
				headers["X-Engine"] = args.options.engine;
			}

			const body: Record<string, any> = { q: args.query };
			if (args.country) body.gl = args.country;
			if (args.language) body.hl = args.language;
			if (args.numResults) body.num = args.numResults;
			if (args.page !== undefined) body.page = args.page;

			const result = await fetchWithRetry(SEARCH_URL, {
				method: "POST",
				headers,
				body: JSON.stringify(body),
			});

			const data = Array.isArray(result.data) ? result.data : [];
			let totalTokensUsed = 0;
			const results = data.map((item: any) => {
				const tokens = item.usage?.tokens ?? 0;
				totalTokensUsed += tokens;
				return {
					title: item.title ?? "",
					description: item.description ?? "",
					url: item.url ?? "",
					content: item.content ?? "",
					tokensUsed: tokens,
				};
			});

			// Update cache with results
			await ctx.runMutation(internal.cache.completeSearchEntry, {
				cacheId,
				results,
				totalTokensUsed,
			});

			// Track usage
			await ctx.runMutation(internal.usage.track, {
				operation: "search",
				tokensUsed: totalTokensUsed,
				query: args.query,
				userId: args.userId,
			});

			return { cacheId, status: "completed", cached: false };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			await ctx.runMutation(internal.cache.failSearchEntry, {
				cacheId,
				error: errorMessage,
			});
			return { cacheId, status: "failed", cached: false };
		}
	},
});

async function fetchWithRetry(url: string, init: RequestInit, retries = MAX_RETRIES): Promise<any> {
	let lastError: Error | undefined;

	for (let attempt = 0; attempt < retries; attempt++) {
		try {
			const response = await fetch(url, init);

			if (response.ok) {
				return await response.json();
			}

			// Retry on rate limit or server errors
			if (response.status === 429 || response.status >= 500) {
				lastError = new Error(`Jina Search API error: ${response.status} ${response.statusText}`);
				if (attempt < retries - 1) {
					const delay = BASE_RETRY_DELAY_MS * 2 ** attempt;
					await new Promise((resolve) => setTimeout(resolve, delay));
					continue;
				}
			}

			// Non-retryable error
			const errorBody = await response.text().catch(() => "");
			throw new Error(
				`Jina Search API error: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`,
			);
		} catch (error) {
			if (error instanceof TypeError && error.message.includes("fetch")) {
				lastError = error;
				if (attempt < retries - 1) {
					const delay = BASE_RETRY_DELAY_MS * 2 ** attempt;
					await new Promise((resolve) => setTimeout(resolve, delay));
					continue;
				}
			}
			throw error;
		}
	}

	throw lastError ?? new Error("Jina Search API request failed after retries");
}
