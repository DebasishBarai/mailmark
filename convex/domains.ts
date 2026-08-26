import { v } from "convex/values";
import {
  buildDomainPendingNotice,
  noticeInputFromDomain,
} from "./lib/domainNotice";
import {
  query,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";

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
    // Raw SES statuses, so the admin panel can tell Pending from Failed.
    sesDkimStatus: v.optional(v.string()),
    sesMailFromStatus: v.optional(v.string()),
    sesVerifiedForSending: v.optional(v.boolean()),
    lastVerificationCheckAt: v.optional(v.number()),
    lastVerificationError: v.optional(v.string()),
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

// Domains still waiting on SES, used by the hourly re-verification cron.
// Scoped to recently created rows: a domain that has sat unverified for
// weeks is never going to flip on its own, and polling it forever would
// burn SES rate limit that pending domains need.
export const listPendingVerification = internalQuery({
  args: { createdAfter: v.number(), limit: v.number() },
  handler: async (ctx, { createdAfter, limit }) => {
    return await ctx.db
      .query("domains")
      .filter((q) =>
        q.and(
          q.eq(q.field("verified"), false),
          q.gt(q.field("_creationTime"), createdAfter)
        )
      )
      .take(limit);
  },
});

// ── Admin ──

async function requireAdminUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) throw new Error("Admin access required");
  const clerkId = identity.subject;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .unique();
  if (!user || user.category !== "admin") throw new Error("Admin access required");
  return user;
}

// Every domain on the platform with its owner, newest first. Admin only.
export const listAllForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminUser(ctx);

    const domains = await ctx.db.query("domains").order("desc").collect();

    return await Promise.all(
      domains.map(async (domain) => {
        const owner = await ctx.db.get(domain.userId);
        return {
          ...domain,
          ownerEmail: owner?.email ?? null,
          ownerName: owner?.name ?? null,
        };
      })
    );
  },
});

// The region whose SES endpoints a domain's DNS records must point at. BYO
// domains use their own account's region, platform domains the shared one.
async function regionForDomain(
  ctx: QueryCtx,
  domain: { awsAccountId?: Id<"awsAccounts"> }
): Promise<string> {
  if (domain.awsAccountId) {
    const account = await ctx.db.get(domain.awsAccountId);
    if (account) return account.region;
  }
  return process.env.AWS_REGION ?? "ap-south-1";
}

// Preview of the setup notice for a domain, so an admin can read exactly what
// the customer would receive before deciding to send it. Admin only.
export const pendingNoticePreview = query({
  args: { domainId: v.id("domains"), note: v.optional(v.string()) },
  handler: async (ctx, { domainId, note }) => {
    await requireAdminUser(ctx);

    const domain = await ctx.db.get(domainId);
    if (!domain) return null;

    const owner = await ctx.db.get(domain.userId);
    const region = await regionForDomain(ctx, domain);
    const notice = buildDomainPendingNotice(
      noticeInputFromDomain(domain, region),
      { note, domainUrl: `${process.env.APP_URL ?? "https://www.mailmark.dev"}/domains/${domainId}` }
    );

    return {
      ...notice,
      alreadyVerified: domain.verified,
      recipient: owner?.email ?? null,
      sentAt: domain.pendingNoticeSentAt,
      sentCount: domain.pendingNoticeCount ?? 0,
    };
  },
});

export const getOwnerForDomain = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    const domain = await ctx.db.get(domainId);
    if (!domain) return null;
    const owner = await ctx.db.get(domain.userId);
    const region = await regionForDomain(ctx, domain);
    return { domain, owner, region };
  },
});

export const recordPendingNoticeSent = internalMutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    const domain = await ctx.db.get(domainId);
    if (!domain) return;
    await ctx.db.patch(domainId, {
      pendingNoticeSentAt: Date.now(),
      pendingNoticeCount: (domain.pendingNoticeCount ?? 0) + 1,
    });
  },
});
