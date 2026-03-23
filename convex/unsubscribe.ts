import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

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

    const domains = await ctx.db
      .query("domains")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    const results: (Doc<"unsubscribes"> & { domainName: string })[] = [];
    for (const domain of domains) {
      const unsubs = await ctx.db
        .query("unsubscribes")
        .withIndex("by_domain_id", (q) => q.eq("domainId", domain._id))
        .collect();

      for (const unsub of unsubs) {
        results.push({
          ...unsub,
          domainName: domain.domain,
        });
      }
    }

    return results.sort((a, b) => b.unsubscribedAt - a.unsubscribedAt);
  },
});

export const listForDomain = query({
  args: { domainId: v.id("domains") },
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
      .query("unsubscribes")
      .withIndex("by_domain_id", (q) => q.eq("domainId", domainId))
      .collect();
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;

    const domains = await ctx.db
      .query("domains")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    let total = 0;
    let last7Days = 0;
    let last30Days = 0;
    const now = Date.now();
    const bySource: Record<string, number> = { "one-click": 0, link: 0, manual: 0 };

    for (const domain of domains) {
      const unsubs = await ctx.db
        .query("unsubscribes")
        .withIndex("by_domain_id", (q) => q.eq("domainId", domain._id))
        .collect();

      for (const unsub of unsubs) {
        total++;
        bySource[unsub.source] = (bySource[unsub.source] ?? 0) + 1;
        const age = now - unsub.unsubscribedAt;
        if (age <= 7 * 24 * 60 * 60 * 1000) last7Days++;
        if (age <= 30 * 24 * 60 * 60 * 1000) last30Days++;
      }
    }

    return { total, last7Days, last30Days, bySource };
  },
});

// ── Mutations (user-facing) ──

export const addManual = mutation({
  args: {
    domainId: v.id("domains"),
    email: v.string(),
  },
  handler: async (ctx, { domainId, email }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const domain = await ctx.db.get(domainId);
    if (!domain || domain.userId !== user._id) throw new Error("Not authorized");

    const normalized = email.toLowerCase().trim();

    // Check if already unsubscribed
    const existing = await ctx.db
      .query("unsubscribes")
      .withIndex("by_domain_email", (q) =>
        q.eq("domainId", domainId).eq("email", normalized)
      )
      .first();
    if (existing) throw new Error("Email already unsubscribed");

    const token = generateToken();
    await ctx.db.insert("unsubscribes", {
      domainId,
      email: normalized,
      token,
      unsubscribedAt: Date.now(),
      source: "manual",
    });
  },
});

export const remove = mutation({
  args: { unsubscribeId: v.id("unsubscribes") },
  handler: async (ctx, { unsubscribeId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const unsub = await ctx.db.get(unsubscribeId);
    if (!unsub) throw new Error("Not found");

    const domain = await ctx.db.get(unsub.domainId);
    if (!domain || domain.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.delete(unsubscribeId);
  },
});

// ── Internal (used by HTTP routes and sending) ──

export const isUnsubscribed = internalQuery({
  args: { domainId: v.id("domains"), email: v.string() },
  handler: async (ctx, { domainId, email }) => {
    const record = await ctx.db
      .query("unsubscribes")
      .withIndex("by_domain_email", (q) =>
        q.eq("domainId", domainId).eq("email", email.toLowerCase())
      )
      .first();
    return !!record;
  },
});

export const checkUnsubscribedRecipients = internalQuery({
  args: { domainId: v.id("domains"), emails: v.array(v.string()) },
  handler: async (ctx, { domainId, emails }) => {
    const unsubscribed: string[] = [];
    for (const email of emails) {
      const record = await ctx.db
        .query("unsubscribes")
        .withIndex("by_domain_email", (q) =>
          q.eq("domainId", domainId).eq("email", email.toLowerCase())
        )
        .first();
      if (record) unsubscribed.push(email);
    }
    return unsubscribed;
  },
});

export const getByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    return await ctx.db
      .query("unsubscribes")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
  },
});

export const processUnsubscribe = internalMutation({
  args: {
    domainId: v.id("domains"),
    email: v.string(),
    source: v.union(v.literal("one-click"), v.literal("link"), v.literal("manual")),
    mailboxAddress: v.optional(v.string()),
  },
  handler: async (ctx, { domainId, email, source, mailboxAddress }) => {
    const normalized = email.toLowerCase().trim();

    // Idempotent: check if already unsubscribed
    const existing = await ctx.db
      .query("unsubscribes")
      .withIndex("by_domain_email", (q) =>
        q.eq("domainId", domainId).eq("email", normalized)
      )
      .first();
    if (existing) return existing._id;

    const token = generateToken();
    return await ctx.db.insert("unsubscribes", {
      domainId,
      email: normalized,
      token,
      unsubscribedAt: Date.now(),
      source,
      mailboxAddress,
    });
  },
});

// Generate a URL-safe token for unsubscribe links
function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}
