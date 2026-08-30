import { v } from "convex/values";
import { query, mutation, action, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { PLAN_LIMITS, resolvePlan } from "./quotas";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import {
  getPlatformAwsClients,
  getAwsClientsForAccount,
  type AwsClientBundle,
} from "./lib/awsClients";
import {
  countCreated,
  countRemoved,
  deleteEmailsCounted,
  deleteMailboxStats,
  mailboxBuckets,
} from "./lib/counters";

// Resolve AWS clients for a mailbox's deletion: uses the mailbox's domain
// to find the BYO awsAccount row (if any), falling back to platform creds.
// S3 keys are stored as `{domain}/{mailbox}/...`, so we read the mailbox's
// domainId, look up the domain, and then the awsAccount.
async function clientsForMailboxId(
  ctx: { runQuery: (fn: any, args: any) => Promise<any> },
  mailboxId: string
): Promise<AwsClientBundle> {
  // Use the existing helper to find the mailbox → domain → awsAccount chain.
  const info = await ctx.runQuery(
    internal.emails.getMailboxWithDomain,
    { mailboxId }
  );
  if (info?.awsAccount) {
    return await getAwsClientsForAccount(info.awsAccount);
  }
  return getPlatformAwsClients();
}

export const listByDomain = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("mailboxes")
      .withIndex("by_domain_id", (q) => q.eq("domainId", domainId))
      .collect();
  },
});

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
      .query("mailboxes")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const getById = query({
  args: { mailboxId: v.id("mailboxes") },
  handler: async (ctx, { mailboxId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const mailbox = await ctx.db.get(mailboxId);
    if (!mailbox) return null;

    // Verify ownership
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || mailbox.userId !== user._id) return null;

    return mailbox;
  },
});

export const create = mutation({
  args: {
    domainId: v.id("domains"),
    address: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, { domainId, address, displayName }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    // Quota check
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();
    const plan = resolvePlan(user.category, subscription?.status, subscription?.plan);
    const mailboxLimit = PLAN_LIMITS[plan].mailboxes;
    if (mailboxLimit !== null) {
      const mailboxCount = await ctx.db
        .query("mailboxes")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .collect();
      if (mailboxCount.length >= mailboxLimit) {
        throw new Error(
          `Mailbox limit reached. Your plan allows ${mailboxLimit} mailbox(es). Please upgrade to add more.`
        );
      }
    }

    const domain = await ctx.db.get(domainId);
    if (!domain || domain.userId !== user._id) {
      throw new Error("Domain not found");
    }

    const localPart = address.trim().toLowerCase();
    const fullAddress = `${localPart}@${domain.domain}`;

    // Check for duplicate
    const existing = await ctx.db
      .query("mailboxes")
      .withIndex("by_full_address", (q) => q.eq("fullAddress", fullAddress))
      .unique();

    if (existing) throw new Error("Mailbox already exists");

    const mailboxId = await ctx.db.insert("mailboxes", {
      domainId,
      userId: user._id,
      address: localPart,
      fullAddress,
      displayName,
    });
    await countCreated(ctx, mailboxBuckets());
    return mailboxId;
  },
});

export const updateDisplayName = mutation({
  args: {
    mailboxId: v.id("mailboxes"),
    displayName: v.string(),
  },
  handler: async (ctx, { mailboxId, displayName }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const mailbox = await ctx.db.get(mailboxId);
    if (!mailbox) throw new Error("Mailbox not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || mailbox.userId !== user._id) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(mailboxId, {
      displayName: displayName.trim() || undefined,
    });
  },
});

export const updateSignature = mutation({
  args: {
    mailboxId: v.id("mailboxes"),
    signature: v.string(),
  },
  handler: async (ctx, { mailboxId, signature }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const mailbox = await ctx.db.get(mailboxId);
    if (!mailbox) throw new Error("Mailbox not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || mailbox.userId !== user._id) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(mailboxId, {
      signature: signature.trim() || undefined,
    });
  },
});

// Deletes all DB records for the mailbox and returns the s3Keys to clean up.
export const removeRecords = internalMutation({
  args: { mailboxId: v.id("mailboxes") },
  handler: async (ctx, { mailboxId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const mailbox = await ctx.db.get(mailboxId);
    if (!mailbox || mailbox.userId !== user._id) {
      throw new Error("Mailbox not found");
    }

    const emails = await ctx.db
      .query("emails")
      .withIndex("by_mailbox_folder", (q) => q.eq("mailboxId", mailboxId))
      .collect();

    const s3Keys = emails.map((e) => e.s3Key);

    // for (const email of emails) {
    //   await ctx.db.delete(email._id);
    // }
    await deleteEmailsCounted(ctx, emails);

    await ctx.db.delete(mailboxId);
    await countRemoved(ctx, mailboxBuckets());
    await deleteMailboxStats(ctx, mailboxId);
    return s3Keys;
  },
});

export const remove = action({
  args: { mailboxId: v.id("mailboxes") },
  handler: async (ctx, { mailboxId }) => {
    const aws = await clientsForMailboxId(ctx, mailboxId);

    const s3Keys: string[] = await ctx.runMutation(
      internal.mailboxes.removeRecords,
      { mailboxId }
    );

    if (s3Keys.length === 0) return;

    // DeleteObjectsCommand accepts up to 1000 keys per request
    for (let i = 0; i < s3Keys.length; i += 1000) {
      await aws.s3.send(
        new DeleteObjectsCommand({
          Bucket: aws.s3Bucket,
          Delete: {
            Objects: s3Keys.slice(i, i + 1000).map((Key) => ({ Key })),
          },
        })
      );
    }
  },
});

export const getByFullAddress = internalQuery({
  args: { fullAddress: v.string() },
  handler: async (ctx, { fullAddress }) => {
    return await ctx.db
      .query("mailboxes")
      .withIndex("by_full_address", (q) => q.eq("fullAddress", fullAddress))
      .unique();
  },
});

// ── API-key-authenticated internal helpers (no Clerk auth) ──────────────────

export const listByDomainInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    return await ctx.db
      .query("mailboxes")
      .withIndex("by_domain_id", (q) => q.eq("domainId", domainId))
      .collect();
  },
});

export const createInternal = internalMutation({
  args: {
    domainId: v.id("domains"),
    userId: v.id("users"),
    address: v.string(),
    fullAddress: v.string(),
    displayName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Quota check (same logic as public create mutation)
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();
    const plan = resolvePlan(user.category, subscription?.status, subscription?.plan);
    const mailboxLimit = PLAN_LIMITS[plan].mailboxes;
    if (mailboxLimit !== null) {
      const mailboxCount = await ctx.db
        .query("mailboxes")
        .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
        .collect();
      if (mailboxCount.length >= mailboxLimit) {
        throw new Error(
          `Mailbox limit reached. Your plan allows ${mailboxLimit} mailbox(es). Please upgrade to add more.`
        );
      }
    }

    const existing = await ctx.db
      .query("mailboxes")
      .withIndex("by_full_address", (q) => q.eq("fullAddress", args.fullAddress))
      .unique();
    if (existing) throw new Error("Mailbox already exists");
    const mailboxId = await ctx.db.insert("mailboxes", {
      domainId: args.domainId,
      userId: args.userId,
      address: args.address,
      fullAddress: args.fullAddress,
      displayName: args.displayName,
    });
    await countCreated(ctx, mailboxBuckets());
    return mailboxId;
  },
});

export const deleteRecordsInternal = internalMutation({
  args: { mailboxId: v.id("mailboxes") },
  handler: async (ctx, { mailboxId }) => {
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_mailbox_folder", (q) => q.eq("mailboxId", mailboxId))
      .collect();
    const s3Keys = emails.map((e) => e.s3Key);
    // for (const email of emails) await ctx.db.delete(email._id);
    await deleteEmailsCounted(ctx, emails);

    // Remove this mailbox from any sender groups
    const groups = await ctx.db.query("senderGroups").collect();
    for (const group of groups) {
      if (group.mailboxIds.includes(mailboxId)) {
        const remaining = group.mailboxIds.filter((id) => id !== mailboxId);
        if (remaining.length === 0) {
          await ctx.db.delete(group._id);
        } else {
          await ctx.db.patch(group._id, { mailboxIds: remaining });
        }
      }
    }

    const mailboxDoc = await ctx.db.get(mailboxId);
    await ctx.db.delete(mailboxId);
    if (mailboxDoc) await countRemoved(ctx, mailboxBuckets());
    await deleteMailboxStats(ctx, mailboxId);
    return s3Keys;
  },
});

export const removeInternal = internalAction({
  args: { mailboxId: v.id("mailboxes") },
  handler: async (ctx, { mailboxId }) => {
    const aws = await clientsForMailboxId(ctx, mailboxId);

    const s3Keys: string[] = await ctx.runMutation(
      internal.mailboxes.deleteRecordsInternal,
      { mailboxId }
    );
    if (s3Keys.length === 0) return;
    for (let i = 0; i < s3Keys.length; i += 1000) {
      await aws.s3.send(
        new DeleteObjectsCommand({
          Bucket: aws.s3Bucket,
          Delete: { Objects: s3Keys.slice(i, i + 1000).map((Key) => ({ Key })) },
        })
      );
    }
  },
});
