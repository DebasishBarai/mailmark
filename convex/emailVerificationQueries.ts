import { v } from "convex/values";
import { query, internalMutation, internalQuery } from "./_generated/server";

// ── Queries ──

export const getVerification = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("emailVerifications")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
      .first();
  },
});

export const getVerifications = query({
  args: { emails: v.array(v.string()) },
  handler: async (ctx, { emails }) => {
    const results: Record<string, {
      isValid: boolean;
      syntaxValid: boolean;
      mxValid: boolean;
      reason?: string;
      checkedAt: number;
    } | null> = {};

    for (const email of emails) {
      const record = await ctx.db
        .query("emailVerifications")
        .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
        .first();
      results[email.toLowerCase()] = record
        ? {
            isValid: record.isValid,
            syntaxValid: record.syntaxValid,
            mxValid: record.mxValid,
            reason: record.reason,
            checkedAt: record.checkedAt,
          }
        : null;
    }

    return results;
  },
});

// ── Internal helpers ──

export const getCachedVerification = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("emailVerifications")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
      .first();
  },
});

export const upsertVerification = internalMutation({
  args: {
    email: v.string(),
    isValid: v.boolean(),
    syntaxValid: v.boolean(),
    mxValid: v.boolean(),
    reason: v.optional(v.string()),
    checkedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("emailVerifications")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        isValid: args.isValid,
        syntaxValid: args.syntaxValid,
        mxValid: args.mxValid,
        reason: args.reason,
        checkedAt: args.checkedAt,
      });
    } else {
      await ctx.db.insert("emailVerifications", args);
    }
  },
});
