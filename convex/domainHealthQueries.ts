import { v } from "convex/values";
import { query, internalMutation, internalQuery } from "./_generated/server";
import { readMailboxStats } from "./lib/counters";
import { dayKeyOf } from "./lib/period";

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

/** Sent volume and failure counts over the last 30 days, for the health check.
 *
 *  Old, and the second query on the dashboard path with the shape that took
 *  quotas down: it collected 30 days of sent mail for every mailbox and threw
 *  all of it away except three integers. Bounded by time but not by volume, so
 *  a sender whose output was climbing would eventually read past the 16 MiB a
 *  Convex transaction may read.
 *
 *  //   const recent = await ctx.db
 *  //     .query("emails")
 *  //     .withIndex("by_mailbox_folder_date", (q) =>
 *  //       q.eq("mailboxId", mailboxId).eq("folder", "sent").gte("date", thirtyDaysAgo)
 *  //     )
 *  //     .collect();
 *  //   totalSent += recent.length;
 *  //   bounced += recent.filter((e) => e.deliveryStatus === "bounced").length;
 *  //   complained += recent.filter((e) => e.deliveryStatus === "failed").length;
 *
 *  That last line is why `complained` now reports something different. It
 *  counted deliveryStatus "failed", which the emails schema defines as a
 *  permanent hard bounce, so the complaint rate built on it was a hard bounce
 *  rate and genuine complaints were counted nowhere. Hard bounces now join
 *  `bounced`, which is what SES would call the bounce rate, and `complained`
 *  counts complaints.
 */
export const getEmailStatsForMailboxes = internalQuery({
  args: { mailboxIds: v.array(v.id("mailboxes")) },
  handler: async (ctx, { mailboxIds }) => {
    let totalSent = 0;
    let bounced = 0;
    let complained = 0;

    const since = dayKeyOf(Date.now() - 30 * 24 * 60 * 60 * 1000);

    for (const mailboxId of mailboxIds) {
      const stats = await readMailboxStats(ctx, mailboxId);
      // Day keys are zero padded, so lexical order is chronological order.
      for (const [day, tally] of Object.entries(stats.byDay)) {
        if (day < since) continue;
        totalSent += tally.sent;
        // Both kinds of bounce. A permanent one is the stronger signal of the
        // two, so leaving it out understated the rate it is most needed for.
        bounced += tally.bounced + tally.failed;
        complained += tally.complained;
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
