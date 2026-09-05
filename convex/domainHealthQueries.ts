import { v } from "convex/values";
import { query, internalMutation, internalQuery } from "./_generated/server";

// ── Queries ──

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
      .query("domainHealthChecks")
      .withIndex("by_domain_id", (q) => q.eq("domainId", domainId))
      .order("desc")
      .take(30);
  },
});

export const latestForCurrentUser = query({
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

    const results = await Promise.all(
      domains.map(async (domain) => {
        const latest = await ctx.db
          .query("domainHealthChecks")
          .withIndex("by_domain_id", (q) => q.eq("domainId", domain._id))
          .order("desc")
          .first();

        return {
          domainId: domain._id,
          domainName: domain.domain,
          verified: domain.verified,
          latestCheck: latest,
        };
      })
    );

    return results;
  },
});

// ── Internal mutations ──

export const insertHealthCheck = internalMutation({
  args: {
    userId: v.id("users"),
    domainId: v.id("domains"),
    checkedAt: v.number(),
    overallScore: v.number(),
    spfValid: v.boolean(),
    dkimValid: v.boolean(),
    dmarcValid: v.boolean(),
    blacklisted: v.boolean(),
    blacklistEntries: v.optional(v.array(v.string())),
    bounceRate: v.number(),
    complaintRate: v.number(),
    reputationStatus: v.union(v.literal("healthy"), v.literal("warning"), v.literal("critical")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("domainHealthChecks", args);
  },
});

// ── Internal queries ──

export const listAllVerifiedDomains = internalQuery({
  args: {},
  handler: async (ctx) => {
    const domains = await ctx.db.query("domains").collect();
    return domains.filter((d) => d.verified);
  },
});

export const getMailboxesForDomain = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    return await ctx.db
      .query("mailboxes")
      .withIndex("by_domain_id", (q) => q.eq("domainId", domainId))
      .collect();
  },
});

export const getEmailStatsForMailboxes = internalQuery({
  args: { mailboxIds: v.array(v.id("mailboxes")) },
  handler: async (ctx, { mailboxIds }) => {
    let totalSent = 0;
    let bounced = 0;
    let complained = 0;

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    for (const mailboxId of mailboxIds) {
      // Old: collect every sent message, then keep the last 30 days in memory.
      //
      // const emails = await ctx.db
      //   .query("emails")
      //   .withIndex("by_mailbox_folder", (q) => q.eq("mailboxId", mailboxId).eq("folder", "sent"))
      //   .collect();
      // const recent = emails.filter((e) => e.date >= thirtyDaysAgo);
      const recent = await ctx.db
        .query("emails")
        .withIndex("by_mailbox_folder_date", (q) =>
          q.eq("mailboxId", mailboxId).eq("folder", "sent").gte("date", thirtyDaysAgo)
        )
        .collect();

      totalSent += recent.length;

      // Old: "bounced" counted only the transient bounces, and "complained"
      // counted the hard bounces, because "failed" is what the SNS route maps
      // a Permanent bounce to. So the complaint rate on the dashboard, in the
      // health score below, and in the /v1/bounces API was never a complaint
      // rate at all: it was the hard bounce rate wearing a complaint's label,
      // and actual spam reports were counted nowhere. A rate nothing measures
      // is a rate nobody can bring down.
      //
      // bounced += recent.filter((e) => e.deliveryStatus === "bounced").length;
      // complained += recent.filter((e) => e.deliveryStatus === "failed").length;
      //
      // Now: bounces are hard and soft together, which is what SES's own
      // bounce rate counts, and complaints are the "complained" status the
      // Complaint notification actually writes.
      for (const e of recent) {
        if (e.deliveryStatus === "bounced" || e.deliveryStatus === "failed") {
          bounced++;
        } else if (e.deliveryStatus === "complained") {
          complained++;
        }
      }
    }

    return { totalSent, bounced, complained };
  },
});

export const latestForDomain = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    return await ctx.db
      .query("domainHealthChecks")
      .withIndex("by_domain_id", (q) => q.eq("domainId", domainId))
      .order("desc")
      .first();
  },
});

export const latestForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const domains = await ctx.db
      .query("domains")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    const results = await Promise.all(
      domains.map(async (domain) => {
        const latest = await ctx.db
          .query("domainHealthChecks")
          .withIndex("by_domain_id", (q) => q.eq("domainId", domain._id))
          .order("desc")
          .first();
        return { domain: domain.domain, domainId: domain._id, check: latest };
      })
    );

    return results.filter((r) => r.check !== null);
  },
});
