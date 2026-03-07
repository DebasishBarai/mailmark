import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const keys = await ctx.db
      .query("api_keys")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    return keys.filter((k) => k.revokedAt === undefined);
  },
});

export const revoke = mutation({
  args: { id: v.id("api_keys") },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const key = await ctx.db.get(id);
    if (!key || key.userId !== user._id) throw new Error("Not found");

    await ctx.db.patch(id, { revokedAt: Date.now() });
  },
});

export const insert = internalMutation({
  args: {
    userId: v.id("users"),
    domainId: v.id("domains"),
    name: v.string(),
    keyHash: v.string(),
    keyPrefix: v.string(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("api_keys", { ...args });
  },
});

export const validateByHash = internalQuery({
  args: { keyHash: v.string() },
  handler: async (ctx, { keyHash }) => {
    const key = await ctx.db
      .query("api_keys")
      .withIndex("by_key_hash", (q) => q.eq("keyHash", keyHash))
      .unique();

    if (!key || key.revokedAt !== undefined) return null;
    return key;
  },
});

export const markLastUsed = internalMutation({
  args: { id: v.id("api_keys") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { lastUsedAt: Date.now() });
  },
});
