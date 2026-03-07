import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";

// List sender groups visible to a specific mailbox
export const list = query({
  args: {
    mailboxId: v.id("mailboxes"),
  },
  handler: async (ctx, { mailboxId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const mailbox = await ctx.db.get(mailboxId);
    if (!mailbox || mailbox.userId !== user._id) return [];

    const allGroups = await ctx.db
      .query("senderGroups")
      .withIndex("by_domain_id", (q) => q.eq("domainId", mailbox.domainId))
      .collect();

    return allGroups.filter((g) => g.mailboxIds.includes(mailboxId));
  },
});

// List all domain groups (for the sharing UI to show which ones exist)
export const listByDomain = query({
  args: {
    domainId: v.id("domains"),
  },
  handler: async (ctx, { domainId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const domain = await ctx.db.get(domainId);
    if (!domain || domain.userId !== user._id) return [];

    return await ctx.db
      .query("senderGroups")
      .withIndex("by_domain_id", (q) => q.eq("domainId", domainId))
      .collect();
  },
});

export const create = mutation({
  args: {
    mailboxId: v.id("mailboxes"),
    name: v.string(),
    emails: v.array(v.string()),
  },
  handler: async (ctx, { mailboxId, name, emails }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const mailbox = await ctx.db.get(mailboxId);
    if (!mailbox || mailbox.userId !== user._id) throw new Error("Not authorized");

    return await ctx.db.insert("senderGroups", {
      domainId: mailbox.domainId,
      mailboxIds: [mailboxId],
      name,
      emails,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("senderGroups"),
    name: v.string(),
    emails: v.array(v.string()),
  },
  handler: async (ctx, { id, name, emails }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const group = await ctx.db.get(id);
    if (!group) throw new Error("Group not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const domain = await ctx.db.get(group.domainId);
    if (!domain || domain.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.patch(id, { name, emails });
  },
});

// Update which mailboxes a group is shared with (must all be in the same domain)
export const updateMailboxes = mutation({
  args: {
    id: v.id("senderGroups"),
    mailboxIds: v.array(v.id("mailboxes")),
  },
  handler: async (ctx, { id, mailboxIds }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const group = await ctx.db.get(id);
    if (!group) throw new Error("Group not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const domain = await ctx.db.get(group.domainId);
    if (!domain || domain.userId !== user._id) throw new Error("Not authorized");

    // Verify all mailboxes belong to the same domain
    for (const mbId of mailboxIds) {
      const mb = await ctx.db.get(mbId);
      if (!mb || mb.domainId !== group.domainId) {
        throw new Error("All mailboxes must belong to the same domain");
      }
    }

    if (mailboxIds.length === 0) {
      throw new Error("Group must belong to at least one mailbox");
    }

    await ctx.db.patch(id, { mailboxIds });
  },
});

export const remove = mutation({
  args: {
    id: v.id("senderGroups"),
  },
  handler: async (ctx, { id }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const group = await ctx.db.get(id);
    if (!group) throw new Error("Group not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const domain = await ctx.db.get(group.domainId);
    if (!domain || domain.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.delete(id);
  },
});

// ── API-key-authenticated internal helpers (no Clerk auth) ──────────────────

export const listByDomainInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    return await ctx.db
      .query("senderGroups")
      .withIndex("by_domain_id", (q) => q.eq("domainId", domainId))
      .collect();
  },
});

export const getByIdInternal = internalQuery({
  args: { id: v.id("senderGroups") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const createInternal = internalMutation({
  args: {
    domainId: v.id("domains"),
    name: v.string(),
    mailboxIds: v.array(v.id("mailboxes")),
    emails: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("senderGroups", {
      domainId: args.domainId,
      name: args.name,
      mailboxIds: args.mailboxIds,
      emails: args.emails,
    });
    return await ctx.db.get(id);
  },
});

export const updateInternal = internalMutation({
  args: {
    id: v.id("senderGroups"),
    name: v.optional(v.string()),
    emails: v.optional(v.array(v.string())),
    addEmails: v.optional(v.array(v.string())),
    removeEmails: v.optional(v.array(v.string())),
    mailboxIds: v.optional(v.array(v.id("mailboxes"))),
  },
  handler: async (ctx, { id, name, emails, addEmails, removeEmails, mailboxIds }) => {
    const group = await ctx.db.get(id);
    if (!group) throw new Error("Sender group not found");

    const patch: Partial<{ name: string; emails: string[]; mailboxIds: typeof group.mailboxIds }> = {};

    if (name !== undefined) patch.name = name;

    if (emails !== undefined) {
      patch.emails = emails;
    } else {
      let current = group.emails;
      if (addEmails?.length) current = [...new Set([...current, ...addEmails])];
      if (removeEmails?.length) current = current.filter((e) => !removeEmails.includes(e));
      if (addEmails?.length || removeEmails?.length) patch.emails = current;
    }

    if (mailboxIds !== undefined) {
      if (mailboxIds.length === 0) throw new Error("Group must have at least one mailbox");
      patch.mailboxIds = mailboxIds;
    }

    await ctx.db.patch(id, patch);
    return await ctx.db.get(id);
  },
});

export const deleteInternal = internalMutation({
  args: { id: v.id("senderGroups") },
  handler: async (ctx, { id }) => {
    const group = await ctx.db.get(id);
    if (!group) throw new Error("Sender group not found");
    await ctx.db.delete(id);
  },
});
