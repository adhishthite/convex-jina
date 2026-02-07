import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import { action } from "./_generated/server.js";

const READER_URL = "https://r.jina.ai/";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 1000;

export const read = action({
	args: {
		url: v.string(),
		apiKey: v.string(),
		contentFormat: v.optional(v.string()),
		options: v.optional(
			v.object({
				noCache: v.optional(v.boolean()),
				targetSelector: v.optional(v.string()),
				removeSelector: v.optional(v.string()),
				waitForSelector: v.optional(v.string()),
				withLinksSummary: v.optional(v.boolean()),
				withImagesSummary: v.optional(v.boolean()),
				timeout: v.optional(v.number()),
				tokenBudget: v.optional(v.number()),
				engine: v.optional(v.string()),
				useReaderLM: v.optional(v.boolean()),
				retainImages: v.optional(v.boolean()),
			}),
		),
		cacheTtlMs: v.optional(v.number()),
		userId: v.optional(v.string()),
	},
	returns: v.object({
		cacheId: v.id("readerCache"),
		status: v.string(),
		cached: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const format = args.contentFormat ?? "markdown";
		const ttl = args.cacheTtlMs ?? DEFAULT_TTL_MS;

		// Check cache first (unless noCache is set)
		if (!args.options?.noCache) {
			const cached: any = await ctx.runQuery(internal.cache.getReaderCache, {
				url: args.url,
				contentFormat: format,
			});
			if (cached && cached.status === "completed" && cached.expiresAt > Date.now()) {
				return { cacheId: cached._id, status: "completed", cached: true };
			}
		}

		// Create pending cache entry
		const cacheId: any = await ctx.runMutation(internal.cache.createReaderEntry, {
			url: args.url,
			contentFormat: format,
			expiresAt: Date.now() + ttl,
		});

		// Call Jina Reader API with retry logic
		try {
			const headers: Record<string, string> = {
				Authorization: `Bearer ${args.apiKey}`,
				"Content-Type": "application/json",
				Accept: "application/json",
			};

			// Add optional headers based on options
			if (args.options?.targetSelector) {
				headers["X-Target-Selector"] = args.options.targetSelector;
			}
			if (args.options?.removeSelector) {
				headers["X-Remove-Selector"] = args.options.removeSelector;
			}
			if (args.options?.waitForSelector) {
				headers["X-Wait-For-Selector"] = args.options.waitForSelector;
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
			if (args.options?.tokenBudget) {
				headers["X-Token-Budget"] = String(args.options.tokenBudget);
			}
			if (args.options?.engine) {
				headers["X-Engine"] = args.options.engine;
			}
			if (args.options?.useReaderLM) {
				headers["X-Respond-With"] = "readerlm-v2";
			}
			if (args.options?.retainImages === false) {
				headers["X-Retain-Images"] = "none";
			}
			if (format !== "markdown") {
				headers["X-Return-Format"] = format;
			}

			const result = await fetchWithRetry(READER_URL, {
				method: "POST",
				headers,
				body: JSON.stringify({ url: args.url }),
			});

			const tokensUsed = result.data?.usage?.tokens ?? 0;

			// Update cache with result
			await ctx.runMutation(internal.cache.completeReaderEntry, {
				cacheId,
				title: result.data?.title,
				description: result.data?.description,
				content: result.data?.content ?? "",
				images: result.data?.images,
				links: result.data?.links,
				tokensUsed,
			});

			// Track usage
			await ctx.runMutation(internal.usage.track, {
				operation: "read",
				tokensUsed,
				url: args.url,
				userId: args.userId,
			});

			return { cacheId, status: "completed", cached: false };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			await ctx.runMutation(internal.cache.failReaderEntry, {
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
				lastError = new Error(`Jina Reader API error: ${response.status} ${response.statusText}`);
				if (attempt < retries - 1) {
					const delay = BASE_RETRY_DELAY_MS * 2 ** attempt;
					await new Promise((resolve) => setTimeout(resolve, delay));
					continue;
				}
			}

			// Non-retryable error
			const errorBody = await response.text().catch(() => "");
			throw new Error(
				`Jina Reader API error: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`,
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

	throw lastError ?? new Error("Jina Reader API request failed after retries");
}
