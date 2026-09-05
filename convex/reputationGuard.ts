import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  REPUTATION_RECHECK_MS,
  REPUTATION_WINDOW_MS,
  asPercent,
  judge,
} from "./lib/reputation";

/**
 * The per-domain sending brake.
 *
 * Suppression already stops the *next* message to someone who complained, but
 * it does nothing about the ten thousand messages behind it going to a list
 * that is producing complaints in the first place. By the time a person reads
 * the SES dashboard and reacts, a week of sending has gone out. This closes
 * that gap: every complaint re-measures the domain that produced it, and a
 * domain over the limit stops sending until its owner has dealt with the list.
 *
 * The brake holds rather than drops. A paused domain fails the gate the same
 * way the platform-wide kill switch does, so scheduled mail stays in the
 * outbox with its job re-armed and sequence enrollments stay active. Lifting
 * it resumes the queue where it stopped.
 *
 * There is deliberately no automatic resume. The rate decays on its own as the
 * window rolls forward, so a domain would un-pause itself a few days later
 * with the list that caused the complaints entirely unchanged, send again, and
 * trip again. Someone has to look at the list, which is the only thing that
 * actually brings a complaint rate down.
 */

// ── Evaluation ──

/**
 * Measure one domain and apply the verdict.
 *
 * An action rather than a mutation because it reuses the same windowed count
 * /v1/bounces reads, and that count walks the sent folder: doing it inside the
 * webhook's own transaction would put a seven-day read on the critical path of
 * every complaint notification.
 */
export const evaluateDomain = internalAction({
  args: { domainId: v.id("domains") },
  handler: async (
    ctx,
    { domainId }
  ): Promise<{ paused: boolean; level: "ok" | "warning" | "pause" }> => {
    const stats = await ctx.runQuery(internal.emails.getBounceStatsForDomain, {
      domainId,
      sinceMs: Date.now() - REPUTATION_WINDOW_MS,
    });

    const verdict = judge({
      totalSent: stats.totalSent,
      complained: stats.complained,
      // Hard and soft together, which is what SES's own bounce rate counts.
      bounced: stats.bounced + stats.failed,
    });

    if (verdict.level !== "pause") {
      return { paused: false, level: verdict.level };
    }

    await ctx.runMutation(internal.reputationGuard.pauseDomainInternal, {
      domainId,
      reason: verdict.reason!,
      complaintRate: verdict.complaintRate ?? 0,
      bounceRate: verdict.bounceRate ?? 0,
    });

    return { paused: true, level: verdict.level };
  },
});

/**
 * Schedule an evaluation for the domain a complaint or hard bounce came from.
 *
 * Called from the delivery event path. Debounced on the domain row so a
 * campaign producing complaints in bursts queues one walk, not hundreds: the
 * timestamp is written in this transaction, so concurrent notifications
 * serialize on the document and all but one see a fresh check and stand down.
 */
export async function maybeScheduleEvaluation(
  ctx: MutationCtx,
  domainId: Id<"domains">
): Promise<boolean> {
  const domain = await ctx.db.get(domainId);
  if (!domain) return false;

  // Already stopped. Nothing a second measurement could add.
  if (domain.sendingPausedAt != null) return false;

  const now = Date.now();
  if (
    domain.reputationCheckedAt != null &&
    now - domain.reputationCheckedAt < REPUTATION_RECHECK_MS
  ) {
    return false;
  }

  await ctx.db.patch(domainId, { reputationCheckedAt: now });
  await ctx.scheduler.runAfter(0, internal.reputationGuard.evaluateDomain, {
    domainId,
  });
  return true;
}

/** Sweep every verified domain. Runs from the domain health cron. */
export const evaluateAllDomains = internalAction({
  args: {},
  // Annotated because the handler reaches back into its own module through
  // `internal`, and without a declared return type that cycle makes TypeScript
  // give up on the whole module and hand every caller `{}`.
  handler: async (ctx): Promise<{ checked: number; paused: number }> => {
    const domains = await ctx.runQuery(
      internal.domainHealthQueries.listAllVerifiedDomains,
      {}
    );

    let paused = 0;
    for (const domain of domains) {
      // A domain already stopped is not re-measured: the brake is lifted by
      // its owner, not by a later reading.
      if (domain.sendingPausedAt != null) continue;
      const outcome = await ctx.runAction(
        internal.reputationGuard.evaluateDomain,
        { domainId: domain._id as Id<"domains"> }
      );
      if (outcome.paused) paused++;
    }

    console.log(
      `[reputationGuard] swept ${domains.length} domain(s), paused ${paused}`
    );
    return { checked: domains.length, paused };
  },
});

// ── Writes ──

export const pauseDomainInternal = internalMutation({
  args: {
    domainId: v.id("domains"),
    reason: v.string(),
    complaintRate: v.number(),
    bounceRate: v.number(),
  },
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (!domain) return { paused: false };
    // Do not overwrite an earlier pause: the first reason is the one that
    // describes what actually went wrong, and the rates behind it are the
    // evidence. A second reading a minute later says the same thing worse.
    if (domain.sendingPausedAt != null) return { paused: false };

    await ctx.db.patch(args.domainId, {
      sendingPausedAt: Date.now(),
      sendingPausedReason: args.reason,
      sendingPausedComplaintRate: args.complaintRate,
      sendingPausedBounceRate: args.bounceRate,
    });

    console.warn(
      `[reputationGuard] paused sending for ${domain.domain}: ${args.reason}`
    );
    return { paused: true };
  },
});

/**
 * Lift the brake on a domain the caller owns.
 *
 * Deliberately a human action. Resuming with the list unchanged puts the
 * account straight back where it was, so the dashboard asks for a confirmation
 * and this records when it happened.
 */
export const resumeDomain = mutation({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("Not authenticated");

    const domain = await ctx.db.get(domainId);
    if (!domain) throw new Error("Domain not found");
    if (domain.userId !== user._id && user.category !== "admin") {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(domainId, {
      sendingPausedAt: undefined,
      sendingPausedReason: undefined,
      sendingPausedComplaintRate: undefined,
      sendingPausedBounceRate: undefined,
      sendingResumedAt: Date.now(),
      // Clear the debounce so the very next complaint re-measures rather than
      // waiting out a window that started before the resume.
      reputationCheckedAt: undefined,
    });

    return { resumed: true };
  },
});

/**
 * Pause a domain by hand, without waiting for a threshold.
 *
 * The equivalent of the platform kill switch, scoped to one domain, for the
 * case where a sender knows a campaign went to the wrong list before the
 * complaints have arrived to prove it.
 */
export const pauseDomain = mutation({
  args: { domainId: v.id("domains"), reason: v.optional(v.string()) },
  handler: async (ctx, { domainId, reason }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("Not authenticated");

    const domain = await ctx.db.get(domainId);
    if (!domain) throw new Error("Domain not found");
    if (domain.userId !== user._id && user.category !== "admin") {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(domainId, {
      sendingPausedAt: Date.now(),
      sendingPausedReason: reason ?? "Paused by the domain owner",
    });

    return { paused: true };
  },
});

// ── Reads ──

/**
 * Brake state for the signed-in user's domains.
 *
 * One document read per domain: the rates reported here are the ones stored on
 * the row at the moment the brake tripped, not a fresh measurement, so the
 * dashboard costs nothing to keep open. Current rates live on the domain
 * health check.
 */
export type DomainBrakeStatus = {
  domainId: Id<"domains">;
  domainName: string;
  sendingPaused: boolean;
  pausedAt: number | null;
  pausedReason: string | null;
  pausedComplaintRate: number | null;
  pausedBounceRate: number | null;
  resumedAt: number | null;
};

export const statusForCurrentUser = query({
  args: {},
  handler: async (ctx): Promise<DomainBrakeStatus[]> => {
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

    return domains.map((domain) => ({
      domainId: domain._id,
      domainName: domain.domain,
      sendingPaused: domain.sendingPausedAt != null,
      pausedAt: domain.sendingPausedAt ?? null,
      pausedReason: domain.sendingPausedReason ?? null,
      pausedComplaintRate:
        domain.sendingPausedComplaintRate != null
          ? asPercent(domain.sendingPausedComplaintRate, 3)
          : null,
      pausedBounceRate:
        domain.sendingPausedBounceRate != null
          ? asPercent(domain.sendingPausedBounceRate, 2)
          : null,
      resumedAt: domain.sendingResumedAt ?? null,
    }));
  },
});
