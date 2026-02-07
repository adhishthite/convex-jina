import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	readerCache: defineTable({
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
	})
		.index("by_url", ["url", "contentFormat"])
		.index("by_status", ["status"])
		.index("by_expiry", ["expiresAt"]),

	searchCache: defineTable({
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
	})
		.index("by_query", ["query", "site"])
		.index("by_status", ["status"])
		.index("by_expiry", ["expiresAt"]),

	usage: defineTable({
		operation: v.string(),
		tokensUsed: v.number(),
		timestamp: v.number(),
		url: v.optional(v.string()),
		query: v.optional(v.string()),
		userId: v.optional(v.string()),
	})
		.index("by_operation", ["operation", "timestamp"])
		.index("by_user", ["userId", "timestamp"]),
});
