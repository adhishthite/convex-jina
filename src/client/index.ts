import type {
	GenericActionCtx,
	GenericDataModel,
	GenericMutationCtx,
	GenericQueryCtx,
} from "convex/server";

// --- Types ---

export type ReaderOptions = {
	noCache?: boolean;
	targetSelector?: string;
	removeSelector?: string;
	waitForSelector?: string;
	withLinksSummary?: boolean;
	withImagesSummary?: boolean;
	timeout?: number;
	tokenBudget?: number;
	engine?: string;
	useReaderLM?: boolean;
	retainImages?: boolean;
};

export type SearchOptions = {
	noCache?: boolean;
	withLinksSummary?: boolean;
	withImagesSummary?: boolean;
	timeout?: number;
	engine?: string;
};

export type ReadArgs = {
	url: string;
	contentFormat?: "markdown" | "html" | "text";
	options?: ReaderOptions;
	cacheTtlMs?: number;
	userId?: string;
};

export type SearchArgs = {
	query: string;
	site?: string;
	country?: string;
	language?: string;
	numResults?: number;
	page?: number;
	options?: SearchOptions;
	cacheTtlMs?: number;
	userId?: string;
};

export type ReadResult = {
	cacheId: string;
	status: string;
	cached: boolean;
};

export type SearchResult = {
	cacheId: string;
	status: string;
	cached: boolean;
};

export type ReaderContent = {
	_id: string;
	_creationTime: number;
	url: string;
	contentFormat: string;
	title?: string;
	description?: string;
	content: string;
	images?: any;
	links?: any;
	tokensUsed: number;
	fetchedAt: number;
	expiresAt: number;
	status: string;
	error?: string;
} | null;

export type SearchResultEntry = {
	title: string;
	description: string;
	url: string;
	content: string;
	tokensUsed: number;
};

export type SearchCacheEntry = {
	_id: string;
	_creationTime: number;
	query: string;
	site?: string;
	results: SearchResultEntry[];
	totalTokensUsed: number;
	fetchedAt: number;
	expiresAt: number;
	status: string;
	error?: string;
} | null;

export type UsageSummary = {
	totalTokens: number;
	readTokens: number;
	searchTokens: number;
	operationCount: number;
};

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
	async getReaderContent(ctx: QueryCtx, args: { cacheId: string }): Promise<ReaderContent> {
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
	async getSearchResults(ctx: QueryCtx, args: { cacheId: string }): Promise<SearchCacheEntry> {
		return await ctx.runQuery(this.component.cache.getSearchResults, {
			cacheId: args.cacheId,
		});
	}

	/**
	 * Get usage statistics (total tokens, operation counts).
	 */
	async getUsage(ctx: QueryCtx, args?: { userId?: string; since?: number }): Promise<UsageSummary> {
		return await ctx.runQuery(this.component.usage.getUsage, args ?? {});
	}

	/**
	 * Invalidate cached reader content for a URL.
	 * Returns the number of cache entries removed.
	 */
	async invalidateReader(ctx: MutationCtx, args: { url: string }): Promise<number> {
		return await ctx.runMutation(this.component.cache.invalidateReaderCache, {
			url: args.url,
		});
	}

	/**
	 * Invalidate cached search results for a query.
	 * Returns the number of cache entries removed.
	 */
	async invalidateSearch(ctx: MutationCtx, args: { query: string }): Promise<number> {
		return await ctx.runMutation(this.component.cache.invalidateSearchCache, {
			query: args.query,
		});
	}
}
