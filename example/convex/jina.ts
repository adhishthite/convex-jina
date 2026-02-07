import { v } from "convex/values";
import { JinaAI } from "../../src/client/index.js";
import { action, components, query } from "./_generated/server.js";

const jina = new JinaAI((components as any).jina, {
	JINA_API_KEY: process.env.JINA_API_KEY,
});

export const readUrl = action({
	args: {
		url: v.string(),
		contentFormat: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		return await jina.read(ctx, {
			url: args.url,
			contentFormat: args.contentFormat as "markdown" | "html" | "text" | undefined,
		});
	},
});

export const searchWeb = action({
	args: {
		query: v.string(),
		site: v.optional(v.string()),
		numResults: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		return await jina.search(ctx, {
			query: args.query,
			site: args.site,
			numResults: args.numResults,
		});
	},
});

export const getReaderContent = query({
	args: { cacheId: v.string() },
	handler: async (ctx, args) => {
		return await jina.getReaderContent(ctx, { cacheId: args.cacheId });
	},
});

export const getSearchResults = query({
	args: { cacheId: v.string() },
	handler: async (ctx, args) => {
		return await jina.getSearchResults(ctx, { cacheId: args.cacheId });
	},
});

export const getUsage = query({
	args: {},
	handler: async (ctx) => {
		return await jina.getUsage(ctx);
	},
});
