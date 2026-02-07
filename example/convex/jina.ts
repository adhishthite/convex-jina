import { v } from "convex/values";
import { JinaAI } from "../../src/client/index.js";
import { components } from "./_generated/api.js";
import { action, query } from "./_generated/server.js";

export const readUrl = action({
	args: {
		url: v.string(),
		apiKey: v.string(),
		contentFormat: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const jina = new JinaAI((components as any).jina, {
			JINA_API_KEY: args.apiKey,
		});
		return await jina.read(ctx, {
			url: args.url,
			contentFormat: args.contentFormat as "markdown" | "html" | "text" | undefined,
		});
	},
});

export const searchWeb = action({
	args: {
		query: v.string(),
		apiKey: v.string(),
		site: v.optional(v.string()),
		numResults: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const jina = new JinaAI((components as any).jina, {
			JINA_API_KEY: args.apiKey,
		});
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
		const jina = new JinaAI((components as any).jina);
		return await jina.getReaderContent(ctx, { cacheId: args.cacheId });
	},
});

export const getSearchResults = query({
	args: { cacheId: v.string() },
	handler: async (ctx, args) => {
		const jina = new JinaAI((components as any).jina);
		return await jina.getSearchResults(ctx, { cacheId: args.cacheId });
	},
});

export const getUsage = query({
	args: {},
	handler: async (ctx) => {
		const jina = new JinaAI((components as any).jina);
		return await jina.getUsage(ctx);
	},
});
