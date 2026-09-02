/**
 * Per-account bounce monitoring, threshold evaluation, and send enforcement.
 *
 * Reads the SES sending events that already arrive through
 * app/api/ses-webhook/route.ts -> /trackDelivery, rolls them into the hourly
 * buckets defined in lib/deliverability.ts, and decides whether an account has
 * crossed a rate it should not have.
 *
 * Three enforcement modes, set by setEnforcementMode and never by the
 * evaluator itself:
 *   monitor  - default. A breach records an incident and raises alerts.
 *              Sending is untouched.
 *   throttle - sends are capped at throttleDailyLimit per rolling 24h.
 *   pause    - sends are refused. Scheduled sends defer rather than cancel.
 *
 * Everything here is reversible by moving the account back to monitor. There
 * is no automatic resume, by design.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  DAY_MS,
  EVALUATION_WINDOW_MS,
  INCIDENT_COOLDOWN_MS,
  REPORTING_WINDOW_MS,
  THROTTLE_DEFAULT_DAILY_LIMIT,
  BUCKET_RETENTION_MS,
  EVENT_RETENTION_MS,
  asPercent,
  breachesFor,
  bumpBucket,
  classifyOutcome,
  deltaForOutcome,
  ensureAccountRow,
  getAccountRow,
  hourStartOf,
  MIN_SAMPLE_SENDS,
  ratesFor,
  readBuckets,
  totalsFrom,
  windowTotals,
} from "./lib/deliverability";

const ENFORCEMENT_MODE = v.union(
  v.literal("monitor"),
  v.literal("throttle"),
  v.literal("pause")
);

// ── Recording ───────────────────────────────────────────────────────────────

/**
 * Records one SES sending outcome (delivery, bounce, or complaint) against the
 * account that sent it, then re-evaluates that account.
 *
 * Evaluating on the event rather than on a timer is not an optimization, it is
 * the correct trigger: a rate only ever rises when a bounce or complaint
 * arrives. Sends move it down.
 *
 * Warmup sends are deliberately out of scope. They live in `warmupEmails`,
 * never pass through the send counters here, and counting their bounces
 * against an account whose sends we do not count would inflate the rate.
 */
export const recordOutcome = internalMutation({
  args: {
    sesMessageId: v.string(),
    status: v.string(),
    timestamp: v.number(),
    bounceType: v.optional(v.string()),
    bounceSubType: v.optional(v.string()),
    complaintFeedbackType: v.optional(v.string()),
    diagnosticCode: v.optional(v.string()),
    recipient: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const outcome = classifyOutcome(args.status, args.bounceType);
    if (!outcome) return { matched: false as const };

    const email = await ctx.db
      .query("emails")
      .withIndex("by_ses_message_id", (q) =>
        q.eq("sesMessageId", args.sesMessageId)
      )
      .first();
    if (!email) return { matched: false as const };

    const mailbox = await ctx.db.get(email.mailboxId);
    if (!mailbox) return { matched: false as const };

    const userId = mailbox.userId;
    const at = args.timestamp || Date.now();
    const recipient = args.recipient ?? email.to[0];

    if (outcome !== "delivered") {
      // SNS delivery is at-least-once, and unlike updateDeliveryStatus (which
      // just re-patches the same status) these counters are not idempotent: a
      // redelivered notification would inflate the account's bounce rate.
      // One bounce or complaint per (message, kind, recipient) is the rule.
      const duplicate = await ctx.db
        .query("deliverabilityEvents")
        .withIndex("by_ses_message_id", (q) =>
          q.eq("sesMessageId", args.sesMessageId)
        )
        .collect();
      if (
        duplicate.some((e) => e.kind === outcome && e.recipient === recipient)
      ) {
        return { matched: true as const, userId, duplicate: true as const };
      }
    }

    await bumpBucket(ctx, userId, deltaForOutcome(outcome), at);

    if (outcome !== "delivered") {
      await ctx.db.insert("deliverabilityEvents", {
        userId,
        domainId: mailbox.domainId,
        mailboxId: mailbox._id,
        emailId: email._id,
        sesMessageId: args.sesMessageId,
        kind: outcome,
        bounceType: args.bounceType,
        bounceSubType: args.bounceSubType,
        complaintFeedbackType: args.complaintFeedbackType,
        diagnosticCode: args.diagnosticCode,
        recipient,
        at,
      });

      await evaluate(ctx, userId);
    }

    return { matched: true as const, userId };
  },
});

// ── Evaluation ──────────────────────────────────────────────────────────────

/**
 * Checks one account's 24h window against the thresholds and, on a breach,
 * writes an incident and schedules the notifications.
 *
 * Shared by recordOutcome and the hourly sweep, so it is a plain function
 * rather than a Convex function: a mutation cannot call another mutation
 * in-process.
 */
async function evaluate(
  ctx: MutationCtx,
  userId: Id<"users">
): Promise<{ breached: boolean; recorded: number }> {
  const now = Date.now();
  const totals = await windowTotals(ctx, userId, now - EVALUATION_WINDOW_MS);
  const breaches = breachesFor(totals);

  const account = await ensureAccountRow(ctx, userId);
  // Written at most once a minute. This is a diagnostic ("is the evaluator
  // running?"), and every send reads this same row, so patching it on each
  // bounce would put avoidable write conflicts in front of sending.
  if (now - (account.lastEvaluatedAt ?? 0) > 60_000) {
    await ctx.db.patch(account._id, { lastEvaluatedAt: now });
  }

  if (breaches.length === 0) return { breached: false, recorded: 0 };

  // One incident per metric per cooldown. A breached account keeps bouncing,
  // and every one of those bounces lands here.
  const recent = await ctx.db
    .query("deliverabilityIncidents")
    .withIndex("by_user_at", (q) =>
      q.eq("userId", userId).gte("at", now - INCIDENT_COOLDOWN_MS)
    )
    .collect();

  const mode = account.enforcementMode;
  const actionTaken =
    mode === "pause" ? "paused" : mode === "throttle" ? "throttled" : "none";

  let recorded = 0;
  for (const breach of breaches) {
    if (recent.some((i) => i.metric === breach.metric)) continue;

    const incidentId = await ctx.db.insert("deliverabilityIncidents", {
      userId,
      at: now,
      metric: breach.metric,
      value: breach.value,
      threshold: breach.threshold,
      windowHours: Math.round(EVALUATION_WINDOW_MS / (60 * 60 * 1000)),
      sampleSends: totals.sends,
      hardBounces: totals.hardBounces,
      complaints: totals.complaints,
      enforcementMode: mode,
      actionTaken,
    });

    await ctx.db.patch(account._id, {
      lastBreachAt: now,
      lastBreachMetric: breach.metric,
      lastBreachValue: breach.value,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.deliverabilityNotify.sendBreachNotification,
      { incidentId }
    );

    console.warn(
      `[deliverability] ${breach.metric} breach for user ${userId}: ` +
        `${asPercent(breach.value)}% over ${totals.sends} sends, mode=${mode}`
    );
    recorded++;
  }

  return { breached: true, recorded };
}

/** Re-evaluates one account. Exposed for the sweep and for manual checks. */
export const evaluateAccount = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => await evaluate(ctx, userId),
});

/**
 * Safety net for the event-driven path: re-evaluates every account that has
 * sent inside the evaluation window, in case an SNS delivery was lost.
 *
 * The candidate set comes from the buckets rather than from the account table,
 * so a dormant account costs nothing: an account with no rows in the window is
 * never read at all, and the work scales with accounts that are actually
 * sending rather than with accounts that exist.
 */
export const sweepAccounts = internalMutation({
  args: { maxAccounts: v.optional(v.number()) },
  handler: async (ctx, { maxAccounts }) => {
    // Sized so one run stays comfortably inside Convex's 32,000 document scan
    // cap: up to cap * 30 bucket rows here, plus roughly 25 more per account
    // that evaluate() reads back.
    const cap = maxAccounts ?? 200;
    const since = hourStartOf(Date.now() - EVALUATION_WINDOW_MS);

    // Bounded rather than collected: this is a safety net behind the
    // event-driven path, so reading a capped slice of the window is better
    // than a query that grows with the platform and eventually throws.
    const recentBuckets = await ctx.db
      .query("deliverabilityBuckets")
      .withIndex("by_hour", (q) => q.gte("hourStart", since))
      .take(cap * 30);

    const active = new Set<Id<"users">>();
    for (const bucket of recentBuckets) {
      if (bucket.sends > 0) active.add(bucket.userId);
    }

    let evaluated = 0;
    for (const userId of active) {
      if (evaluated >= cap) break;
      await evaluate(ctx, userId);
      evaluated++;
    }

    return { active: active.size, evaluated };
  },
});

// ── Enforcement ─────────────────────────────────────────────────────────────

/**
 * The guard every send path consults. Returns whether this account may send
 * right now and, when it may not, a message fit to show the customer.
 *
 * Callers treat a thrown error here as "allow": a failed lookup is an
 * infrastructure problem, not evidence of abuse, and dropping mail on it would
 * be worse than the spike this feature exists to catch.
 */
export const getEnforcementState = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const account = await getAccountRow(ctx, userId);
    if (!account || account.enforcementMode === "monitor") {
      return {
        mode: "monitor" as const,
        allowed: true,
        sentLast24h: 0,
        dailyLimit: null as number | null,
      };
    }

    if (account.enforcementMode === "pause") {
      const paused = await windowTotals(ctx, userId, Date.now() - DAY_MS);
      return {
        mode: "pause" as const,
        allowed: false,
        sentLast24h: paused.sends,
        dailyLimit: null as number | null,
        reason:
          "Sending is paused on this account while a deliverability issue is reviewed. " +
          "Contact support@mailmark.dev to have it lifted.",
      };
    }

    const limit = account.throttleDailyLimit ?? THROTTLE_DEFAULT_DAILY_LIMIT;
    const totals = await windowTotals(ctx, userId, Date.now() - DAY_MS);
    const allowed = totals.sends < limit;

    return {
      mode: "throttle" as const,
      allowed,
      sentLast24h: totals.sends,
      dailyLimit: limit,
      reason: allowed
        ? undefined
        : `Daily sending limit reached (${limit} emails in 24 hours). ` +
          "This account is rate limited while a deliverability issue is reviewed. " +
          "Contact support@mailmark.dev to have it lifted.",
    };
  },
});

/**
 * Moves an account between enforcement modes. This is the only way an account
 * is throttled, paused, or released: nothing in the evaluation path changes a
 * mode on its own, and there is no automatic resume.
 */
export const setEnforcementMode = internalMutation({
  args: {
    userId: v.id("users"),
    mode: ENFORCEMENT_MODE,
    reason: v.optional(v.string()),
    setBy: v.optional(v.string()),
    throttleDailyLimit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, mode, reason, setBy, throttleDailyLimit }) => {
    const account = await ensureAccountRow(ctx, userId);
    await ctx.db.patch(account._id, {
      enforcementMode: mode,
      modeSetAt: Date.now(),
      modeSetReason: reason,
      modeSetBy: setBy,
      ...(throttleDailyLimit !== undefined ? { throttleDailyLimit } : {}),
    });
    console.log(
      `[deliverability] user ${userId} moved to ${mode}` +
        (reason ? ` (${reason})` : "")
    );
    return { userId, mode };
  },
});

/** Marks an incident as dealt with. Does not change the enforcement mode. */
export const resolveIncident = internalMutation({
  args: {
    incidentId: v.id("deliverabilityIncidents"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { incidentId, note }) => {
    await ctx.db.patch(incidentId, { resolvedAt: Date.now(), resolvedNote: note });
  },
});

export const markIncidentNotified = internalMutation({
  args: {
    incidentId: v.id("deliverabilityIncidents"),
    ownerNotified: v.boolean(),
    internalNotified: v.boolean(),
    notifyError: v.optional(v.string()),
  },
  handler: async (ctx, { incidentId, ownerNotified, internalNotified, notifyError }) => {
    await ctx.db.patch(incidentId, { ownerNotified, internalNotified, notifyError });
    const incident = await ctx.db.get(incidentId);
    if (!incident) return;
    const account = await ensureAccountRow(ctx, incident.userId);
    await ctx.db.patch(account._id, {
      ...(ownerNotified ? { lastOwnerNotifiedAt: Date.now() } : {}),
      ...(internalNotified ? { lastInternalNotifiedAt: Date.now() } : {}),
    });
  },
});

// ── Internal reporting ──────────────────────────────────────────────────────

/**
 * Current 24h and 7d rates for every sending account, worst hard bounce rate
 * first. Internal only.
 *
 * Cost is one bucket range read per account (up to 169 rows over 7 days), so
 * the listing is capped rather than unbounded.
 */
export const listAccountRates = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    // Capped deliberately. Each account costs one 7 day bucket read, which is
    // up to 169 documents, and Convex stops a query at 32,000 documents
    // scanned. 100 accounts leaves comfortable headroom; raising this without
    // moving to a paginated read would put the query at risk of throwing
    // rather than degrading.
    const accounts = await ctx.db.query("accountDeliverability").take(limit ?? 100);
    const now = Date.now();

    const rows = await Promise.all(
      accounts.map(async (account) => {
        // One read for the wider window, narrowed in memory for the shorter
        // one. Reading both from the database would double the scan.
        const buckets = await readBuckets(ctx, account.userId, now - REPORTING_WINDOW_MS);
        const day = totalsFrom(buckets, now - EVALUATION_WINDOW_MS);
        const week = totalsFrom(buckets, now - REPORTING_WINDOW_MS);
        const user = await ctx.db.get(account.userId);
        const dayRates = ratesFor(day);
        const weekRates = ratesFor(week);

        return {
          userId: account.userId,
          email: user?.email ?? null,
          name: user?.name ?? null,
          enforcementMode: account.enforcementMode,
          throttleDailyLimit: account.throttleDailyLimit ?? null,
          modeSetAt: account.modeSetAt,
          modeSetReason: account.modeSetReason ?? null,
          lastBreachAt: account.lastBreachAt ?? null,
          lastBreachMetric: account.lastBreachMetric ?? null,
          lastBreachValue: account.lastBreachValue ?? null,
          day: {
            sends: day.sends,
            delivered: day.delivered,
            hardBounces: day.hardBounces,
            softBounces: day.softBounces,
            complaints: day.complaints,
            hardBounceRate: asPercent(dayRates.hardBounceRate),
            softBounceRate: asPercent(dayRates.softBounceRate),
            complaintRate: asPercent(dayRates.complaintRate),
          },
          week: {
            sends: week.sends,
            delivered: week.delivered,
            hardBounces: week.hardBounces,
            softBounces: week.softBounces,
            complaints: week.complaints,
            hardBounceRate: asPercent(weekRates.hardBounceRate),
            softBounceRate: asPercent(weekRates.softBounceRate),
            complaintRate: asPercent(weekRates.complaintRate),
          },
          // Whether the 24h window is large enough for its rates to mean
          // anything. A 30% rate over 10 sends is not a signal.
          significant: day.sends >= MIN_SAMPLE_SENDS,
        };
      })
    );

    rows.sort((a, b) => {
      if (b.day.hardBounceRate !== a.day.hardBounceRate) {
        return b.day.hardBounceRate - a.day.hardBounceRate;
      }
      return b.day.sends - a.day.sends;
    });

    return rows;
  },
});

/** One account's rates, recent incidents, and recent bounce events. */
export const getAccountDetail = internalQuery({
  args: { userId: v.id("users"), eventLimit: v.optional(v.number()) },
  handler: async (ctx, { userId, eventLimit }) => {
    const now = Date.now();
    const account = await getAccountRow(ctx, userId);
    const buckets = await readBuckets(ctx, userId, now - REPORTING_WINDOW_MS);
    const day = totalsFrom(buckets, now - EVALUATION_WINDOW_MS);
    const week = totalsFrom(buckets, now - REPORTING_WINDOW_MS);

    const incidents = await ctx.db
      .query("deliverabilityIncidents")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);

    const events = await ctx.db
      .query("deliverabilityEvents")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .order("desc")
      .take(eventLimit ?? 50);

    return {
      enforcementMode: account?.enforcementMode ?? "monitor",
      throttleDailyLimit: account?.throttleDailyLimit ?? null,
      day: { ...day, ...ratesFor(day) },
      week: { ...week, ...ratesFor(week) },
      incidents,
      events,
    };
  },
});

export const getIncident = internalQuery({
  args: { incidentId: v.id("deliverabilityIncidents") },
  handler: async (ctx, { incidentId }) => {
    const incident = await ctx.db.get(incidentId);
    if (!incident) return null;
    const user = await ctx.db.get(incident.userId);
    const account = await getAccountRow(ctx, incident.userId);
    return {
      incident,
      user,
      // The ceiling actually in force, so the notification quotes the
      // account's own limit rather than the default.
      throttleDailyLimit: account?.throttleDailyLimit ?? THROTTLE_DEFAULT_DAILY_LIMIT,
    };
  },
});

// ── Retention ───────────────────────────────────────────────────────────────

/**
 * Drops buckets and events past their retention window. Paginated by a cap on
 * rows per run so one call cannot exceed a transaction's limits; the cron
 * catches up over subsequent runs.
 */
export const pruneOldData = internalMutation({
  args: { maxRows: v.optional(v.number()) },
  handler: async (ctx, { maxRows }) => {
    // Each row is one delete, and a Convex transaction has a write ceiling.
    // Two tables at 1000 rows each stays well inside it; the cron catches up
    // over subsequent runs when there is more than that to drop.
    const cap = maxRows ?? 1000;
    const now = Date.now();

    const staleBuckets = await ctx.db
      .query("deliverabilityBuckets")
      .withIndex("by_hour", (q) =>
        q.lt("hourStart", hourStartOf(now - BUCKET_RETENTION_MS))
      )
      .take(cap);
    for (const b of staleBuckets) await ctx.db.delete(b._id);

    const staleEvents = await ctx.db
      .query("deliverabilityEvents")
      .withIndex("by_at", (q) => q.lt("at", now - EVENT_RETENTION_MS))
      .take(cap);
    for (const e of staleEvents) await ctx.db.delete(e._id);

    return { buckets: staleBuckets.length, events: staleEvents.length };
  },
});
