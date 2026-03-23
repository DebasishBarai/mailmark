"use node";

import { v } from "convex/values";
import { query, internalMutation, internalQuery } from "./_generated/server";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import dns from "node:dns";

const dnsResolver = new dns.promises.Resolver();
dnsResolver.setServers(["8.8.8.8", "1.1.1.1"]);

async function resolveTxt(hostname: string): Promise<string[][]> {
  try {
    return await dnsResolver.resolveTxt(hostname);
  } catch {
    return [];
  }
}

async function resolveCname(hostname: string): Promise<string[]> {
  try {
    return await dnsResolver.resolveCname(hostname);
  } catch {
    return [];
  }
}

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

// ── Actions (node runtime for DNS) ──

export const runHealthCheckForAllDomains = internalAction({
  args: {},
  handler: async (ctx) => {
    const domains = await ctx.runQuery(internal.domainHealth.listAllVerifiedDomains, {});
    let checked = 0;

    for (const domain of domains) {
      // Check SPF
      const txtRecords = await resolveTxt(domain.domain);
      const spfRecord = txtRecords.find((parts) => parts.join("").includes("v=spf1"));
      const spfValid = spfRecord ? spfRecord.join("").includes("amazonses.com") : false;

      // Check DKIM
      const dkimTokens = domain.sesDkimTokens ?? [];
      const dkimResults = await Promise.all(
        dkimTokens.map(async (token) => {
          const hostname = `${token}._domainkey.${domain.domain}`;
          const expectedValue = `${token}.dkim.amazonses.com`;
          const cnames = await resolveCname(hostname);
          return cnames.some((c) => c.toLowerCase().replace(/\.$/, "") === expectedValue);
        })
      );
      const dkimValid = dkimResults.length > 0 && dkimResults.every(Boolean);

      // Check DMARC
      const dmarcRecords = await resolveTxt(`_dmarc.${domain.domain}`);
      const dmarcValid = dmarcRecords.some((parts) => parts.join("").includes("v=DMARC1"));

      // Calculate bounce and complaint rates from recent emails
      const mailboxes = await ctx.runQuery(internal.domainHealth.getMailboxesForDomain, {
        domainId: domain._id,
      });
      const stats = await ctx.runQuery(internal.domainHealth.getEmailStatsForMailboxes, {
        mailboxIds: mailboxes.map((m) => m._id),
      });

      const bounceRate = stats.totalSent > 0 ? (stats.bounced / stats.totalSent) * 100 : 0;
      const complaintRate = stats.totalSent > 0 ? (stats.complained / stats.totalSent) * 100 : 0;

      // Blacklist check - simplified (check common DNSBL)
      const blacklistEntries: string[] = [];
      const blacklists = ["zen.spamhaus.org", "bl.spamcop.net", "b.barracudacentral.org"];
      for (const bl of blacklists) {
        try {
          const result = await dnsResolver.resolve4(`${domain.domain}.${bl}`);
          if (result.length > 0) blacklistEntries.push(bl);
        } catch {
          // Not listed - this is expected/good
        }
      }
      const blacklisted = blacklistEntries.length > 0;

      // Score calculation
      let score = 100;
      if (!spfValid) score -= 20;
      if (!dkimValid) score -= 20;
      if (!dmarcValid) score -= 15;
      if (blacklisted) score -= 30;
      if (bounceRate > 5) score -= 10;
      if (bounceRate > 10) score -= 10;
      if (complaintRate > 0.1) score -= 10;
      if (complaintRate > 0.5) score -= 10;
      score = Math.max(0, score);

      const reputationStatus: "healthy" | "warning" | "critical" =
        score >= 80 ? "healthy" : score >= 50 ? "warning" : "critical";

      await ctx.runMutation(internal.domainHealth.insertHealthCheck, {
        userId: domain.userId,
        domainId: domain._id,
        checkedAt: Date.now(),
        overallScore: score,
        spfValid,
        dkimValid,
        dmarcValid,
        blacklisted,
        blacklistEntries: blacklistEntries.length > 0 ? blacklistEntries : undefined,
        bounceRate: Math.round(bounceRate * 100) / 100,
        complaintRate: Math.round(complaintRate * 1000) / 1000,
        reputationStatus,
      });

      checked++;
    }

    console.log(`[domainHealth] Checked ${checked} domain(s)`);
    return { checked };
  },
});

// Helper internal queries for the health check action
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
      const emails = await ctx.db
        .query("emails")
        .withIndex("by_mailbox_folder", (q) => q.eq("mailboxId", mailboxId).eq("folder", "sent"))
        .collect();

      const recent = emails.filter((e) => e.date >= thirtyDaysAgo);
      totalSent += recent.length;
      bounced += recent.filter((e) => e.deliveryStatus === "bounced").length;
      complained += recent.filter((e) => e.deliveryStatus === "failed").length;
    }

    return { totalSent, bounced, complained };
  },
});
