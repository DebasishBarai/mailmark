import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
// import { internal } from "./_generated/api";

// const ADMIN_CLERK_ID = "user_2xo2LyEVBp4BWRHM0RdeaZTPJAb";
const DAILY_SEND_LIMIT = 450;

async function requireAdmin(ctx: { auth: { getUserIdentity: () => Promise<{ subject?: string } | null> }; db: any }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || !identity.subject) {
    throw new Error("Admin access required");
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
    .first();
  if (!user || user.category !== "admin") {
    throw new Error("Admin access required");
  }
}

export const addAccount = mutation({
  args: {
    email: v.string(),
    appPassword: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db
      .query("platformWarmupAccounts")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (existing) {
      throw new Error(`Account ${args.email} already exists`);
    }
    return await ctx.db.insert("platformWarmupAccounts", {
      email: args.email,
      provider: "gmail",
      appPassword: args.appPassword,
      status: "active",
      dailySentCount: 0,
      dailyReceivedCount: 0,
      lastResetAt: Date.now(),
    });
  },
});

export const pauseAccount = mutation({
  args: { accountId: v.id("platformWarmupAccounts") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.accountId, { status: "paused" });
  },
});

export const activateAccount = mutation({
  args: { accountId: v.id("platformWarmupAccounts") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.accountId, { status: "active" });
  },
});

export const removeAccount = mutation({
  args: { accountId: v.id("platformWarmupAccounts") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.accountId);
  },
});

export const updateAppPassword = mutation({
  args: {
    accountId: v.id("platformWarmupAccounts"),
    appPassword: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.accountId, {
      appPassword: args.appPassword,
      status: "active",
    });
  },
});

export const listAllAccounts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.subject) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user || user.category !== "admin") return null;
    return await ctx.db.query("platformWarmupAccounts").collect();
  },
});

export const getAvailableAccounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db
      .query("platformWarmupAccounts")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    return accounts
      .filter((a) => a.dailySentCount < DAILY_SEND_LIMIT)
      .sort((a, b) => a.dailySentCount - b.dailySentCount);
  },
});

export const incrementDailySentCount = internalMutation({
  args: { accountId: v.id("platformWarmupAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) return;
    await ctx.db.patch(args.accountId, {
      dailySentCount: account.dailySentCount + 1,
    });
  },
});

export const incrementDailyReceivedCount = internalMutation({
  args: { accountId: v.id("platformWarmupAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) return;
    await ctx.db.patch(args.accountId, {
      dailyReceivedCount: account.dailyReceivedCount + 1,
    });
  },
});

export const resetAllDailyCounts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("platformWarmupAccounts").collect();
    for (const account of accounts) {
      await ctx.db.patch(account._id, {
        dailySentCount: 0,
        dailyReceivedCount: 0,
        lastResetAt: Date.now(),
      });
    }
  },
});

export const getByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("platformWarmupAccounts")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

export const getAccountById = internalQuery({
  args: { accountId: v.id("platformWarmupAccounts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.accountId);
  },
});
