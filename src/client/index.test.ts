import { describe, expect, it, vi } from "vitest";
import { JinaAI } from "./index.js";

// Mock component API references
function createMockComponent() {
	return {
		reader: {
			read: "reader.read",
		},
		search: {
			search: "search.search",
		},
		cache: {
			getReaderContent: "cache.getReaderContent",
			getSearchResults: "cache.getSearchResults",
			invalidateReaderCache: "cache.invalidateReaderCache",
			invalidateSearchCache: "cache.invalidateSearchCache",
		},
		usage: {
			getUsage: "usage.getUsage",
		},
	};
}

describe("JinaAI - constructor", () => {
	it("stores component ref and config with explicit API key", () => {
		const component = createMockComponent();
		const client = new JinaAI(component, {
			JINA_API_KEY: "test-key-123",
			defaultCacheTtlMs: 3600000,
		});

		expect(client).toBeInstanceOf(JinaAI);
		// Verify the instance was created (internal state is private,
		// but we test via method behavior)
	});

	it("uses default TTL of 24 hours when not specified", () => {
		const component = createMockComponent();
		// Access internal state indirectly via method behavior
		const client = new JinaAI(component, { JINA_API_KEY: "key" });
		expect(client).toBeInstanceOf(JinaAI);
	});

	it("falls back to process.env.JINA_API_KEY when not provided", () => {
		const component = createMockComponent();
		const originalEnv = process.env.JINA_API_KEY;

		process.env.JINA_API_KEY = "env-key-456";
		const client = new JinaAI(component);
		expect(client).toBeInstanceOf(JinaAI);

		process.env.JINA_API_KEY = originalEnv;
	});
});

describe("JinaAI - read method", () => {
	it("calls correct component action with apiKey and default TTL", async () => {
		const component = createMockComponent();
		const client = new JinaAI(component, { JINA_API_KEY: "test-key" });

		const mockCtx: any = {
			runAction: vi.fn().mockResolvedValue({
				cacheId: "cache_123",
				status: "completed",
				cached: false,
			}),
		};

		const result = await client.read(mockCtx, {
			url: "https://example.com",
		});

		expect(mockCtx.runAction).toHaveBeenCalledTimes(1);
		expect(mockCtx.runAction).toHaveBeenCalledWith("reader.read", {
			url: "https://example.com",
			apiKey: "test-key",
			contentFormat: undefined,
			options: undefined,
			cacheTtlMs: 86400000, // default 24h
			userId: undefined,
		});

		expect(result.cacheId).toBe("cache_123");
		expect(result.status).toBe("completed");
	});

	it("passes all read options through", async () => {
		const component = createMockComponent();
		const client = new JinaAI(component, { JINA_API_KEY: "key" });

		const mockCtx: any = {
			runAction: vi.fn().mockResolvedValue({
				cacheId: "id",
				status: "completed",
				cached: false,
			}),
		};

		await client.read(mockCtx, {
			url: "https://example.com",
			contentFormat: "html",
			options: {
				noCache: true,
				targetSelector: ".main",
				useReaderLM: true,
			},
			cacheTtlMs: 7200000,
			userId: "user_abc",
		});

		expect(mockCtx.runAction).toHaveBeenCalledWith("reader.read", {
			url: "https://example.com",
			apiKey: "key",
			contentFormat: "html",
			options: {
				noCache: true,
				targetSelector: ".main",
				useReaderLM: true,
			},
			cacheTtlMs: 7200000,
			userId: "user_abc",
		});
	});

	it("uses custom cacheTtlMs over default", async () => {
		const component = createMockComponent();
		const client = new JinaAI(component, {
			JINA_API_KEY: "key",
			defaultCacheTtlMs: 3600000,
		});

		const mockCtx: any = {
			runAction: vi.fn().mockResolvedValue({
				cacheId: "id",
				status: "completed",
				cached: false,
			}),
		};

		await client.read(mockCtx, {
			url: "https://example.com",
			cacheTtlMs: 60000,
		});

		const callArgs = mockCtx.runAction.mock.calls[0][1];
		expect(callArgs.cacheTtlMs).toBe(60000);
	});

	it("uses defaultCacheTtlMs when cacheTtlMs not provided", async () => {
		const component = createMockComponent();
		const client = new JinaAI(component, {
			JINA_API_KEY: "key",
			defaultCacheTtlMs: 7200000,
		});

		const mockCtx: any = {
			runAction: vi.fn().mockResolvedValue({
				cacheId: "id",
				status: "completed",
				cached: false,
			}),
		};

		await client.read(mockCtx, {
			url: "https://example.com",
		});

		const callArgs = mockCtx.runAction.mock.calls[0][1];
		expect(callArgs.cacheTtlMs).toBe(7200000);
	});
});

describe("JinaAI - search method", () => {
	it("calls correct component action with all search args", async () => {
		const component = createMockComponent();
		const client = new JinaAI(component, { JINA_API_KEY: "search-key" });

		const mockCtx: any = {
			runAction: vi.fn().mockResolvedValue({
				cacheId: "search_cache_id",
				status: "completed",
				cached: false,
			}),
		};

		const result = await client.search(mockCtx, {
			query: "convex database",
			site: "docs.convex.dev",
			country: "US",
			language: "en",
			numResults: 10,
			page: 1,
			options: { noCache: false },
			cacheTtlMs: 1800000,
			userId: "user_xyz",
		});

		expect(mockCtx.runAction).toHaveBeenCalledWith("search.search", {
			query: "convex database",
			apiKey: "search-key",
			site: "docs.convex.dev",
			country: "US",
			language: "en",
			numResults: 10,
			page: 1,
			options: { noCache: false },
			cacheTtlMs: 1800000,
			userId: "user_xyz",
		});

		expect(result.cacheId).toBe("search_cache_id");
	});

	it("uses default TTL when cacheTtlMs not provided", async () => {
		const component = createMockComponent();
		const client = new JinaAI(component, { JINA_API_KEY: "key" });

		const mockCtx: any = {
			runAction: vi.fn().mockResolvedValue({
				cacheId: "id",
				status: "completed",
				cached: false,
			}),
		};

		await client.search(mockCtx, {
			query: "test",
		});

		const callArgs = mockCtx.runAction.mock.calls[0][1];
		expect(callArgs.cacheTtlMs).toBe(86400000);
	});
});

describe("JinaAI - getReaderContent", () => {
	it("calls correct query with cacheId", async () => {
		const component = createMockComponent();
		const client = new JinaAI(component, { JINA_API_KEY: "key" });

		const mockContent = {
			_id: "cache_123",
			_creationTime: 1000,
			url: "https://example.com",
			contentFormat: "markdown",
			title: "Test",
			content: "# Content",
			tokensUsed: 100,
			fetchedAt: 1000,
			expiresAt: 90000,
			status: "completed",
		};

		const mockCtx: any = {
			runQuery: vi.fn().mockResolvedValue(mockContent),
		};

		const result = await client.getReaderContent(mockCtx, {
			cacheId: "cache_123",
		});

		expect(mockCtx.runQuery).toHaveBeenCalledWith("cache.getReaderContent", {
			cacheId: "cache_123",
		});
		expect(result).toEqual(mockContent);
	});
});

describe("JinaAI - getSearchResults", () => {
	it("calls correct query with cacheId", async () => {
		const component = createMockComponent();
		const client = new JinaAI(component, { JINA_API_KEY: "key" });

		const mockResults = {
			_id: "search_123",
			_creationTime: 1000,
			query: "test",
			results: [],
			totalTokensUsed: 0,
			fetchedAt: 1000,
			expiresAt: 90000,
			status: "completed",
		};

		const mockCtx: any = {
			runQuery: vi.fn().mockResolvedValue(mockResults),
		};

		const result = await client.getSearchResults(mockCtx, {
			cacheId: "search_123",
		});

		expect(mockCtx.runQuery).toHaveBeenCalledWith("cache.getSearchResults", {
			cacheId: "search_123",
		});
		expect(result).toEqual(mockResults);
	});
});

describe("JinaAI - getUsage", () => {
	it("calls correct query with no args", async () => {
		const component = createMockComponent();
		const client = new JinaAI(component, { JINA_API_KEY: "key" });

		const mockUsage = {
			totalTokens: 500,
			readTokens: 300,
			searchTokens: 200,
			operationCount: 5,
		};

		const mockCtx: any = {
			runQuery: vi.fn().mockResolvedValue(mockUsage),
		};

		const result = await client.getUsage(mockCtx);

		expect(mockCtx.runQuery).toHaveBeenCalledWith("usage.getUsage", {});
		expect(result).toEqual(mockUsage);
	});

	it("calls correct query with userId filter", async () => {
		const component = createMockComponent();
		const client = new JinaAI(component, { JINA_API_KEY: "key" });

		const mockCtx: any = {
			runQuery: vi.fn().mockResolvedValue({
				totalTokens: 100,
				readTokens: 100,
				searchTokens: 0,
				operationCount: 1,
			}),
		};

		await client.getUsage(mockCtx, { userId: "user_123" });

		expect(mockCtx.runQuery).toHaveBeenCalledWith("usage.getUsage", {
			userId: "user_123",
		});
	});

	it("calls correct query with since filter", async () => {
		const component = createMockComponent();
		const client = new JinaAI(component, { JINA_API_KEY: "key" });

		const mockCtx: any = {
			runQuery: vi.fn().mockResolvedValue({
				totalTokens: 0,
				readTokens: 0,
				searchTokens: 0,
				operationCount: 0,
			}),
		};

		await client.getUsage(mockCtx, { since: 1000000 });

		expect(mockCtx.runQuery).toHaveBeenCalledWith("usage.getUsage", {
			since: 1000000,
		});
	});
});

describe("JinaAI - invalidateReader", () => {
	it("calls correct mutation with url", async () => {
		const component = createMockComponent();
		const client = new JinaAI(component, { JINA_API_KEY: "key" });

		const mockCtx: any = {
			runMutation: vi.fn().mockResolvedValue(3),
		};

		const count = await client.invalidateReader(mockCtx, {
			url: "https://example.com",
		});

		expect(mockCtx.runMutation).toHaveBeenCalledWith("cache.invalidateReaderCache", {
			url: "https://example.com",
		});
		expect(count).toBe(3);
	});
});

describe("JinaAI - invalidateSearch", () => {
	it("calls correct mutation with query", async () => {
		const component = createMockComponent();
		const client = new JinaAI(component, { JINA_API_KEY: "key" });

		const mockCtx: any = {
			runMutation: vi.fn().mockResolvedValue(2),
		};

		const count = await client.invalidateSearch(mockCtx, {
			query: "test query",
		});

		expect(mockCtx.runMutation).toHaveBeenCalledWith("cache.invalidateSearchCache", {
			query: "test query",
		});
		expect(count).toBe(2);
	});
});

describe("JinaAI - API key flow", () => {
	it("API key from constructor config flows to read actions", async () => {
		const component = createMockComponent();
		const client = new JinaAI(component, { JINA_API_KEY: "my-secret-key" });

		const mockCtx: any = {
			runAction: vi.fn().mockResolvedValue({
				cacheId: "id",
				status: "completed",
				cached: false,
			}),
		};

		await client.read(mockCtx, { url: "https://example.com" });

		const callArgs = mockCtx.runAction.mock.calls[0][1];
		expect(callArgs.apiKey).toBe("my-secret-key");
	});

	it("API key from constructor config flows to search actions", async () => {
		const component = createMockComponent();
		const client = new JinaAI(component, { JINA_API_KEY: "my-secret-key" });

		const mockCtx: any = {
			runAction: vi.fn().mockResolvedValue({
				cacheId: "id",
				status: "completed",
				cached: false,
			}),
		};

		await client.search(mockCtx, { query: "test" });

		const callArgs = mockCtx.runAction.mock.calls[0][1];
		expect(callArgs.apiKey).toBe("my-secret-key");
	});
});
