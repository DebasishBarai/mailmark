import { v } from "convex/values";
import { query, internalMutation, internalQuery } from "./_generated/server";

// ── Queries ──

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

    return await ctx.db
      .query("domains")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const getById = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const domain = await ctx.db.get(domainId);
    if (!domain) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || domain.userId !== user._id) return null;

    return domain;
  },
});

// ── Internal helpers ──

export const getDomainByName = internalQuery({
  args: { domain: v.string() },
  handler: async (ctx, { domain }) => {
    return await ctx.db
      .query("domains")
      .withIndex("by_domain", (q) => q.eq("domain", domain))
      .unique();
  },
});

export const insertDomain = internalMutation({
  args: {
    userId: v.id("users"),
    domain: v.string(),
    sesVerificationToken: v.optional(v.string()),
    sesDkimTokens: v.optional(v.array(v.string())),
    awsAccountId: v.optional(v.id("awsAccounts")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("domains", {
      userId: args.userId,
      domain: args.domain,
      verified: false,
      mxVerified: false,
      spfVerified: false,
      dkimVerified: false,
      dmarcVerified: false,
      sesVerificationToken: args.sesVerificationToken,
      sesDkimTokens: args.sesDkimTokens,
      awsAccountId: args.awsAccountId,
    });
  },
});

// Fetch the awsAccounts row for a domain, if any. Returns null for
// platform-hosted domains (awsAccountId unset).
export const getAwsAccountForDomain = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    const domain = await ctx.db.get(domainId);
    if (!domain?.awsAccountId) return null;
    return await ctx.db.get(domain.awsAccountId);
  },
});

// Look up the AWS account for a domain-by-name. Used by operations that
// only have an S3 key (which starts with `{domain}/...`) to figure out
// which AWS account owns the object.
export const getAwsAccountByDomainName = internalQuery({
  args: { domain: v.string() },
  handler: async (ctx, { domain }) => {
    const row = await ctx.db
      .query("domains")
      .withIndex("by_domain", (q) => q.eq("domain", domain))
      .unique();
    if (!row?.awsAccountId) return null;
    return await ctx.db.get(row.awsAccountId);
  },
});

export const updateVerification = internalMutation({
  args: {
    domainId: v.id("domains"),
    verified: v.boolean(),
    mxVerified: v.boolean(),
    spfVerified: v.boolean(),
    dkimVerified: v.boolean(),
    dmarcVerified: v.boolean(),
    dkimRecordStatus: v.optional(v.array(v.boolean())),
    actualMxValue: v.optional(v.string()),
    actualSpfValue: v.optional(v.string()),
    actualDmarcValue: v.optional(v.string()),
    mailFromMxVerified: v.optional(v.boolean()),
    mailFromSpfVerified: v.optional(v.boolean()),
  },
  handler: async (ctx, { domainId, ...status }) => {
    await ctx.db.patch(domainId, status);
  },
});

export const markReceiptRuleCreated = internalMutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    await ctx.db.patch(domainId, { sesReceiptRuleCreated: true });
  },
});

export const listForCurrentUserInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("domains")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getUserByClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
  },
});

export const getByIdInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    return await ctx.db.get(domainId);
  },
});

export const deleteDomainCascade = internalMutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    // Delete all mailboxes for this domain
    const mailboxes = await ctx.db
      .query("mailboxes")
      .withIndex("by_domain_id", (q) => q.eq("domainId", domainId))
      .collect();

    for (const mb of mailboxes) {
      const emails = await ctx.db
        .query("emails")
        .withIndex("by_mailbox_folder", (q) => q.eq("mailboxId", mb._id))
        .collect();

      for (const email of emails) {
        await ctx.db.delete(email._id);
      }

      await ctx.db.delete(mb._id);
    }

    await ctx.db.delete(domainId);
  },
});

export const listUnverifiedOlderThan = internalQuery({
  args: { cutoffTime: v.number() },
  handler: async (ctx, { cutoffTime }) => {
    return await ctx.db
      .query("domains")
      .filter((q) =>
        q.and(
          q.eq(q.field("verified"), false),
          q.lt(q.field("_creationTime"), cutoffTime)
        )
      )
      .collect();
  },
});
