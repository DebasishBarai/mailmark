/**
 * User-provided AWS accounts for BYO (bring-your-own) email infrastructure.
 *
 * This file holds the queries and mutations. The actions that call AWS
 * (AssumeRole, GetCallerIdentity, SES GetAccount) live in
 * `awsAccountActions.ts` because they need the Node runtime.
 */

import { v } from "convex/values";
import { internalQuery, internalMutation, query, mutation } from "./_generated/server";

// ── Queries ──────────────────────────────────────────────────────────────────

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

    const rows = await ctx.db
      .query("awsAccounts")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    // Never return secrets to the client
    return rows.map((r) => ({
      _id: r._id,
      alias: r.alias,
      region: r.region,
      s3Bucket: r.s3Bucket,
      roleArn: r.roleArn,
      awsAccountId: r.awsAccountId,
      sesSandbox: r.sesSandbox,
      status: r.status,
      lastError: r.lastError,
      lastVerifiedAt: r.lastVerifiedAt,
      externalId: r.externalId,
      _creationTime: r._creationTime,
    }));
  },
});

export const getByIdInternal = internalQuery({
  args: { accountId: v.id("awsAccounts") },
  handler: async (ctx, { accountId }) => {
    return await ctx.db.get(accountId);
  },
});

export const getByWebhookSecretInternal = internalQuery({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    return await ctx.db
      .query("awsAccounts")
      .withIndex("by_webhook_secret", (q) => q.eq("webhookSecret", secret))
      .unique();
  },
});

export const listDomainsUsingAccount = internalQuery({
  args: { accountId: v.id("awsAccounts") },
  handler: async (ctx, { accountId }) => {
    return await ctx.db
      .query("domains")
      .withIndex("by_aws_account", (q) => q.eq("awsAccountId", accountId))
      .collect();
  },
});

// ── Internal mutations ───────────────────────────────────────────────────────

export const insertDraft = internalMutation({
  args: {
    userId: v.id("users"),
    alias: v.string(),
    externalId: v.string(),
    webhookSecret: v.string(),
    region: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("awsAccounts", {
      userId: args.userId,
      alias: args.alias,
      externalId: args.externalId,
      webhookSecret: args.webhookSecret,
      region: args.region,
      roleArn: "",
      s3Bucket: "",
      status: "pending",
    });
  },
});

export const patchAccount = internalMutation({
  args: {
    accountId: v.id("awsAccounts"),
    alias: v.optional(v.string()),
    roleArn: v.optional(v.string()),
    s3Bucket: v.optional(v.string()),
    awsAccountId: v.optional(v.string()),
    region: v.optional(v.string()),
    sesSandbox: v.optional(v.boolean()),
    status: v.optional(
      v.union(v.literal("pending"), v.literal("verified"), v.literal("failed"))
    ),
    lastError: v.optional(v.string()),
    lastVerifiedAt: v.optional(v.number()),
  },
  handler: async (ctx, { accountId, ...patch }) => {
    await ctx.db.patch(accountId, patch);
  },
});

export const deleteAccount = internalMutation({
  args: { accountId: v.id("awsAccounts") },
  handler: async (ctx, { accountId }) => {
    await ctx.db.delete(accountId);
  },
});

// ── Public mutation ──────────────────────────────────────────────────────────

/**
 * Disconnect a user-provided AWS account. Refuses if any domain still
 * references it — the user must first delete or reassign those domains.
 *
 * We only delete the Convex row; the user's AWS resources (S3 bucket,
 * Lambda, SES rule set, etc.) stay in their account. They delete the CFN
 * stack themselves when they want the resources gone.
 */
export const remove = mutation({
  args: { accountId: v.id("awsAccounts") },
  handler: async (ctx, { accountId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const account = await ctx.db.get(accountId);
    if (!account || account.userId !== user._id) {
      throw new Error("AWS account not found");
    }

    const domainsUsing = await ctx.db
      .query("domains")
      .withIndex("by_aws_account", (q) => q.eq("awsAccountId", accountId))
      .collect();
    if (domainsUsing.length > 0) {
      throw new Error(
        `Cannot disconnect: ${domainsUsing.length} domain(s) still use this AWS account. Delete or migrate them first.`
      );
    }

    await ctx.db.delete(accountId);
  },
});
