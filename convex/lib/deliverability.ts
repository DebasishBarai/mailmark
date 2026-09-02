/**
 * Per-account deliverability rollups, thresholds, and enforcement helpers.
 *
 * Background: a single account sent to a 34k address unverified list and took
 * the shared SES account from a 0% to a 5.4% hard bounce rate in five days.
 * AWS reviews sending accounts above 5%, so the platform needs to see a bounce
 * spike per account while it is happening rather than after the fact.
 *
 * Why a separate rollup rather than counting the `emails` table: answering
 * "what is this account's hard bounce rate over the last 24 hours" from
 * `emails` means walking every mailbox the account owns and reading every sent
 * message in the window. That is the same unbounded read that put
 * platformStats over Convex's per transaction caps and led to
 * `platformCounters`. These buckets are the same idea scoped to an account and
 * a clock hour.
 *
 * Why hourly rows rather than one row per account: a row per (account, hour)
 * keeps each document small, lets the 24h and 7d windows both be index range
 * reads, and lets old rows be dropped by date instead of decayed in place.
 *
 * Pure helpers only. No Convex function definitions and no AWS imports, so
 * both queries and mutations can use this module.
 */

import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

// Trip points. Both sit under the level at which AWS starts asking questions
// (5% bounce, 0.1% complaint) so an account is caught on the way up rather
// than once the account-wide number is already in review territory.
export const HARD_BOUNCE_RATE_THRESHOLD = 0.04; // 4%
export const COMPLAINT_RATE_THRESHOLD = 0.0008; // 0.08%

// A rate computed from a handful of sends is noise: 3 bounces out of 20 is
// 15%, and pausing on that would be wrong every time. Nothing trips until the
// account has sent at least this many messages inside the window.
export const MIN_SAMPLE_SENDS = 500;

// The window the thresholds above are evaluated over. The 7d window is
// reported but not enforced on, because a spike inside a good week still
// needs to be caught the day it happens.
export const EVALUATION_WINDOW_MS = DAY_MS;
export const REPORTING_WINDOW_MS = 7 * DAY_MS;

// Ceiling applied in "throttle" mode, in sends per rolling 24 hours, when the
// account has no explicit limit of its own.
export const THROTTLE_DEFAULT_DAILY_LIMIT = 100;

// A breached account keeps bouncing, and every bounce re-evaluates it. Without
// a cooldown one bad list would write an incident row and an email per bounce.
export const INCIDENT_COOLDOWN_MS = 6 * HOUR_MS;

export const BUCKET_RETENTION_MS = 30 * DAY_MS;
export const EVENT_RETENTION_MS = 90 * DAY_MS;

export type EnforcementMode = "monitor" | "throttle" | "pause";

export type OutcomeDelta = {
  sends?: number;
  delivered?: number;
  hardBounces?: number;
  softBounces?: number;
  complaints?: number;
};

export type WindowTotals = {
  sends: number;
  delivered: number;
  hardBounces: number;
  softBounces: number;
  complaints: number;
};

export type WindowRates = {
  hardBounceRate: number;
  softBounceRate: number;
  complaintRate: number;
};

// Same shape as counters.ts uses, so a mutation ctx and a query ctx can both
// be passed to the read helpers.
export type WriteCtx = { db: MutationCtx["db"] };
export type ReadCtx = { db: QueryCtx["db"] };

export function hourStartOf(ts: number): number {
  return Math.floor(ts / HOUR_MS) * HOUR_MS;
}

export function emptyTotals(): WindowTotals {
  return { sends: 0, delivered: 0, hardBounces: 0, softBounces: 0, complaints: 0 };
}

/**
 * Maps an SES sending event to the outcome we count it as.
 *
 * `bounceType` is the raw SES value (Permanent / Transient / Undetermined) and
 * is what actually decides hard versus soft. It is passed through the webhook
 * as of this change; `status` is the fallback for an event that predates it.
 *
 * Note the fallback looks inverted and is not: app/api/ses-webhook/route.ts
 * maps a Permanent bounce to "failed" and a Transient one to "bounced", so in
 * the `emails` table "failed" is the hard bounce and "bounced" is the soft one.
 * That mapping is left alone here; this module records the SES meaning.
 */
export function classifyOutcome(
  status: string,
  bounceType?: string
): "delivered" | "hard_bounce" | "soft_bounce" | "complaint" | null {
  if (status === "delivered") return "delivered";
  if (status === "complained") return "complaint";
  if (status === "bounced" || status === "failed") {
    if (bounceType) {
      return bounceType === "Permanent" ? "hard_bounce" : "soft_bounce";
    }
    return status === "failed" ? "hard_bounce" : "soft_bounce";
  }
  return null;
}

export function deltaForOutcome(
  outcome: "delivered" | "hard_bounce" | "soft_bounce" | "complaint"
): OutcomeDelta {
  switch (outcome) {
    case "delivered":
      return { delivered: 1 };
    case "hard_bounce":
      return { hardBounces: 1 };
    case "soft_bounce":
      return { softBounces: 1 };
    case "complaint":
      return { complaints: 1 };
  }
}

/**
 * Returns the account's enforcement row, creating it in "monitor" mode if it
 * does not exist yet. Monitor is the default for every account: a threshold
 * breach records an incident and raises an alert, and changes nothing about
 * sending until someone moves the account to throttle or pause.
 */
export async function ensureAccountRow(
  ctx: WriteCtx,
  userId: Id<"users">
): Promise<Doc<"accountDeliverability">> {
  const existing = await ctx.db
    .query("accountDeliverability")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (existing) return existing;

  const id = await ctx.db.insert("accountDeliverability", {
    userId,
    enforcementMode: "monitor",
    modeSetAt: Date.now(),
    modeSetReason: "default",
  });
  return (await ctx.db.get(id))!;
}

export async function getAccountRow(
  ctx: ReadCtx,
  userId: Id<"users">
): Promise<Doc<"accountDeliverability"> | null> {
  return await ctx.db
    .query("accountDeliverability")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

/** Adds the given counts to the account's bucket for the hour containing `at`. */
export async function bumpBucket(
  ctx: WriteCtx,
  userId: Id<"users">,
  delta: OutcomeDelta,
  at: number = Date.now()
): Promise<void> {
  await ensureAccountRow(ctx, userId);

  const hourStart = hourStartOf(at);
  const existing = await ctx.db
    .query("deliverabilityBuckets")
    .withIndex("by_user_hour", (q) =>
      q.eq("userId", userId).eq("hourStart", hourStart)
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      sends: existing.sends + (delta.sends ?? 0),
      delivered: existing.delivered + (delta.delivered ?? 0),
      hardBounces: existing.hardBounces + (delta.hardBounces ?? 0),
      softBounces: existing.softBounces + (delta.softBounces ?? 0),
      complaints: existing.complaints + (delta.complaints ?? 0),
    });
    return;
  }

  await ctx.db.insert("deliverabilityBuckets", {
    userId,
    hourStart,
    sends: delta.sends ?? 0,
    delivered: delta.delivered ?? 0,
    hardBounces: delta.hardBounces ?? 0,
    softBounces: delta.softBounces ?? 0,
    complaints: delta.complaints ?? 0,
  });
}

/** Counts one accepted send against the account that owns the mailbox. */
export async function countSend(
  ctx: WriteCtx,
  mailboxId: Id<"mailboxes">,
  at: number = Date.now()
): Promise<void> {
  const mailbox = await ctx.db.get(mailboxId);
  if (!mailbox) return;
  await bumpBucket(ctx, mailbox.userId, { sends: 1 }, at);
}

/**
 * Sums an account's buckets from `sinceMs` to now.
 *
 * The window is inclusive of the hour `sinceMs` falls in, so a 24h window
 * reads up to 25 rows and can overstate the window by at most one hour at the
 * trailing edge. That is deliberate: erring toward a slightly wider window
 * cannot hide a spike, and the alternative (per event rows for sends) is the
 * unbounded read this table exists to avoid.
 */
export async function windowTotals(
  ctx: ReadCtx,
  userId: Id<"users">,
  sinceMs: number
): Promise<WindowTotals> {
  const from = hourStartOf(sinceMs);
  const buckets = await ctx.db
    .query("deliverabilityBuckets")
    .withIndex("by_user_hour", (q) =>
      q.eq("userId", userId).gte("hourStart", from)
    )
    .collect();

  const totals = emptyTotals();
  for (const b of buckets) {
    totals.sends += b.sends;
    totals.delivered += b.delivered;
    totals.hardBounces += b.hardBounces;
    totals.softBounces += b.softBounces;
    totals.complaints += b.complaints;
  }
  return totals;
}

export function ratesFor(totals: WindowTotals): WindowRates {
  if (totals.sends <= 0) {
    return { hardBounceRate: 0, softBounceRate: 0, complaintRate: 0 };
  }
  return {
    hardBounceRate: totals.hardBounces / totals.sends,
    softBounceRate: totals.softBounces / totals.sends,
    complaintRate: totals.complaints / totals.sends,
  };
}

/** Rate as a percentage rounded to 3 decimals, for display and alert copy. */
export function asPercent(rate: number): number {
  return Math.round(rate * 100 * 1000) / 1000;
}

/**
 * Which threshold, if any, the window has crossed. Returns null when the
 * sample is too small to draw a conclusion from.
 */
export function breachFor(
  totals: WindowTotals
): { metric: "hard_bounce_rate" | "complaint_rate"; value: number; threshold: number } | null {
  if (totals.sends < MIN_SAMPLE_SENDS) return null;

  const rates = ratesFor(totals);
  if (rates.hardBounceRate >= HARD_BOUNCE_RATE_THRESHOLD) {
    return {
      metric: "hard_bounce_rate",
      value: rates.hardBounceRate,
      threshold: HARD_BOUNCE_RATE_THRESHOLD,
    };
  }
  if (rates.complaintRate >= COMPLAINT_RATE_THRESHOLD) {
    return {
      metric: "complaint_rate",
      value: rates.complaintRate,
      threshold: COMPLAINT_RATE_THRESHOLD,
    };
  }
  return null;
}

export function metricLabel(metric: "hard_bounce_rate" | "complaint_rate"): string {
  return metric === "hard_bounce_rate" ? "hard bounce rate" : "complaint rate";
}
