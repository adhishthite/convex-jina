import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api.js";
import schema from "./schema.js";

const modules = import.meta.glob("./**/*.ts");

function mockFetchResponse(data: any, status = 200, statusText = "OK") {
	return new Response(JSON.stringify(data), {
		status,
		statusText,
		headers: { "content-type": "application/json" },
	});
}

function mockFetchError(status: number, statusText: string, body = "") {
	return new Response(body, {
		status,
		statusText,
		headers: { "content-type": "text/plain" },
	});
}

describe("search - search action", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("successful search: creates cache, calls API, stores results, tracks usage", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: [
					{
						title: "Convex Docs",
						description: "Official documentation",
						url: "https://docs.convex.dev",
						content: "Convex is a reactive backend",
						usage: { tokens: 50 },
					},
					{
						title: "Convex Blog",
						description: "Engineering blog",
						url: "https://blog.convex.dev",
						content: "Latest updates from Convex",
						usage: { tokens: 30 },
					},
				],
			}),
		);

		const result = await t.action(api.search.search, {
			query: "convex database",
			apiKey: "test-api-key",
		});

		expect(result.status).toBe("completed");
		expect(result.cached).toBe(false);
		expect(result.cacheId).toBeDefined();

		// Verify fetch was called correctly
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [fetchUrl, fetchInit] = fetchMock.mock.calls[0];
		expect(fetchUrl).toBe("https://s.jina.ai/");
		expect(fetchInit.method).toBe("POST");
		expect(JSON.parse(fetchInit.body)).toEqual({ q: "convex database" });
		expect(fetchInit.headers.Authorization).toBe("Bearer test-api-key");

		// Verify cache entry
		const cacheEntry = await t.query(api.cache.getSearchResults, {
			cacheId: result.cacheId,
		});
		expect(cacheEntry!.status).toBe("completed");
		expect(cacheEntry!.results).toHaveLength(2);
		expect(cacheEntry!.results[0].title).toBe("Convex Docs");
		expect(cacheEntry!.results[1].title).toBe("Convex Blog");
		expect(cacheEntry!.totalTokensUsed).toBe(80);

		// Verify usage tracking
		const usage = await t.query(api.usage.getUsage, {});
		expect(usage.searchTokens).toBe(80);
		expect(usage.operationCount).toBe(1);
	});

	it("cache hit: returns cached result without API call", async () => {
		const t = convexTest(schema, modules);

		// First call populates cache
		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: [
					{
						title: "Result",
						description: "Desc",
						url: "https://example.com",
						content: "Content",
						usage: { tokens: 25 },
					},
				],
			}),
		);

		const first = await t.action(api.search.search, {
			query: "test query",
			apiKey: "test-key",
		});
		expect(first.cached).toBe(false);

		// Second call should use cache
		fetchMock.mockClear();

		const second = await t.action(api.search.search, {
			query: "test query",
			apiKey: "test-key",
		});

		expect(second.cached).toBe(true);
		expect(second.status).toBe("completed");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("noCache option bypasses cache", async () => {
		const t = convexTest(schema, modules);

		// First call
		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: [
					{
						title: "Old",
						description: "",
						url: "",
						content: "",
						usage: { tokens: 10 },
					},
				],
			}),
		);

		await t.action(api.search.search, {
			query: "test query",
			apiKey: "test-key",
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);

		// Second call with noCache
		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: [
					{
						title: "Fresh",
						description: "",
						url: "",
						content: "",
						usage: { tokens: 15 },
					},
				],
			}),
		);

		const result = await t.action(api.search.search, {
			query: "test query",
			apiKey: "test-key",
			options: { noCache: true },
		});

		expect(result.cached).toBe(false);
		// Total 2 calls: first populates cache, second bypasses it
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("API error: creates failed entry", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(mockFetchError(400, "Bad Request", "Invalid query"));

		const result = await t.action(api.search.search, {
			query: "",
			apiKey: "test-key",
		});

		expect(result.status).toBe("failed");
		expect(result.cached).toBe(false);

		const cacheEntry = await t.query(api.cache.getSearchResults, {
			cacheId: result.cacheId,
		});
		expect(cacheEntry!.status).toBe("failed");
		expect(cacheEntry!.error).toContain("400");
	});

	it("retry logic: 429 rate limit retries", async () => {
		const t = convexTest(schema, modules);

		fetchMock
			.mockResolvedValueOnce(mockFetchError(429, "Too Many Requests"))
			.mockResolvedValueOnce(mockFetchError(429, "Too Many Requests"))
			.mockResolvedValueOnce(
				mockFetchResponse({
					code: 200,
					data: [
						{
							title: "Success",
							description: "",
							url: "",
							content: "",
							usage: { tokens: 10 },
						},
					],
				}),
			);

		const result = await t.action(api.search.search, {
			query: "test",
			apiKey: "test-key",
		});

		expect(result.status).toBe("completed");
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("retry logic: 500+ server error retries", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(mockFetchError(502, "Bad Gateway")).mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: [],
			}),
		);

		const result = await t.action(api.search.search, {
			query: "test",
			apiKey: "test-key",
		});

		expect(result.status).toBe("completed");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("non-retryable error (401): fails immediately", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(mockFetchError(401, "Unauthorized"));

		const result = await t.action(api.search.search, {
			query: "test",
			apiKey: "bad-key",
		});

		expect(result.status).toBe("failed");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("non-retryable error (403): fails immediately", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(mockFetchError(403, "Forbidden"));

		const result = await t.action(api.search.search, {
			query: "test",
			apiKey: "test-key",
		});

		expect(result.status).toBe("failed");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("exhausted retries on server error results in failure", async () => {
		const t = convexTest(schema, modules);

		fetchMock
			.mockResolvedValueOnce(mockFetchError(500, "Internal Server Error"))
			.mockResolvedValueOnce(mockFetchError(500, "Internal Server Error"))
			.mockResolvedValueOnce(mockFetchError(500, "Internal Server Error"));

		const result = await t.action(api.search.search, {
			query: "test",
			apiKey: "test-key",
		});

		expect(result.status).toBe("failed");
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("network error (TypeError with fetch): retries then fails", async () => {
		const t = convexTest(schema, modules);

		const fetchError = new TypeError("fetch failed");
		fetchMock
			.mockRejectedValueOnce(fetchError)
			.mockRejectedValueOnce(fetchError)
			.mockRejectedValueOnce(fetchError);

		const result = await t.action(api.search.search, {
			query: "test",
			apiKey: "test-key",
		});

		expect(result.status).toBe("failed");
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("site filter sets X-Site header", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: [],
			}),
		);

		await t.action(api.search.search, {
			query: "docs",
			apiKey: "test-key",
			site: "docs.convex.dev",
		});

		const [, fetchInit] = fetchMock.mock.calls[0];
		expect(fetchInit.headers["X-Site"]).toBe("docs.convex.dev");
	});

	it("country and language set gl and hl in body", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: [],
			}),
		);

		await t.action(api.search.search, {
			query: "test",
			apiKey: "test-key",
			country: "US",
			language: "en",
		});

		const [, fetchInit] = fetchMock.mock.calls[0];
		const body = JSON.parse(fetchInit.body);
		expect(body.gl).toBe("US");
		expect(body.hl).toBe("en");
	});

	it("numResults and page set num and page in body", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: [],
			}),
		);

		await t.action(api.search.search, {
			query: "test",
			apiKey: "test-key",
			numResults: 5,
			page: 2,
		});

		const [, fetchInit] = fetchMock.mock.calls[0];
		const body = JSON.parse(fetchInit.body);
		expect(body.num).toBe(5);
		expect(body.page).toBe(2);
	});

	it("page 0 is passed correctly", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: [],
			}),
		);

		await t.action(api.search.search, {
			query: "test",
			apiKey: "test-key",
			page: 0,
		});

		const [, fetchInit] = fetchMock.mock.calls[0];
		const body = JSON.parse(fetchInit.body);
		expect(body.page).toBe(0);
	});

	it("multiple results are all mapped correctly with token counts", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: [
					{
						title: "Result 1",
						description: "First",
						url: "https://a.com",
						content: "Content A",
						usage: { tokens: 10 },
					},
					{
						title: "Result 2",
						description: "Second",
						url: "https://b.com",
						content: "Content B",
						usage: { tokens: 20 },
					},
					{
						title: "Result 3",
						description: "Third",
						url: "https://c.com",
						content: "Content C",
						usage: { tokens: 30 },
					},
				],
			}),
		);

		const result = await t.action(api.search.search, {
			query: "test",
			apiKey: "test-key",
		});

		const cacheEntry = await t.query(api.cache.getSearchResults, {
			cacheId: result.cacheId,
		});

		expect(cacheEntry!.results).toHaveLength(3);
		expect(cacheEntry!.results[0]).toEqual({
			title: "Result 1",
			description: "First",
			url: "https://a.com",
			content: "Content A",
			tokensUsed: 10,
		});
		expect(cacheEntry!.results[1].tokensUsed).toBe(20);
		expect(cacheEntry!.results[2].tokensUsed).toBe(30);
		expect(cacheEntry!.totalTokensUsed).toBe(60);
	});

	it("empty results array is handled gracefully", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: [],
			}),
		);

		const result = await t.action(api.search.search, {
			query: "obscure query with no results",
			apiKey: "test-key",
		});

		expect(result.status).toBe("completed");

		const cacheEntry = await t.query(api.cache.getSearchResults, {
			cacheId: result.cacheId,
		});
		expect(cacheEntry!.results).toEqual([]);
		expect(cacheEntry!.totalTokensUsed).toBe(0);
	});

	it("non-array data in response is treated as empty results", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: null,
			}),
		);

		const result = await t.action(api.search.search, {
			query: "test",
			apiKey: "test-key",
		});

		expect(result.status).toBe("completed");

		const cacheEntry = await t.query(api.cache.getSearchResults, {
			cacheId: result.cacheId,
		});
		expect(cacheEntry!.results).toEqual([]);
	});

	it("results with missing fields default to empty strings and 0 tokens", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: [
					{
						// All fields missing
					},
				],
			}),
		);

		const result = await t.action(api.search.search, {
			query: "test",
			apiKey: "test-key",
		});

		const cacheEntry = await t.query(api.cache.getSearchResults, {
			cacheId: result.cacheId,
		});
		expect(cacheEntry!.results[0]).toEqual({
			title: "",
			description: "",
			url: "",
			content: "",
			tokensUsed: 0,
		});
	});

	it("optional search headers are set correctly", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: [],
			}),
		);

		await t.action(api.search.search, {
			query: "test",
			apiKey: "test-key",
			options: {
				withLinksSummary: true,
				withImagesSummary: true,
				timeout: 15000,
				engine: "google",
			},
		});

		const [, fetchInit] = fetchMock.mock.calls[0];
		expect(fetchInit.headers["X-With-Links-Summary"]).toBe("true");
		expect(fetchInit.headers["X-With-Images-Summary"]).toBe("true");
		expect(fetchInit.headers["X-Timeout"]).toBe("15000");
		expect(fetchInit.headers["X-Engine"]).toBe("google");
	});

	it("userId is tracked in usage", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: [
					{
						title: "R",
						description: "",
						url: "",
						content: "",
						usage: { tokens: 42 },
					},
				],
			}),
		);

		await t.action(api.search.search, {
			query: "test",
			apiKey: "test-key",
			userId: "user_xyz",
		});

		const usage = await t.query(api.usage.getUsage, { userId: "user_xyz" });
		expect(usage.searchTokens).toBe(42);
		expect(usage.operationCount).toBe(1);
	});

	it("expired cache entry triggers fresh API call", async () => {
		const t = convexTest(schema, modules);

		// Insert expired cache entry
		await t.run(async (ctx) => {
			await ctx.db.insert("searchCache", {
				query: "test query",
				results: [
					{
						title: "Old",
						description: "",
						url: "",
						content: "",
						tokensUsed: 5,
					},
				],
				totalTokensUsed: 5,
				fetchedAt: Date.now() - 200000,
				expiresAt: Date.now() - 100000, // expired
				status: "completed",
			});
		});

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: [
					{
						title: "Fresh",
						description: "",
						url: "",
						content: "",
						usage: { tokens: 10 },
					},
				],
			}),
		);

		const result = await t.action(api.search.search, {
			query: "test query",
			apiKey: "test-key",
		});

		expect(result.cached).toBe(false);
		expect(result.status).toBe("completed");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("custom cacheTtlMs is used for expiry", async () => {
		const t = convexTest(schema, modules);
		const before = Date.now();
		const customTtl = 1800000; // 30 minutes

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: [],
			}),
		);

		const result = await t.action(api.search.search, {
			query: "test",
			apiKey: "test-key",
			cacheTtlMs: customTtl,
		});

		const cacheEntry = await t.query(api.cache.getSearchResults, {
			cacheId: result.cacheId,
		});

		expect(cacheEntry!.expiresAt).toBeGreaterThanOrEqual(before + customTtl - 1000);
		expect(cacheEntry!.expiresAt).toBeLessThanOrEqual(before + customTtl + 5000);
	});
});
