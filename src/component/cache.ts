import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server.js";

// --- Internal queries (called by actions) ---

export const getReaderCache = internalQuery({
	args: {
		url: v.string(),
		contentFormat: v.string(),
	},
	returns: v.union(
		v.object({
			_id: v.id("readerCache"),
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
	),
	handler: async (ctx, args) => {
		const cached = await (ctx.db.query("readerCache") as any)
			.withIndex("by_url", (q: any) =>
				q.eq("url", args.url).eq("contentFormat", args.contentFormat),
			)
			.order("desc")
			.first();
		return cached;
	},
});

export const getSearchCache = internalQuery({
	args: {
		query: v.string(),
		site: v.optional(v.string()),
	},
	returns: v.union(
		v.object({
			_id: v.id("searchCache"),
			_creationTime: v.number(),
			query: v.string(),
			site: v.optional(v.string()),
			results: v.array(
				v.object({
					title: v.string(),
					description: v.string(),
					url: v.string(),
					content: v.string(),
					tokensUsed: v.number(),
				}),
			),
			totalTokensUsed: v.number(),
			fetchedAt: v.number(),
			expiresAt: v.number(),
			status: v.string(),
			error: v.optional(v.string()),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		const cached = await (ctx.db.query("searchCache") as any)
			.withIndex("by_query", (q: any) => {
				const base = q.eq("query", args.query);
				return args.site !== undefined ? base.eq("site", args.site) : base;
			})
			.order("desc")
			.first();
		return cached;
	},
});

// --- Internal mutations (called by actions) ---

export const createReaderEntry = internalMutation({
	args: {
		url: v.string(),
		contentFormat: v.string(),
		expiresAt: v.number(),
	},
	returns: v.id("readerCache"),
	handler: async (ctx, args) => {
		return await ctx.db.insert("readerCache", {
			url: args.url,
			contentFormat: args.contentFormat,
			content: "",
			tokensUsed: 0,
			fetchedAt: Date.now(),
			expiresAt: args.expiresAt,
			status: "pending",
		});
	},
});

export const completeReaderEntry = internalMutation({
	args: {
		cacheId: v.id("readerCache"),
		title: v.optional(v.string()),
		description: v.optional(v.string()),
		content: v.string(),
		images: v.optional(v.any()),
		links: v.optional(v.any()),
		tokensUsed: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.patch(args.cacheId, {
			title: args.title,
			description: args.description,
			content: args.content,
			images: args.images,
			links: args.links,
			tokensUsed: args.tokensUsed,
			status: "completed",
			fetchedAt: Date.now(),
		});
	},
});

export const failReaderEntry = internalMutation({
	args: {
		cacheId: v.id("readerCache"),
		error: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.patch(args.cacheId, {
			status: "failed",
			error: args.error,
		});
	},
});

export const createSearchEntry = internalMutation({
	args: {
		query: v.string(),
		site: v.optional(v.string()),
		expiresAt: v.number(),
	},
	returns: v.id("searchCache"),
	handler: async (ctx, args) => {
		return await ctx.db.insert("searchCache", {
			query: args.query,
			site: args.site,
			results: [],
			totalTokensUsed: 0,
			fetchedAt: Date.now(),
			expiresAt: args.expiresAt,
			status: "pending",
		});
	},
});

export const completeSearchEntry = internalMutation({
	args: {
		cacheId: v.id("searchCache"),
		results: v.array(
			v.object({
				title: v.string(),
				description: v.string(),
				url: v.string(),
				content: v.string(),
				tokensUsed: v.number(),
			}),
		),
		totalTokensUsed: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.patch(args.cacheId, {
			results: args.results,
			totalTokensUsed: args.totalTokensUsed,
			status: "completed",
			fetchedAt: Date.now(),
		});
	},
});

export const failSearchEntry = internalMutation({
	args: {
		cacheId: v.id("searchCache"),
		error: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.patch(args.cacheId, {
			status: "failed",
			error: args.error,
		});
	},
});

// --- Public queries (exposed via ComponentApi) ---

export const getReaderContent = query({
	args: {
		cacheId: v.id("readerCache"),
	},
	returns: v.union(
		v.object({
			_id: v.id("readerCache"),
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
	),
	handler: async (ctx, args) => {
		return await ctx.db.get(args.cacheId);
	},
});

export const getSearchResults = query({
	args: {
		cacheId: v.id("searchCache"),
	},
	returns: v.union(
		v.object({
			_id: v.id("searchCache"),
			_creationTime: v.number(),
			query: v.string(),
			site: v.optional(v.string()),
			results: v.array(
				v.object({
					title: v.string(),
					description: v.string(),
					url: v.string(),
					content: v.string(),
					tokensUsed: v.number(),
				}),
			),
			totalTokensUsed: v.number(),
			fetchedAt: v.number(),
			expiresAt: v.number(),
			status: v.string(),
			error: v.optional(v.string()),
		}),
		v.null(),
	),
	handler: async (ctx, args) => {
		return await ctx.db.get(args.cacheId);
	},
});

// --- Public mutations (cache invalidation) ---

export const invalidateReaderCache = mutation({
	args: {
		url: v.string(),
	},
	returns: v.number(),
	handler: async (ctx, args) => {
		const entries = await (ctx.db.query("readerCache") as any)
			.withIndex("by_url", (q: any) => q.eq("url", args.url))
			.collect();
		for (const entry of entries) {
			await ctx.db.delete(entry._id);
		}
		return entries.length;
	},
});

export const invalidateSearchCache = mutation({
	args: {
		query: v.string(),
	},
	returns: v.number(),
	handler: async (ctx, args) => {
		const entries = await (ctx.db.query("searchCache") as any)
			.withIndex("by_query", (q: any) => q.eq("query", args.query))
			.collect();
		for (const entry of entries) {
			await ctx.db.delete(entry._id);
		}
		return entries.length;
	},
});
