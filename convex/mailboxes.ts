import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";

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

export const remove = mutation({
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

    await ctx.db.delete(mailboxId);
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
