import { v } from "convex/values";
import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { S3Client, DeleteObjectsCommand } from "@aws-sdk/client-s3";

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

    return await ctx.db.insert("mailboxes", {
      domainId,
      userId: user._id,
      address: localPart,
      fullAddress,
      displayName,
    });
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

    for (const email of emails) {
      await ctx.db.delete(email._id);
    }

    await ctx.db.delete(mailboxId);
    return s3Keys;
  },
});

export const remove = action({
  args: { mailboxId: v.id("mailboxes") },
  handler: async (ctx, { mailboxId }) => {
    const s3Keys: string[] = await ctx.runMutation(
      internal.mailboxes.removeRecords,
      { mailboxId }
    );

    if (s3Keys.length === 0) return;

    const s3 = new S3Client({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const bucket = process.env.AWS_S3_BUCKET!;

    // DeleteObjectsCommand accepts up to 1000 keys per request
    for (let i = 0; i < s3Keys.length; i += 1000) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
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
