import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

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
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiresAt: v.number(),
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
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      tokenExpiresAt: args.tokenExpiresAt,
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

export const updateTokens = mutation({
  args: {
    accountId: v.id("platformWarmupAccounts"),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.accountId, {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      tokenExpiresAt: args.tokenExpiresAt,
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

export const refreshTokenIfNeeded = internalAction({
  args: { accountId: v.id("platformWarmupAccounts") },
  handler: async (ctx, args): Promise<string> => {
    const account = await ctx.runQuery(internal.platformWarmupAccounts.getAccountById, {
      accountId: args.accountId,
    });
    if (!account) throw new Error("Platform warmup account not found");

    if (account.tokenExpiresAt > Date.now() + 5 * 60 * 1000) {
      return account.accessToken;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("Google OAuth credentials not configured");
    }

    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: account.refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!response.ok) {
        await ctx.runMutation(internal.platformWarmupAccounts.markTokenExpired, {
          accountId: args.accountId,
        });
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const data = await response.json() as {
        access_token: string;
        expires_in: number;
      };
      const newExpiresAt = Date.now() + data.expires_in * 1000;

      await ctx.runMutation(internal.platformWarmupAccounts.updateAccessToken, {
        accountId: args.accountId,
        accessToken: data.access_token,
        tokenExpiresAt: newExpiresAt,
      });

      return data.access_token;
    } catch (error) {
      await ctx.runMutation(internal.platformWarmupAccounts.markTokenExpired, {
        accountId: args.accountId,
      });
      throw error;
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

export const updateAccessToken = internalMutation({
  args: {
    accountId: v.id("platformWarmupAccounts"),
    accessToken: v.string(),
    tokenExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.accountId, {
      accessToken: args.accessToken,
      tokenExpiresAt: args.tokenExpiresAt,
    });
  },
});

export const markTokenExpired = internalMutation({
  args: { accountId: v.id("platformWarmupAccounts") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.accountId, { status: "token_expired" });
  },
});
