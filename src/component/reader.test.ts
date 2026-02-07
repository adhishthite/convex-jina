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

describe("reader - read action", () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("successful read: creates cache entry, calls API, completes entry, tracks usage", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: {
					title: "Example",
					description: "An example page",
					content: "# Hello World",
					images: {},
					links: {},
					usage: { tokens: 150 },
				},
			}),
		);

		const result = await t.action(api.reader.read, {
			url: "https://example.com",
			apiKey: "test-api-key",
		});

		expect(result.status).toBe("completed");
		expect(result.cached).toBe(false);
		expect(result.cacheId).toBeDefined();

		// Verify fetch was called correctly
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [fetchUrl, fetchInit] = fetchMock.mock.calls[0];
		expect(fetchUrl).toBe("https://r.jina.ai/");
		expect(fetchInit.method).toBe("POST");
		expect(JSON.parse(fetchInit.body)).toEqual({ url: "https://example.com" });
		expect(fetchInit.headers.Authorization).toBe("Bearer test-api-key");
		expect(fetchInit.headers.Accept).toBe("application/json");

		// Verify cache entry was completed
		const cacheEntry = await t.query(api.cache.getReaderContent, {
			cacheId: result.cacheId,
		});
		expect(cacheEntry!.status).toBe("completed");
		expect(cacheEntry!.title).toBe("Example");
		expect(cacheEntry!.content).toBe("# Hello World");
		expect(cacheEntry!.tokensUsed).toBe(150);

		// Verify usage was tracked
		const usage = await t.query(api.usage.getUsage, {});
		expect(usage.readTokens).toBe(150);
		expect(usage.operationCount).toBe(1);
	});

	it("cache hit: returns cached result without API call", async () => {
		const t = convexTest(schema, modules);

		// First call - populates cache
		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: {
					title: "Cached",
					content: "Cached content",
					usage: { tokens: 100 },
				},
			}),
		);

		const first = await t.action(api.reader.read, {
			url: "https://example.com",
			apiKey: "test-key",
		});
		expect(first.cached).toBe(false);

		// Second call - should use cache
		fetchMock.mockClear();

		const second = await t.action(api.reader.read, {
			url: "https://example.com",
			apiKey: "test-key",
		});

		expect(second.cached).toBe(true);
		expect(second.status).toBe("completed");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("noCache option bypasses cache", async () => {
		const t = convexTest(schema, modules);

		// First call - populates cache
		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: {
					title: "First",
					content: "First content",
					usage: { tokens: 50 },
				},
			}),
		);

		await t.action(api.reader.read, {
			url: "https://example.com",
			apiKey: "test-key",
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);

		// Second call with noCache - should call API again
		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: {
					title: "Fresh",
					content: "Fresh content",
					usage: { tokens: 75 },
				},
			}),
		);

		const result = await t.action(api.reader.read, {
			url: "https://example.com",
			apiKey: "test-key",
			options: { noCache: true },
		});

		expect(result.cached).toBe(false);
		// Total 2 calls: first populates cache, second bypasses it
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("API error: creates failed entry with error message", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(mockFetchError(400, "Bad Request", "Invalid URL"));

		const result = await t.action(api.reader.read, {
			url: "https://bad-url",
			apiKey: "test-key",
		});

		expect(result.status).toBe("failed");
		expect(result.cached).toBe(false);

		const cacheEntry = await t.query(api.cache.getReaderContent, {
			cacheId: result.cacheId,
		});
		expect(cacheEntry!.status).toBe("failed");
		expect(cacheEntry!.error).toContain("400");
	});

	it("rate limit (429): retries with exponential backoff", async () => {
		const t = convexTest(schema, modules);

		// First two calls return 429, third succeeds
		fetchMock
			.mockResolvedValueOnce(mockFetchError(429, "Too Many Requests"))
			.mockResolvedValueOnce(mockFetchError(429, "Too Many Requests"))
			.mockResolvedValueOnce(
				mockFetchResponse({
					code: 200,
					data: {
						title: "Success after retry",
						content: "Content",
						usage: { tokens: 100 },
					},
				}),
			);

		const result = await t.action(api.reader.read, {
			url: "https://example.com",
			apiKey: "test-key",
		});

		expect(result.status).toBe("completed");
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("server error (500+): retries then succeeds", async () => {
		const t = convexTest(schema, modules);

		fetchMock
			.mockResolvedValueOnce(mockFetchError(503, "Service Unavailable"))
			.mockResolvedValueOnce(
				mockFetchResponse({
					code: 200,
					data: {
						content: "Recovered",
						usage: { tokens: 50 },
					},
				}),
			);

		const result = await t.action(api.reader.read, {
			url: "https://example.com",
			apiKey: "test-key",
		});

		expect(result.status).toBe("completed");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("non-retryable error (401): fails immediately", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(mockFetchError(401, "Unauthorized", "Invalid API key"));

		const result = await t.action(api.reader.read, {
			url: "https://example.com",
			apiKey: "bad-key",
		});

		expect(result.status).toBe("failed");
		expect(fetchMock).toHaveBeenCalledTimes(1);

		const cacheEntry = await t.query(api.cache.getReaderContent, {
			cacheId: result.cacheId,
		});
		expect(cacheEntry!.error).toContain("401");
	});

	it("non-retryable error (403): fails immediately", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(mockFetchError(403, "Forbidden"));

		const result = await t.action(api.reader.read, {
			url: "https://example.com",
			apiKey: "test-key",
		});

		expect(result.status).toBe("failed");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("server error exhausts retries then fails", async () => {
		const t = convexTest(schema, modules);

		fetchMock
			.mockResolvedValueOnce(mockFetchError(500, "Internal Server Error"))
			.mockResolvedValueOnce(mockFetchError(500, "Internal Server Error"))
			.mockResolvedValueOnce(mockFetchError(500, "Internal Server Error"));

		const result = await t.action(api.reader.read, {
			url: "https://example.com",
			apiKey: "test-key",
		});

		// After 3 retries, the last 500 is a non-retryable throw (attempt === retries - 1)
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

		const result = await t.action(api.reader.read, {
			url: "https://example.com",
			apiKey: "test-key",
		});

		expect(result.status).toBe("failed");
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("content format affects X-Return-Format header", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: {
					content: "<html>content</html>",
					usage: { tokens: 50 },
				},
			}),
		);

		await t.action(api.reader.read, {
			url: "https://example.com",
			apiKey: "test-key",
			contentFormat: "html",
		});

		const [, fetchInit] = fetchMock.mock.calls[0];
		expect(fetchInit.headers["X-Return-Format"]).toBe("html");
	});

	it("markdown format does not set X-Return-Format header", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: {
					content: "# Markdown",
					usage: { tokens: 50 },
				},
			}),
		);

		await t.action(api.reader.read, {
			url: "https://example.com",
			apiKey: "test-key",
			contentFormat: "markdown",
		});

		const [, fetchInit] = fetchMock.mock.calls[0];
		expect(fetchInit.headers["X-Return-Format"]).toBeUndefined();
	});

	it("useReaderLM option sets X-Respond-With header", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: {
					content: "Summarized content",
					usage: { tokens: 75 },
				},
			}),
		);

		await t.action(api.reader.read, {
			url: "https://example.com",
			apiKey: "test-key",
			options: { useReaderLM: true },
		});

		const [, fetchInit] = fetchMock.mock.calls[0];
		expect(fetchInit.headers["X-Respond-With"]).toBe("readerlm-v2");
	});

	it("all optional headers are set correctly", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: { content: "content", usage: { tokens: 10 } },
			}),
		);

		await t.action(api.reader.read, {
			url: "https://example.com",
			apiKey: "test-key",
			contentFormat: "text",
			options: {
				targetSelector: ".main",
				removeSelector: ".ads",
				waitForSelector: "#content",
				withLinksSummary: true,
				withImagesSummary: true,
				timeout: 30000,
				tokenBudget: 5000,
				engine: "browser",
				useReaderLM: true,
				retainImages: false,
			},
		});

		const [, fetchInit] = fetchMock.mock.calls[0];
		expect(fetchInit.headers["X-Target-Selector"]).toBe(".main");
		expect(fetchInit.headers["X-Remove-Selector"]).toBe(".ads");
		expect(fetchInit.headers["X-Wait-For-Selector"]).toBe("#content");
		expect(fetchInit.headers["X-With-Links-Summary"]).toBe("true");
		expect(fetchInit.headers["X-With-Images-Summary"]).toBe("true");
		expect(fetchInit.headers["X-Timeout"]).toBe("30000");
		expect(fetchInit.headers["X-Token-Budget"]).toBe("5000");
		expect(fetchInit.headers["X-Engine"]).toBe("browser");
		expect(fetchInit.headers["X-Respond-With"]).toBe("readerlm-v2");
		expect(fetchInit.headers["X-Retain-Images"]).toBe("none");
		expect(fetchInit.headers["X-Return-Format"]).toBe("text");
	});

	it("token usage is tracked correctly", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: {
					content: "Content",
					usage: { tokens: 250 },
				},
			}),
		);

		await t.action(api.reader.read, {
			url: "https://example.com",
			apiKey: "test-key",
			userId: "user_123",
		});

		const usage = await t.query(api.usage.getUsage, { userId: "user_123" });
		expect(usage.readTokens).toBe(250);
		expect(usage.operationCount).toBe(1);
	});

	it("handles missing usage.tokens in response (defaults to 0)", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: {
					content: "Content without usage",
				},
			}),
		);

		const result = await t.action(api.reader.read, {
			url: "https://example.com",
			apiKey: "test-key",
		});

		expect(result.status).toBe("completed");

		const cacheEntry = await t.query(api.cache.getReaderContent, {
			cacheId: result.cacheId,
		});
		expect(cacheEntry!.tokensUsed).toBe(0);
	});

	it("handles null content in response (defaults to empty string)", async () => {
		const t = convexTest(schema, modules);

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: {
					title: "Empty Page",
					usage: { tokens: 10 },
				},
			}),
		);

		const result = await t.action(api.reader.read, {
			url: "https://example.com/empty",
			apiKey: "test-key",
		});

		expect(result.status).toBe("completed");

		const cacheEntry = await t.query(api.cache.getReaderContent, {
			cacheId: result.cacheId,
		});
		expect(cacheEntry!.content).toBe("");
	});

	it("custom cacheTtlMs is used for expiry", async () => {
		const t = convexTest(schema, modules);
		const before = Date.now();
		const customTtl = 3600000; // 1 hour

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: {
					content: "Short-lived cache",
					usage: { tokens: 20 },
				},
			}),
		);

		const result = await t.action(api.reader.read, {
			url: "https://example.com",
			apiKey: "test-key",
			cacheTtlMs: customTtl,
		});

		const cacheEntry = await t.query(api.cache.getReaderContent, {
			cacheId: result.cacheId,
		});

		// expiresAt should be roughly now + customTtl
		expect(cacheEntry!.expiresAt).toBeGreaterThanOrEqual(before + customTtl - 1000);
		expect(cacheEntry!.expiresAt).toBeLessThanOrEqual(before + customTtl + 5000);
	});

	it("expired cache entry triggers fresh API call", async () => {
		const t = convexTest(schema, modules);

		// Insert an expired cache entry directly
		await t.run(async (ctx) => {
			await ctx.db.insert("readerCache", {
				url: "https://example.com",
				contentFormat: "markdown",
				title: "Old",
				content: "Old content",
				tokensUsed: 50,
				fetchedAt: Date.now() - 200000,
				expiresAt: Date.now() - 100000, // expired
				status: "completed",
			});
		});

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: {
					title: "Fresh",
					content: "Fresh content",
					usage: { tokens: 75 },
				},
			}),
		);

		const result = await t.action(api.reader.read, {
			url: "https://example.com",
			apiKey: "test-key",
		});

		expect(result.cached).toBe(false);
		expect(result.status).toBe("completed");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("failed cache entry triggers fresh API call", async () => {
		const t = convexTest(schema, modules);

		// Insert a failed cache entry
		await t.run(async (ctx) => {
			await ctx.db.insert("readerCache", {
				url: "https://example.com",
				contentFormat: "markdown",
				content: "",
				tokensUsed: 0,
				fetchedAt: Date.now(),
				expiresAt: Date.now() + 86400000,
				status: "failed",
				error: "Previous error",
			});
		});

		fetchMock.mockResolvedValueOnce(
			mockFetchResponse({
				code: 200,
				data: {
					content: "Now it works",
					usage: { tokens: 50 },
				},
			}),
		);

		const result = await t.action(api.reader.read, {
			url: "https://example.com",
			apiKey: "test-key",
		});

		// Failed entries are not considered valid cache hits
		expect(result.cached).toBe(false);
		expect(result.status).toBe("completed");
	});
});
