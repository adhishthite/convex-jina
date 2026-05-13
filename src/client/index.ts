import type {
	GenericActionCtx,
	GenericDataModel,
	GenericMutationCtx,
	GenericQueryCtx,
} from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";

// --- Types ---

export const vReaderOptions = v.object({
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
});

export type ReaderOptions = Infer<typeof vReaderOptions>;

export const vSearchOptions = v.object({
	noCache: v.optional(v.boolean()),
	withLinksSummary: v.optional(v.boolean()),
	withImagesSummary: v.optional(v.boolean()),
	timeout: v.optional(v.number()),
	engine: v.optional(v.string()),
});

export type SearchOptions = Infer<typeof vSearchOptions>;

export const vContentFormat = v.union(v.literal("markdown"), v.literal("html"), v.literal("text"));

export type ContentFormat = Infer<typeof vContentFormat>;

export const vReadArgs = v.object({
	url: v.string(),
	contentFormat: v.optional(vContentFormat),
	options: v.optional(vReaderOptions),
	cacheTtlMs: v.optional(v.number()),
	userId: v.optional(v.string()),
});

export type ReadArgs = Infer<typeof vReadArgs>;

export const vSearchArgs = v.object({
	query: v.string(),
	site: v.optional(v.string()),
	country: v.optional(v.string()),
	language: v.optional(v.string()),
	numResults: v.optional(v.number()),
	page: v.optional(v.number()),
	options: v.optional(vSearchOptions),
	cacheTtlMs: v.optional(v.number()),
	userId: v.optional(v.string()),
});

export type SearchArgs = Infer<typeof vSearchArgs>;

export const vReadResult = v.object({
	cacheId: v.string(),
	status: v.string(),
	cached: v.boolean(),
});

export type ReadResult = Infer<typeof vReadResult>;

export const vSearchResult = v.object({
	cacheId: v.string(),
	status: v.string(),
	cached: v.boolean(),
});

export type SearchResult = Infer<typeof vSearchResult>;

export const vReaderContent = v.union(
	v.object({
		_id: v.string(),
		_creationTime: v.number(),
		url: v.string(),
		contentFormat: v.string(),
		title: v.optional(v.string()),
		description: v.optional(v.string()),
		content: v.string(),
		images: v.optional(v.any()),
		links: v.optional(v.any()),
		tokensUsed: v.number(),
		fetchedAt: v.number(),
		expiresAt: v.number(),
		status: v.string(),
		error: v.optional(v.string()),
	}),
	v.null(),
);

export type ReaderContent = Infer<typeof vReaderContent>;

export const vSearchResultEntry = v.object({
	title: v.string(),
	description: v.string(),
	url: v.string(),
	content: v.string(),
	tokensUsed: v.number(),
});

export type SearchResultEntry = Infer<typeof vSearchResultEntry>;

export const vSearchCacheEntry = v.union(
	v.object({
		_id: v.string(),
		_creationTime: v.number(),
		query: v.string(),
		site: v.optional(v.string()),
		results: v.array(vSearchResultEntry),
		totalTokensUsed: v.number(),
		fetchedAt: v.number(),
		expiresAt: v.number(),
		status: v.string(),
		error: v.optional(v.string()),
	}),
	v.null(),
);

export type SearchCacheEntry = Infer<typeof vSearchCacheEntry>;

export const vUsageArgs = v.object({
	userId: v.optional(v.string()),
	since: v.optional(v.number()),
});

export type UsageArgs = Infer<typeof vUsageArgs>;

export const vUsageSummary = v.object({
	totalTokens: v.number(),
	readTokens: v.number(),
	searchTokens: v.number(),
	operationCount: v.number(),
});

export type UsageSummary = Infer<typeof vUsageSummary>;

export const vGetByCacheIdArgs = v.object({
	cacheId: v.string(),
});

export type GetByCacheIdArgs = Infer<typeof vGetByCacheIdArgs>;

export const vInvalidateReaderArgs = v.object({
	url: v.string(),
});

export type InvalidateReaderArgs = Infer<typeof vInvalidateReaderArgs>;

export const vInvalidateSearchArgs = v.object({
	query: v.string(),
});

export type InvalidateSearchArgs = Infer<typeof vInvalidateSearchArgs>;

// --- Context type helpers ---

type QueryCtx = Pick<GenericQueryCtx<GenericDataModel>, "runQuery">;
type MutationCtx = Pick<GenericMutationCtx<GenericDataModel>, "runQuery" | "runMutation">;
type ActionCtx = Pick<GenericActionCtx<GenericDataModel>, "runQuery" | "runMutation" | "runAction">;

// --- JinaAI Client Class ---

export class JinaAI {
	private apiKey: string;
	private defaultCacheTtlMs: number;
	private component: any;

	constructor(
		component: any,
		options?: {
			JINA_API_KEY?: string;
			defaultCacheTtlMs?: number;
		},
	) {
		this.component = component;
		this.apiKey = options?.JINA_API_KEY ?? process.env.JINA_API_KEY!;
		this.defaultCacheTtlMs = options?.defaultCacheTtlMs ?? 24 * 60 * 60 * 1000;
	}

	/**
	 * Read a URL and convert it to clean markdown/HTML/text content.
	 * Results are cached automatically with configurable TTL.
	 */
	async read(ctx: ActionCtx, args: ReadArgs): Promise<ReadResult> {
		return await ctx.runAction(this.component.reader.read, {
			url: args.url,
			apiKey: this.apiKey,
			contentFormat: args.contentFormat,
			options: args.options,
			cacheTtlMs: args.cacheTtlMs ?? this.defaultCacheTtlMs,
			userId: args.userId,
		});
	}

	/**
	 * Get cached reader content by cache ID.
	 * Reactive: updates automatically when the read completes.
	 */
	async getReaderContent(ctx: QueryCtx, args: GetByCacheIdArgs): Promise<ReaderContent> {
		return await ctx.runQuery(this.component.cache.getReaderContent, {
			cacheId: args.cacheId,
		});
	}

	/**
	 * Search the web via Jina Search API.
	 * Results are cached automatically with configurable TTL.
	 */
	async search(ctx: ActionCtx, args: SearchArgs): Promise<SearchResult> {
		return await ctx.runAction(this.component.search.search, {
			query: args.query,
			apiKey: this.apiKey,
			site: args.site,
			country: args.country,
			language: args.language,
			numResults: args.numResults,
			page: args.page,
			options: args.options,
			cacheTtlMs: args.cacheTtlMs ?? this.defaultCacheTtlMs,
			userId: args.userId,
		});
	}

	/**
	 * Get cached search results by cache ID.
	 * Reactive: updates automatically when the search completes.
	 */
	async getSearchResults(ctx: QueryCtx, args: GetByCacheIdArgs): Promise<SearchCacheEntry> {
		return await ctx.runQuery(this.component.cache.getSearchResults, {
			cacheId: args.cacheId,
		});
	}

	/**
	 * Get usage statistics (total tokens, operation counts).
	 */
	async getUsage(ctx: QueryCtx, args?: UsageArgs): Promise<UsageSummary> {
		return await ctx.runQuery(this.component.usage.getUsage, args ?? {});
	}

	/**
	 * Invalidate cached reader content for a URL.
	 * Returns the number of cache entries removed.
	 */
	async invalidateReader(ctx: MutationCtx, args: InvalidateReaderArgs): Promise<number> {
		return await ctx.runMutation(this.component.cache.invalidateReaderCache, {
			url: args.url,
		});
	}

	/**
	 * Invalidate cached search results for a query.
	 * Returns the number of cache entries removed.
	 */
	async invalidateSearch(ctx: MutationCtx, args: InvalidateSearchArgs): Promise<number> {
		return await ctx.runMutation(this.component.cache.invalidateSearchCache, {
			query: args.query,
		});
	}
}
