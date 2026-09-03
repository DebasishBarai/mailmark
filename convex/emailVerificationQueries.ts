import { v } from "convex/values";
import { query, internalMutation, internalQuery } from "./_generated/server";
import { suppress } from "./suppressions";
import {
  VERIFICATION_TTL_MS,
  normalizeAddress,
  suppressionReasonForResult,
  type VerificationResult,
} from "./lib/sendPolicy";

// ── Queries ──

export const getVerification = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("emailVerifications")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
      .first();
  },
});

export const getVerifications = query({
  args: { emails: v.array(v.string()) },
  handler: async (ctx, { emails }) => {
    const results: Record<string, {
      isValid: boolean;
      syntaxValid: boolean;
      mxValid: boolean;
      reason?: string;
      checkedAt: number;
    } | null> = {};

    for (const email of emails) {
      const record = await ctx.db
        .query("emailVerifications")
        .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
        .first();
      results[email.toLowerCase()] = record
        ? {
            isValid: record.isValid,
            syntaxValid: record.syntaxValid,
            mxValid: record.mxValid,
            reason: record.reason,
            checkedAt: record.checkedAt,
          }
        : null;
    }

    return results;
  },
});

// ── Internal helpers ──

export const getCachedVerification = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("emailVerifications")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
      .first();
  },
});

export const upsertVerification = internalMutation({
  args: {
    email: v.string(),
    isValid: v.boolean(),
    syntaxValid: v.boolean(),
    mxValid: v.boolean(),
    reason: v.optional(v.string()),
    checkedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("emailVerifications")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        isValid: args.isValid,
        syntaxValid: args.syntaxValid,
        mxValid: args.mxValid,
        reason: args.reason,
        checkedAt: args.checkedAt,
      });
    } else {
      await ctx.db.insert("emailVerifications", args);
    }
  },
});

// ── MillionVerifier cache ────────────────────────────────────────────────────
//
// Everything below backs convex/verification.ts. The rule it exists to enforce
// is "never pay twice for the same lookup": a verdict is written here once and
// read from here on every subsequent send, and a lookup is only made when this
// table has nothing fresh to say.

// How long an in-flight lookup suppresses duplicate lookups for the same
// address. Long enough to cover a slow API call, short enough that a lookup
// lost to a crashed action does not wedge the address for a whole day.
const REFRESH_LEASE_MS = 10 * 60 * 1000;

/**
 * Which addresses actually need a paid lookup right now.
 *
 * Called before every call to MillionVerifier. An address is skipped when it
 * has an unexpired verdict, and also when another lookup for it is already in
 * flight, so a hundred queued messages to the same stale address produce one
 * lookup rather than a hundred.
 */
export const selectUnverified = internalQuery({
  args: { emails: v.array(v.string()), ttlMs: v.optional(v.number()) },
  handler: async (ctx, { emails, ttlMs }) => {
    const ttl = ttlMs ?? VERIFICATION_TTL_MS;
    const now = Date.now();
    const needed: string[] = [];
    const seen = new Set<string>();

    for (const raw of emails) {
      const email = normalizeAddress(raw);
      if (seen.has(email)) continue;
      seen.add(email);

      const row = await ctx.db
        .query("emailVerifications")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();

      // No row, or a legacy DNS-only row, or an expired one.
      const fresh =
        row &&
        row.result != null &&
        row.result !== "error" &&
        (row.expiresAt ?? row.checkedAt + ttl) > now;
      if (fresh) continue;

      const leaseHeld =
        row?.refreshStartedAt != null &&
        now - row.refreshStartedAt < REFRESH_LEASE_MS;
      if (leaseHeld) continue;

      needed.push(email);
    }
    return needed;
  },
});

/** Take the in-flight lease on a set of addresses about to be looked up. */
export const markRefreshStarted = internalMutation({
  args: { emails: v.array(v.string()) },
  handler: async (ctx, { emails }) => {
    const now = Date.now();
    for (const raw of emails) {
      const email = normalizeAddress(raw);
      const row = await ctx.db
        .query("emailVerifications")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (row) {
        await ctx.db.patch(row._id, { refreshStartedAt: now });
      } else {
        // Placeholder so the lease exists before the first verdict does.
        await ctx.db.insert("emailVerifications", {
          email,
          isValid: false,
          syntaxValid: true,
          mxValid: false,
          checkedAt: 0,
          refreshStartedAt: now,
        });
      }
    }
  },
});

/**
 * Write verdicts to the cache.
 *
 * The legacy isValid/syntaxValid/mxValid fields are still written so the rows
 * stay readable by the existing tool UI, but they are derived from the
 * MillionVerifier verdict rather than from DNS: isValid now means "we would
 * send to this", which is what every reader of that field assumed it meant.
 *
 * An "error" verdict is recorded but deliberately given no expiry, so it can
 * never be mistaken for a fresh answer by the gate; it exists to release the
 * in-flight lease and to leave a trace of the failed lookup.
 */
export const recordResults = internalMutation({
  args: {
    results: v.array(
      v.object({
        email: v.string(),
        result: v.union(
          v.literal("ok"),
          v.literal("catch_all"),
          v.literal("unknown"),
          v.literal("invalid"),
          v.literal("disposable"),
          v.literal("error")
        ),
        subResult: v.optional(v.string()),
        errorReason: v.optional(v.string()),
      })
    ),
    provider: v.union(
      v.literal("millionverifier"),
      v.literal("millionverifier_bulk")
    ),
    ttlMs: v.optional(v.number()),
    // When set, an invalid or disposable verdict also writes a suppression row
    // for this account, so we stop paying to rediscover a dead address.
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, { results, provider, ttlMs, userId }) => {
    const ttl = ttlMs ?? VERIFICATION_TTL_MS;
    const now = Date.now();
    let written = 0;

    for (const entry of results) {
      const email = normalizeAddress(entry.email);
      const isError = entry.result === "error";
      const fields = {
        email,
        result: entry.result,
        subResult: entry.subResult,
        provider,
        checkedAt: now,
        expiresAt: isError ? undefined : now + ttl,
        refreshStartedAt: undefined,
        isValid: entry.result === "ok" || entry.result === "catch_all",
        syntaxValid: true,
        mxValid: entry.result !== "invalid",
        reason: isError ? entry.errorReason : entry.subResult,
      };

      const existing = await ctx.db
        .query("emailVerifications")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, fields);
      } else {
        await ctx.db.insert("emailVerifications", fields);
      }
      written++;

      if (userId) {
        const reason = suppressionReasonForResult(
          entry.result as VerificationResult
        );
        if (reason) await suppress(ctx, { userId, email, reason });
      }
    }

    return { written };
  },
});

/**
 * Addresses whose verdict has expired, oldest first.
 *
 * Paginated by the caller: this table has a row per address the platform has
 * ever checked, which after the backfill is tens of thousands, so it is read a
 * page at a time and never collected.
 */
export const listExpired = internalQuery({
  args: {
    now: v.number(),
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, { now, paginationOpts }) => {
    return await ctx.db
      .query("emailVerifications")
      .withIndex("by_expires_at", (q) => q.lt("expiresAt", now))
      .paginate(paginationOpts);
  },
});

/**
 * Read several cached verdicts at once, keyed by normalized address.
 *
 * Returns null for an address we have never checked, so a caller can tell
 * "never looked at" apart from "looked at and came back unknown".
 */
export const getCachedVerifications = internalQuery({
  args: { emails: v.array(v.string()) },
  handler: async (ctx, { emails }) => {
    const out: Record<
      string,
      {
        result?: string;
        subResult?: string;
        reason?: string;
        isValid: boolean;
        checkedAt: number;
        expiresAt?: number;
      } | null
    > = {};

    for (const raw of emails) {
      const email = normalizeAddress(raw);
      if (email in out) continue;
      const row = await ctx.db
        .query("emailVerifications")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      out[email] = row
        ? {
            result: row.result,
            subResult: row.subResult,
            reason: row.reason,
            isValid: row.isValid,
            checkedAt: row.checkedAt,
            expiresAt: row.expiresAt,
          }
        : null;
    }
    return out;
  },
});
