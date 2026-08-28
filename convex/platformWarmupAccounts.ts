import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import type { DatabaseWriter } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
// import { internal } from "./_generated/api";

// const ADMIN_CLERK_ID = "user_2xo2LyEVBp4BWRHM0RdeaZTPJAb";
const DAILY_SEND_LIMIT = 450;

// Consecutive SMTP/IMAP failures before an account is pulled out of rotation.
// Gmail drops the occasional connection, so one failure is not a verdict, but
// a third in a row means the account is not usable and every further round is
// just noise against a dead credential.
const MAX_CONSECUTIVE_FAILURES = 3;

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
    // await ctx.db.patch(args.accountId, { status: "active" });
    // Clear the failure trail too, otherwise an account that was auto-paused
    // comes back one failure away from being paused again.
    await ctx.db.patch(args.accountId, {
      status: "active",
      consecutiveFailures: 0,
      autoPausedAt: undefined,
    });
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
      consecutiveFailures: 0,
      autoPausedAt: undefined,
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

// Admin view of whether the pool can actually carry what is enrolled.
export const getPoolCapacity = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !identity.subject) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user || user.category !== "admin") return null;

    const accounts = await ctx.db.query("platformWarmupAccounts").collect();
    const activeAccounts = accounts.filter((a) => a.status === "active").length;

    const warming = await ctx.db
      .query("warmupMailboxes")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    // A mailbox at full ramp needs 20 emails a day from the pool, plus the
    // replies engagement generates on roughly a fifth of what it sends.
    const perMailboxPerDay = 20 * (1 + 0.85 * 0.25);
    const neededSends = Math.ceil(warming.length * perMailboxPerDay);
    const capacity = activeAccounts * DAILY_SEND_LIMIT;

    return {
      activeAccounts,
      totalAccounts: accounts.length,
      warmingMailboxes: warming.length,
      neededSendsAtFullRamp: neededSends,
      capacity,
      // One account is enough volume for about 18 mailboxes, but it is also a
      // single point of failure: if it is paused, every warming mailbox on the
      // platform stops at once.
      hasRedundancy: activeAccounts >= 2,
      overCapacity: neededSends > capacity,
    };
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

// Called by the warmup Gmail actions when an SMTP or IMAP call against this
// account fails. Credential failures are fatal on the first occurrence: a
// revoked app password does not come back on its own, and retrying it every 30
// minutes only risks Google flagging the account further.
// Shared with warmupPool, which reaches the same conclusion from the other
// direction: a warmup send that hard bounced means this Gmail address is gone.
// A mutation cannot call another mutation, so the logic lives here as a plain
// helper over the database writer.
export async function applyAccountFailure(
  db: DatabaseWriter,
  accountId: Id<"platformWarmupAccounts">,
  reason: string,
  fatal?: boolean
) {
  const account = await db.get(accountId);
  if (!account) return;

  const failures = (account.consecutiveFailures ?? 0) + 1;
  const shouldPause =
    account.status === "active" &&
    (fatal === true || failures >= MAX_CONSECUTIVE_FAILURES);

  await db.patch(accountId, {
    consecutiveFailures: failures,
    lastFailureAt: Date.now(),
    lastFailureReason: reason.slice(0, 300),
    ...(shouldPause ? { status: "paused" as const, autoPausedAt: Date.now() } : {}),
  });

  if (shouldPause) {
    console.error(
      `Warmup account ${account.email} auto-paused after ${failures} consecutive failure(s): ${reason}`
    );
  }
}

export const recordAccountFailure = internalMutation({
  args: {
    accountId: v.id("platformWarmupAccounts"),
    reason: v.string(),
    fatal: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await applyAccountFailure(ctx.db, args.accountId, args.reason, args.fatal);
  },
});

// Called after an SMTP send or IMAP session succeeds. Only writes when there is
// something to clear, so the happy path stays a single read.
export const recordAccountSuccess = internalMutation({
  args: { accountId: v.id("platformWarmupAccounts") },
  handler: async (ctx, args) => {
    const account = await ctx.db.get(args.accountId);
    if (!account) return;
    if (!account.consecutiveFailures) return;
    await ctx.db.patch(args.accountId, { consecutiveFailures: 0 });
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
