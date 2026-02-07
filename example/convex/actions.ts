"use node";

import { v } from "convex/values";
import { components } from "./_generated/api";
import { action } from "./_generated/server";

/**
 * Example action demonstrating how to use the Jina Reader component.
 *
 * Fetches content from a URL and returns the extracted markdown/JSON.
 */
export const readUrl = action({
	args: {
		url: v.string(),
		json: v.optional(v.boolean()),
	},
	returns: v.object({
		content: v.string(),
		title: v.string(),
		description: v.string(),
		url: v.string(),
		links: v.optional(v.record(v.string(), v.string())),
		images: v.optional(v.record(v.string(), v.string())),
		tokens: v.optional(v.number()),
	}),
	handler: async (ctx, args) => {
		// Call the Jina Reader action from the component
		const result = await ctx.runAction(components.jina.reader.read, {
			url: args.url,
			json: args.json ?? false,
		});

		return result;
	},
});

/**
 * Example action demonstrating how to use the Jina Search component.
 *
 * Performs a web search and returns structured results.
 */
export const searchWeb = action({
	args: {
		query: v.string(),
		count: v.optional(v.number()),
	},
	returns: v.object({
		results: v.union(
			v.array(
				v.object({
					title: v.string(),
					description: v.string(),
					url: v.string(),
					content: v.string(),
				}),
			),
			v.string(),
		),
		count: v.number(),
	}),
	handler: async (ctx, args) => {
		// Call the Jina Search action from the component
		const result = await ctx.runAction(components.jina.search.search, {
			query: args.query,
			json: true,
			count: args.count ?? 5,
		});

		return result;
	},
});

/**
 * Example action demonstrating advanced Reader options.
 *
 * Extracts content from a specific selector on a page.
 */
export const readWithSelector = action({
	args: {
		url: v.string(),
		targetSelector: v.string(),
	},
	returns: v.object({
		content: v.string(),
		title: v.string(),
		description: v.string(),
		url: v.string(),
		links: v.optional(v.record(v.string(), v.string())),
		images: v.optional(v.record(v.string(), v.string())),
		tokens: v.optional(v.number()),
	}),
	handler: async (ctx, args) => {
		const result = await ctx.runAction(components.jina.reader.read, {
			url: args.url,
			targetSelector: args.targetSelector,
			json: true,
		});

		return result;
	},
});
