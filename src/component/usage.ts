import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server.js";

export const track = internalMutation({
	args: {
		operation: v.string(),
		tokensUsed: v.number(),
		url: v.optional(v.string()),
		query: v.optional(v.string()),
		userId: v.optional(v.string()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.insert("usage", {
			operation: args.operation,
			tokensUsed: args.tokensUsed,
			timestamp: Date.now(),
			url: args.url,
			query: args.query,
			userId: args.userId,
		});
	},
});

export const getUsage = query({
	args: {
		userId: v.optional(v.string()),
		since: v.optional(v.number()),
	},
	returns: v.object({
		totalTokens: v.number(),
		readTokens: v.number(),
		searchTokens: v.number(),
		operationCount: v.number(),
	}),
	handler: async (ctx, args) => {
		let entries: any[];

		if (args.userId) {
			entries = await (ctx.db.query("usage") as any)
				.withIndex("by_user", (q: any) => {
					const base = q.eq("userId", args.userId);
					return args.since !== undefined ? base.gte("timestamp", args.since) : base;
				})
				.collect();
		} else {
			entries = await ctx.db.query("usage").collect();
			if (args.since !== undefined) {
				entries = entries.filter((e) => e.timestamp >= args.since!);
			}
		}

		let readTokens = 0;
		let searchTokens = 0;
		for (const entry of entries) {
			if (entry.operation === "read") {
				readTokens += entry.tokensUsed;
			} else if (entry.operation === "search") {
				searchTokens += entry.tokensUsed;
			}
		}

		return {
			totalTokens: readTokens + searchTokens,
			readTokens,
			searchTokens,
			operationCount: entries.length,
		};
	},
});
