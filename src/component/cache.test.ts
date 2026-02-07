import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api.js";
import schema from "./schema.js";

const modules = import.meta.glob("./**/*.ts");

// --- Reader Cache ---

describe("cache - reader", () => {
	describe("createReaderEntry", () => {
		it("creates entry with pending status and correct fields", async () => {
			const t = convexTest(schema, modules);
			const now = Date.now();
			const expiresAt = now + 86400000;

			const cacheId = await t.mutation(internal.cache.createReaderEntry, {
				url: "https://example.com",
				contentFormat: "markdown",
				expiresAt,
			});

			expect(cacheId).toBeDefined();

			const entry = await t.run(async (ctx) => {
				return await ctx.db.get(cacheId);
			});

			expect(entry).not.toBeNull();
			expect(entry!.url).toBe("https://example.com");
			expect(entry!.contentFormat).toBe("markdown");
			expect(entry!.status).toBe("pending");
			expect(entry!.content).toBe("");
			expect(entry!.tokensUsed).toBe(0);
			expect(entry!.expiresAt).toBe(expiresAt);
			expect(entry!.fetchedAt).toBeGreaterThanOrEqual(now);
		});

		it("creates entry with html content format", async () => {
			const t = convexTest(schema, modules);

			const cacheId = await t.mutation(internal.cache.createReaderEntry, {
				url: "https://example.com/page",
				contentFormat: "html",
				expiresAt: Date.now() + 3600000,
			});

			const entry = await t.run(async (ctx) => {
				return await ctx.db.get(cacheId);
			});

			expect(entry!.contentFormat).toBe("html");
		});
	});

	describe("completeReaderEntry", () => {
		it("updates entry to completed with all fields", async () => {
			const t = convexTest(schema, modules);

			const cacheId = await t.mutation(internal.cache.createReaderEntry, {
				url: "https://example.com",
				contentFormat: "markdown",
				expiresAt: Date.now() + 86400000,
			});

			await t.mutation(internal.cache.completeReaderEntry, {
				cacheId,
				title: "Example Page",
				description: "A description",
				content: "# Hello World",
				images: { img1: "https://example.com/image.png" },
				links: { link1: "https://example.com/link" },
				tokensUsed: 150,
			});

			const entry = await t.run(async (ctx) => {
				return await ctx.db.get(cacheId);
			});

			expect(entry!.status).toBe("completed");
			expect(entry!.title).toBe("Example Page");
			expect(entry!.description).toBe("A description");
			expect(entry!.content).toBe("# Hello World");
			expect(entry!.images).toEqual({ img1: "https://example.com/image.png" });
			expect(entry!.links).toEqual({ link1: "https://example.com/link" });
			expect(entry!.tokensUsed).toBe(150);
		});

		it("updates entry with optional fields omitted", async () => {
			const t = convexTest(schema, modules);

			const cacheId = await t.mutation(internal.cache.createReaderEntry, {
				url: "https://example.com",
				contentFormat: "markdown",
				expiresAt: Date.now() + 86400000,
			});

			await t.mutation(internal.cache.completeReaderEntry, {
				cacheId,
				content: "Content only",
				tokensUsed: 50,
			});

			const entry = await t.run(async (ctx) => {
				return await ctx.db.get(cacheId);
			});

			expect(entry!.status).toBe("completed");
			expect(entry!.content).toBe("Content only");
			expect(entry!.title).toBeUndefined();
			expect(entry!.description).toBeUndefined();
		});
	});

	describe("failReaderEntry", () => {
		it("updates entry to failed with error message", async () => {
			const t = convexTest(schema, modules);

			const cacheId = await t.mutation(internal.cache.createReaderEntry, {
				url: "https://example.com",
				contentFormat: "markdown",
				expiresAt: Date.now() + 86400000,
			});

			await t.mutation(internal.cache.failReaderEntry, {
				cacheId,
				error: "API returned 500",
			});

			const entry = await t.run(async (ctx) => {
				return await ctx.db.get(cacheId);
			});

			expect(entry!.status).toBe("failed");
			expect(entry!.error).toBe("API returned 500");
		});
	});

	describe("getReaderCache", () => {
		it("returns cached entry by url and content format", async () => {
			const t = convexTest(schema, modules);

			const cacheId = await t.mutation(internal.cache.createReaderEntry, {
				url: "https://example.com",
				contentFormat: "markdown",
				expiresAt: Date.now() + 86400000,
			});

			await t.mutation(internal.cache.completeReaderEntry, {
				cacheId,
				content: "Cached content",
				tokensUsed: 100,
			});

			const result = await t.query(internal.cache.getReaderCache, {
				url: "https://example.com",
				contentFormat: "markdown",
			});

			expect(result).not.toBeNull();
			expect(result!._id).toBe(cacheId);
			expect(result!.content).toBe("Cached content");
		});

		it("returns null when no cache entry exists", async () => {
			const t = convexTest(schema, modules);

			const result = await t.query(internal.cache.getReaderCache, {
				url: "https://nonexistent.com",
				contentFormat: "markdown",
			});

			expect(result).toBeNull();
		});

		it("does not match different content format", async () => {
			const t = convexTest(schema, modules);

			await t.mutation(internal.cache.createReaderEntry, {
				url: "https://example.com",
				contentFormat: "markdown",
				expiresAt: Date.now() + 86400000,
			});

			const result = await t.query(internal.cache.getReaderCache, {
				url: "https://example.com",
				contentFormat: "html",
			});

			expect(result).toBeNull();
		});

		it("returns latest entry for same URL (desc order)", async () => {
			const t = convexTest(schema, modules);

			const firstId = await t.mutation(internal.cache.createReaderEntry, {
				url: "https://example.com",
				contentFormat: "markdown",
				expiresAt: Date.now() + 86400000,
			});

			await t.mutation(internal.cache.completeReaderEntry, {
				cacheId: firstId,
				content: "First content",
				tokensUsed: 50,
			});

			const secondId = await t.mutation(internal.cache.createReaderEntry, {
				url: "https://example.com",
				contentFormat: "markdown",
				expiresAt: Date.now() + 86400000,
			});

			await t.mutation(internal.cache.completeReaderEntry, {
				cacheId: secondId,
				content: "Second content",
				tokensUsed: 75,
			});

			const result = await t.query(internal.cache.getReaderCache, {
				url: "https://example.com",
				contentFormat: "markdown",
			});

			expect(result).not.toBeNull();
			// desc order by _creationTime means the latest entry is returned
			expect(result!._id).toBe(secondId);
			expect(result!.content).toBe("Second content");
		});

		it("does not match different URLs", async () => {
			const t = convexTest(schema, modules);

			await t.mutation(internal.cache.createReaderEntry, {
				url: "https://example.com",
				contentFormat: "markdown",
				expiresAt: Date.now() + 86400000,
			});

			const result = await t.query(internal.cache.getReaderCache, {
				url: "https://other.com",
				contentFormat: "markdown",
			});

			expect(result).toBeNull();
		});
	});

	describe("getReaderContent", () => {
		it("returns full document by ID", async () => {
			const t = convexTest(schema, modules);

			const cacheId = await t.mutation(internal.cache.createReaderEntry, {
				url: "https://example.com",
				contentFormat: "markdown",
				expiresAt: Date.now() + 86400000,
			});

			await t.mutation(internal.cache.completeReaderEntry, {
				cacheId,
				title: "Test Page",
				content: "# Content",
				tokensUsed: 100,
			});

			const result = await t.query(api.cache.getReaderContent, {
				cacheId,
			});

			expect(result).not.toBeNull();
			expect(result!._id).toBe(cacheId);
			expect(result!.title).toBe("Test Page");
			expect(result!.content).toBe("# Content");
			expect(result!.status).toBe("completed");
		});

		it("returns null for nonexistent ID", async () => {
			const t = convexTest(schema, modules);

			// Create and delete an entry to get a valid-format but nonexistent ID
			const cacheId = await t.mutation(internal.cache.createReaderEntry, {
				url: "https://example.com",
				contentFormat: "markdown",
				expiresAt: Date.now() + 86400000,
			});

			await t.run(async (ctx) => {
				await ctx.db.delete(cacheId);
			});

			const result = await t.query(api.cache.getReaderContent, {
				cacheId,
			});

			expect(result).toBeNull();
		});
	});

	describe("invalidateReaderCache", () => {
		it("deletes all entries for a URL and returns count", async () => {
			const t = convexTest(schema, modules);

			await t.mutation(internal.cache.createReaderEntry, {
				url: "https://example.com",
				contentFormat: "markdown",
				expiresAt: Date.now() + 86400000,
			});

			await t.mutation(internal.cache.createReaderEntry, {
				url: "https://example.com",
				contentFormat: "html",
				expiresAt: Date.now() + 86400000,
			});

			await t.mutation(internal.cache.createReaderEntry, {
				url: "https://other.com",
				contentFormat: "markdown",
				expiresAt: Date.now() + 86400000,
			});

			const count = await t.mutation(api.cache.invalidateReaderCache, {
				url: "https://example.com",
			});

			expect(count).toBe(2);

			// Verify only the other URL remains
			const remaining = await t.run(async (ctx) => {
				return await ctx.db.query("readerCache").collect();
			});

			expect(remaining).toHaveLength(1);
			expect(remaining[0].url).toBe("https://other.com");
		});

		it("returns 0 when no entries match", async () => {
			const t = convexTest(schema, modules);

			const count = await t.mutation(api.cache.invalidateReaderCache, {
				url: "https://nonexistent.com",
			});

			expect(count).toBe(0);
		});
	});
});

// --- Search Cache ---

describe("cache - search", () => {
	describe("createSearchEntry", () => {
		it("creates entry with pending status and empty results", async () => {
			const t = convexTest(schema, modules);
			const now = Date.now();
			const expiresAt = now + 86400000;

			const cacheId = await t.mutation(internal.cache.createSearchEntry, {
				query: "convex database",
				expiresAt,
			});

			expect(cacheId).toBeDefined();

			const entry = await t.run(async (ctx) => {
				return await ctx.db.get(cacheId);
			});

			expect(entry!.query).toBe("convex database");
			expect(entry!.status).toBe("pending");
			expect(entry!.results).toEqual([]);
			expect(entry!.totalTokensUsed).toBe(0);
			expect(entry!.expiresAt).toBe(expiresAt);
			expect(entry!.site).toBeUndefined();
		});

		it("creates entry with site filter", async () => {
			const t = convexTest(schema, modules);

			const cacheId = await t.mutation(internal.cache.createSearchEntry, {
				query: "docs",
				site: "docs.convex.dev",
				expiresAt: Date.now() + 86400000,
			});

			const entry = await t.run(async (ctx) => {
				return await ctx.db.get(cacheId);
			});

			expect(entry!.site).toBe("docs.convex.dev");
		});
	});

	describe("completeSearchEntry", () => {
		it("updates entry with results array and tokens", async () => {
			const t = convexTest(schema, modules);

			const cacheId = await t.mutation(internal.cache.createSearchEntry, {
				query: "convex database",
				expiresAt: Date.now() + 86400000,
			});

			const results = [
				{
					title: "Convex Docs",
					description: "Official docs",
					url: "https://docs.convex.dev",
					content: "Convex is a reactive backend",
					tokensUsed: 50,
				},
				{
					title: "Getting Started",
					description: "Quick start guide",
					url: "https://docs.convex.dev/start",
					content: "Getting started with Convex",
					tokensUsed: 30,
				},
			];

			await t.mutation(internal.cache.completeSearchEntry, {
				cacheId,
				results,
				totalTokensUsed: 80,
			});

			const entry = await t.run(async (ctx) => {
				return await ctx.db.get(cacheId);
			});

			expect(entry!.status).toBe("completed");
			expect(entry!.results).toHaveLength(2);
			expect(entry!.results[0].title).toBe("Convex Docs");
			expect(entry!.results[1].title).toBe("Getting Started");
			expect(entry!.totalTokensUsed).toBe(80);
		});
	});

	describe("failSearchEntry", () => {
		it("sets failed status with error message", async () => {
			const t = convexTest(schema, modules);

			const cacheId = await t.mutation(internal.cache.createSearchEntry, {
				query: "test query",
				expiresAt: Date.now() + 86400000,
			});

			await t.mutation(internal.cache.failSearchEntry, {
				cacheId,
				error: "Rate limited",
			});

			const entry = await t.run(async (ctx) => {
				return await ctx.db.get(cacheId);
			});

			expect(entry!.status).toBe("failed");
			expect(entry!.error).toBe("Rate limited");
		});
	});

	describe("getSearchCache", () => {
		it("returns cached entry by query", async () => {
			const t = convexTest(schema, modules);

			const cacheId = await t.mutation(internal.cache.createSearchEntry, {
				query: "convex database",
				expiresAt: Date.now() + 86400000,
			});

			await t.mutation(internal.cache.completeSearchEntry, {
				cacheId,
				results: [
					{
						title: "Result",
						description: "Desc",
						url: "https://example.com",
						content: "Content",
						tokensUsed: 10,
					},
				],
				totalTokensUsed: 10,
			});

			const result = await t.query(internal.cache.getSearchCache, {
				query: "convex database",
			});

			expect(result).not.toBeNull();
			expect(result!._id).toBe(cacheId);
		});

		it("returns null when no cache entry exists", async () => {
			const t = convexTest(schema, modules);

			const result = await t.query(internal.cache.getSearchCache, {
				query: "nonexistent query",
			});

			expect(result).toBeNull();
		});

		it("filters by site when provided", async () => {
			const t = convexTest(schema, modules);

			await t.mutation(internal.cache.createSearchEntry, {
				query: "test",
				site: "example.com",
				expiresAt: Date.now() + 86400000,
			});

			const withSite = await t.query(internal.cache.getSearchCache, {
				query: "test",
				site: "example.com",
			});
			expect(withSite).not.toBeNull();

			const wrongSite = await t.query(internal.cache.getSearchCache, {
				query: "test",
				site: "other.com",
			});
			expect(wrongSite).toBeNull();
		});

		it("returns latest entry for same query (desc order)", async () => {
			const t = convexTest(schema, modules);

			const firstId = await t.mutation(internal.cache.createSearchEntry, {
				query: "test query",
				expiresAt: Date.now() + 86400000,
			});

			await t.mutation(internal.cache.completeSearchEntry, {
				cacheId: firstId,
				results: [
					{
						title: "Old",
						description: "",
						url: "",
						content: "",
						tokensUsed: 0,
					},
				],
				totalTokensUsed: 0,
			});

			const secondId = await t.mutation(internal.cache.createSearchEntry, {
				query: "test query",
				expiresAt: Date.now() + 86400000,
			});

			await t.mutation(internal.cache.completeSearchEntry, {
				cacheId: secondId,
				results: [
					{
						title: "New",
						description: "",
						url: "",
						content: "",
						tokensUsed: 0,
					},
				],
				totalTokensUsed: 0,
			});

			const result = await t.query(internal.cache.getSearchCache, {
				query: "test query",
			});

			expect(result).not.toBeNull();
			expect(result!._id).toBe(secondId);
			expect(result!.results[0].title).toBe("New");
		});
	});

	describe("getSearchResults", () => {
		it("returns full document by ID", async () => {
			const t = convexTest(schema, modules);

			const cacheId = await t.mutation(internal.cache.createSearchEntry, {
				query: "test",
				expiresAt: Date.now() + 86400000,
			});

			await t.mutation(internal.cache.completeSearchEntry, {
				cacheId,
				results: [
					{
						title: "Result 1",
						description: "Description",
						url: "https://example.com",
						content: "Content here",
						tokensUsed: 25,
					},
				],
				totalTokensUsed: 25,
			});

			const result = await t.query(api.cache.getSearchResults, {
				cacheId,
			});

			expect(result).not.toBeNull();
			expect(result!._id).toBe(cacheId);
			expect(result!.results).toHaveLength(1);
			expect(result!.results[0].title).toBe("Result 1");
		});

		it("returns null for nonexistent ID", async () => {
			const t = convexTest(schema, modules);

			const cacheId = await t.mutation(internal.cache.createSearchEntry, {
				query: "temp",
				expiresAt: Date.now() + 86400000,
			});

			await t.run(async (ctx) => {
				await ctx.db.delete(cacheId);
			});

			const result = await t.query(api.cache.getSearchResults, {
				cacheId,
			});

			expect(result).toBeNull();
		});
	});

	describe("invalidateSearchCache", () => {
		it("deletes all entries for a query and returns count", async () => {
			const t = convexTest(schema, modules);

			await t.mutation(internal.cache.createSearchEntry, {
				query: "test query",
				expiresAt: Date.now() + 86400000,
			});

			await t.mutation(internal.cache.createSearchEntry, {
				query: "test query",
				site: "example.com",
				expiresAt: Date.now() + 86400000,
			});

			await t.mutation(internal.cache.createSearchEntry, {
				query: "different query",
				expiresAt: Date.now() + 86400000,
			});

			const count = await t.mutation(api.cache.invalidateSearchCache, {
				query: "test query",
			});

			expect(count).toBe(2);

			const remaining = await t.run(async (ctx) => {
				return await ctx.db.query("searchCache").collect();
			});

			expect(remaining).toHaveLength(1);
			expect(remaining[0].query).toBe("different query");
		});

		it("returns 0 when no entries match", async () => {
			const t = convexTest(schema, modules);

			const count = await t.mutation(api.cache.invalidateSearchCache, {
				query: "nonexistent",
			});

			expect(count).toBe(0);
		});
	});
});

// --- Cache Expiry ---

describe("cache - expiry behavior", () => {
	it("expired reader cache entries are still returned by getReaderCache (status check is caller responsibility)", async () => {
		const t = convexTest(schema, modules);

		const cacheId = await t.mutation(internal.cache.createReaderEntry, {
			url: "https://example.com",
			contentFormat: "markdown",
			expiresAt: Date.now() - 1000, // already expired
		});

		await t.mutation(internal.cache.completeReaderEntry, {
			cacheId,
			content: "Expired content",
			tokensUsed: 50,
		});

		// getReaderCache returns the entry regardless of expiry -
		// the caller (reader action) checks expiresAt
		const result = await t.query(internal.cache.getReaderCache, {
			url: "https://example.com",
			contentFormat: "markdown",
		});

		expect(result).not.toBeNull();
		expect(result!.expiresAt).toBeLessThan(Date.now());
	});

	it("expired search cache entries are still returned by getSearchCache (status check is caller responsibility)", async () => {
		const t = convexTest(schema, modules);

		const cacheId = await t.mutation(internal.cache.createSearchEntry, {
			query: "test",
			expiresAt: Date.now() - 1000, // already expired
		});

		await t.mutation(internal.cache.completeSearchEntry, {
			cacheId,
			results: [],
			totalTokensUsed: 0,
		});

		const result = await t.query(internal.cache.getSearchCache, {
			query: "test",
		});

		expect(result).not.toBeNull();
		expect(result!.expiresAt).toBeLessThan(Date.now());
	});
});
