import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api.js";
import schema from "./schema.js";

const modules = import.meta.glob("./**/*.ts");

describe("usage - track", () => {
	it("inserts a usage record with correct fields", async () => {
		const t = convexTest(schema, modules);
		const before = Date.now();

		await t.mutation(internal.usage.track, {
			operation: "read",
			tokensUsed: 150,
			url: "https://example.com",
			userId: "user_123",
		});

		const entries = await t.run(async (ctx) => {
			return await ctx.db.query("usage").collect();
		});

		expect(entries).toHaveLength(1);
		expect(entries[0].operation).toBe("read");
		expect(entries[0].tokensUsed).toBe(150);
		expect(entries[0].url).toBe("https://example.com");
		expect(entries[0].userId).toBe("user_123");
		expect(entries[0].timestamp).toBeGreaterThanOrEqual(before);
	});

	it("handles optional userId, url, query fields", async () => {
		const t = convexTest(schema, modules);

		await t.mutation(internal.usage.track, {
			operation: "search",
			tokensUsed: 75,
		});

		const entries = await t.run(async (ctx) => {
			return await ctx.db.query("usage").collect();
		});

		expect(entries).toHaveLength(1);
		expect(entries[0].userId).toBeUndefined();
		expect(entries[0].url).toBeUndefined();
		expect(entries[0].query).toBeUndefined();
	});

	it("tracks search operation with query field", async () => {
		const t = convexTest(schema, modules);

		await t.mutation(internal.usage.track, {
			operation: "search",
			tokensUsed: 200,
			query: "convex database",
			userId: "user_456",
		});

		const entries = await t.run(async (ctx) => {
			return await ctx.db.query("usage").collect();
		});

		expect(entries).toHaveLength(1);
		expect(entries[0].operation).toBe("search");
		expect(entries[0].query).toBe("convex database");
	});

	it("inserts multiple records independently", async () => {
		const t = convexTest(schema, modules);

		await t.mutation(internal.usage.track, {
			operation: "read",
			tokensUsed: 100,
			url: "https://a.com",
		});

		await t.mutation(internal.usage.track, {
			operation: "search",
			tokensUsed: 200,
			query: "test",
		});

		await t.mutation(internal.usage.track, {
			operation: "read",
			tokensUsed: 50,
			url: "https://b.com",
		});

		const entries = await t.run(async (ctx) => {
			return await ctx.db.query("usage").collect();
		});

		expect(entries).toHaveLength(3);
	});
});

describe("usage - getUsage", () => {
	it("returns correct totals for all operations", async () => {
		const t = convexTest(schema, modules);

		await t.mutation(internal.usage.track, {
			operation: "read",
			tokensUsed: 100,
		});

		await t.mutation(internal.usage.track, {
			operation: "search",
			tokensUsed: 200,
		});

		await t.mutation(internal.usage.track, {
			operation: "read",
			tokensUsed: 50,
		});

		const usage = await t.query(api.usage.getUsage, {});

		expect(usage.totalTokens).toBe(350);
		expect(usage.readTokens).toBe(150);
		expect(usage.searchTokens).toBe(200);
		expect(usage.operationCount).toBe(3);
	});

	it("returns zero for no data", async () => {
		const t = convexTest(schema, modules);

		const usage = await t.query(api.usage.getUsage, {});

		expect(usage.totalTokens).toBe(0);
		expect(usage.readTokens).toBe(0);
		expect(usage.searchTokens).toBe(0);
		expect(usage.operationCount).toBe(0);
	});

	it("filters by userId correctly", async () => {
		const t = convexTest(schema, modules);

		await t.mutation(internal.usage.track, {
			operation: "read",
			tokensUsed: 100,
			userId: "user_a",
		});

		await t.mutation(internal.usage.track, {
			operation: "search",
			tokensUsed: 200,
			userId: "user_b",
		});

		await t.mutation(internal.usage.track, {
			operation: "read",
			tokensUsed: 50,
			userId: "user_a",
		});

		const usageA = await t.query(api.usage.getUsage, { userId: "user_a" });

		expect(usageA.totalTokens).toBe(150);
		expect(usageA.readTokens).toBe(150);
		expect(usageA.searchTokens).toBe(0);
		expect(usageA.operationCount).toBe(2);

		const usageB = await t.query(api.usage.getUsage, { userId: "user_b" });

		expect(usageB.totalTokens).toBe(200);
		expect(usageB.readTokens).toBe(0);
		expect(usageB.searchTokens).toBe(200);
		expect(usageB.operationCount).toBe(1);
	});

	it("filters by since timestamp", async () => {
		const t = convexTest(schema, modules);

		// Insert an old record via direct DB access so we can control timestamp
		await t.run(async (ctx) => {
			await ctx.db.insert("usage", {
				operation: "read",
				tokensUsed: 100,
				timestamp: 1000, // very old
			});
		});

		await t.run(async (ctx) => {
			await ctx.db.insert("usage", {
				operation: "search",
				tokensUsed: 200,
				timestamp: 5000, // newer
			});
		});

		await t.run(async (ctx) => {
			await ctx.db.insert("usage", {
				operation: "read",
				tokensUsed: 50,
				timestamp: 10000, // newest
			});
		});

		const usage = await t.query(api.usage.getUsage, { since: 5000 });

		expect(usage.operationCount).toBe(2);
		expect(usage.totalTokens).toBe(250);
	});

	it("filters by userId and since together", async () => {
		const t = convexTest(schema, modules);

		await t.run(async (ctx) => {
			await ctx.db.insert("usage", {
				operation: "read",
				tokensUsed: 100,
				timestamp: 1000,
				userId: "user_a",
			});
		});

		await t.run(async (ctx) => {
			await ctx.db.insert("usage", {
				operation: "read",
				tokensUsed: 200,
				timestamp: 5000,
				userId: "user_a",
			});
		});

		await t.run(async (ctx) => {
			await ctx.db.insert("usage", {
				operation: "search",
				tokensUsed: 300,
				timestamp: 5000,
				userId: "user_b",
			});
		});

		const usage = await t.query(api.usage.getUsage, {
			userId: "user_a",
			since: 3000,
		});

		expect(usage.operationCount).toBe(1);
		expect(usage.totalTokens).toBe(200);
		expect(usage.readTokens).toBe(200);
	});

	it("separates read vs search tokens correctly", async () => {
		const t = convexTest(schema, modules);

		await t.mutation(internal.usage.track, {
			operation: "read",
			tokensUsed: 111,
		});

		await t.mutation(internal.usage.track, {
			operation: "search",
			tokensUsed: 222,
		});

		await t.mutation(internal.usage.track, {
			operation: "read",
			tokensUsed: 333,
		});

		await t.mutation(internal.usage.track, {
			operation: "search",
			tokensUsed: 444,
		});

		const usage = await t.query(api.usage.getUsage, {});

		expect(usage.readTokens).toBe(444); // 111 + 333
		expect(usage.searchTokens).toBe(666); // 222 + 444
		expect(usage.totalTokens).toBe(1110);
		expect(usage.operationCount).toBe(4);
	});

	it("counts operations correctly across multiple users", async () => {
		const t = convexTest(schema, modules);

		for (let i = 0; i < 5; i++) {
			await t.mutation(internal.usage.track, {
				operation: "read",
				tokensUsed: 10,
				userId: `user_${i % 2}`,
			});
		}

		const allUsage = await t.query(api.usage.getUsage, {});
		expect(allUsage.operationCount).toBe(5);

		const user0 = await t.query(api.usage.getUsage, { userId: "user_0" });
		expect(user0.operationCount).toBe(3); // indices 0, 2, 4

		const user1 = await t.query(api.usage.getUsage, { userId: "user_1" });
		expect(user1.operationCount).toBe(2); // indices 1, 3
	});

	it("usage is isolated per user - no cross-contamination", async () => {
		const t = convexTest(schema, modules);

		await t.mutation(internal.usage.track, {
			operation: "read",
			tokensUsed: 999,
			userId: "user_x",
		});

		const usageY = await t.query(api.usage.getUsage, { userId: "user_y" });
		expect(usageY.totalTokens).toBe(0);
		expect(usageY.operationCount).toBe(0);
	});
});
