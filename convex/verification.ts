import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  verifyOne,
  isNotConfigured,
  type MvLookup,
} from "./lib/millionVerifier";
import { normalizeAddress, isPlausibleAddress } from "./lib/sendPolicy";

/**
 * Verification orchestration.
 *
 * The cache is the contract: nothing here calls MillionVerifier for an address
 * that already has an unexpired verdict, or for one another lookup is already
 * in flight for. convex/emailVerificationQueries.ts enforces both.
 *
 * These are actions, so they perform network I/O and must never be awaited
 * from inside a bulk send. The send gate reads the cache instead
 * (convex/sendGate.ts) and schedules one of these when it finds a gap.
 */

// How many single lookups to run at once. MillionVerifier's single API is
// per-call charged and rate limited; a small fan-out keeps an interactive
// compose responsive without inviting a 429.
const SINGLE_CONCURRENCY = 5;

async function lookupAll(emails: string[]): Promise<MvLookup[]> {
  const results: MvLookup[] = [];
  for (let i = 0; i < emails.length; i += SINGLE_CONCURRENCY) {
    const slice = emails.slice(i, i + SINGLE_CONCURRENCY);
    results.push(...(await Promise.all(slice.map((email) => verifyOne(email)))));

    // An outage is an outage: once one call reports out of credits, a blocked
    // IP, an unusable key or an unreachable host, the rest of the batch fails
    // identically and each attempt costs latency. Stop, and let the send
    // policy decide what a missing verdict means.
    //
    // This keys off the `systemic` flag the client derives from `resultcode`,
    // not off the wording of the error. The service's own error text is not
    // stable - its docs give "apikey_not_found" for a bad key while the live
    // API answers "Api key not found" - and an earlier version of this matched
    // substrings, which silently failed to recognise "IP address blocked",
    // "Internal error" and "No apikey specified" as systemic at all.
    const systemic = results.find(
      (r) => r.result === "error" && r.systemic
    );
    if (systemic) {
      const remaining = emails.slice(i + SINGLE_CONCURRENCY);
      const reason = systemic.errorReason ?? "verifier unavailable";
      for (const email of remaining) {
        results.push({ email, result: "error", errorReason: reason, systemic: true });
      }
      break;
    }
  }
  return results;
}

/**
 * Verify a set of addresses and write the verdicts to the cache.
 *
 * Returns what it wrote, so an interactive caller can act on it immediately
 * rather than re-reading. Safe to call with addresses that are already
 * verified: those are filtered out before any paid call is made.
 */
export const verifyAddresses = internalAction({
  args: {
    emails: v.array(v.string()),
    // Attributes invalid/disposable verdicts to an account, which also writes
    // a suppression row so the address is never looked up again.
    userId: v.optional(v.id("users")),
    ttlMs: v.optional(v.number()),
  },
  handler: async (ctx, { emails, userId, ttlMs }): Promise<{
    verified: number;
    skipped: number;
    outage: boolean;
  }> => {
    const candidates = emails
      .map(normalizeAddress)
      .filter((email) => isPlausibleAddress(email));

    const needed: string[] = await ctx.runQuery(
      internal.emailVerificationQueries.selectUnverified,
      { emails: candidates, ttlMs }
    );

    if (needed.length === 0) {
      return { verified: 0, skipped: candidates.length, outage: false };
    }

    // Claim the addresses before the network call, so a second caller for the
    // same address does not pay for the same lookup in parallel.
    await ctx.runMutation(
      internal.emailVerificationQueries.markRefreshStarted,
      { emails: needed }
    );

    const lookups = await lookupAll(needed);

    await ctx.runMutation(internal.emailVerificationQueries.recordResults, {
      results: lookups.map((l) => ({
        email: l.email,
        result: l.result,
        subResult: l.subResult,
        errorReason: l.errorReason,
      })),
      provider: "millionverifier",
      ttlMs,
      userId,
    });

    const outage = lookups.some((l) => l.result === "error" && l.systemic);
    if (outage) {
      const reason = lookups.find((l) => l.result === "error" && l.systemic)
        ?.errorReason;
      // Say plainly which of the two problems this is. An unset key looks
      // exactly like an outage from the outside, and it will halt the whole
      // queue just as effectively, so it must not be buried in a generic
      // "unavailable" line.
      if (isNotConfigured(reason)) {
        console.error(
          "[verification] MILLIONVERIFIER_API_KEY is not set on this deployment. " +
            "No address can be verified, so sends will hold. Set it with: " +
            "npx convex env set MILLIONVERIFIER_API_KEY <key>"
        );
      } else {
        console.warn("[verification] MillionVerifier unavailable:", reason);
      }
    }

    return {
      verified: lookups.length,
      skipped: candidates.length - needed.length,
      outage,
    };
  },
});

/**
 * Fire-and-forget verification, for use from a mutation.
 *
 * Contact ingestion schedules this so a newly added address is verified long
 * before anybody tries to mail it, which is the whole point of verifying at
 * ingestion: by the time a send needs an answer, the cache already has one and
 * the send costs nothing.
 */
export const verifyAddressesAsync = internalAction({
  args: {
    emails: v.array(v.string()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, { emails, userId }): Promise<void> => {
    await ctx.runAction(internal.verification.verifyAddresses, {
      emails,
      userId,
    });
  },
});

/**
 * Verify on demand for the signed-in user.
 *
 * Replaces the DNS-and-MX check the compose screen's "verify recipients"
 * button used to run. That check could only tell whether a domain accepts mail
 * at all, which every one of the 643 addresses that hard bounced did.
 */
export const verifyForCurrentUser = action({
  args: { emails: v.array(v.string()) },
  handler: async (
    ctx,
    { emails }
  ): Promise<{
    results: Array<{
      email: string;
      result: string;
      isValid: boolean;
      reason?: string;
    }>;
    summary: { total: number; valid: number; invalid: number; unknown: number };
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Bounded: this is a user-facing button, not a list import. The bulk
    // backfill exists for anything larger.
    if (emails.length > 100) {
      throw new Error("Verify at most 100 addresses at a time");
    }

    await ctx.runAction(internal.verification.verifyAddresses, { emails });

    const cached: Record<
      string,
      { result?: string; reason?: string; isValid: boolean } | null
    > = await ctx.runQuery(
      internal.emailVerificationQueries.getCachedVerifications,
      { emails: emails.map(normalizeAddress) }
    );

    const results = emails.map((raw) => {
      const email = normalizeAddress(raw);
      const row = cached[email];
      return {
        email,
        result: row?.result ?? "error",
        isValid: row?.isValid ?? false,
        reason: row?.reason,
      };
    });

    return {
      results,
      summary: {
        total: results.length,
        valid: results.filter((r) => r.result === "ok" || r.result === "catch_all")
          .length,
        invalid: results.filter(
          (r) => r.result === "invalid" || r.result === "disposable"
        ).length,
        unknown: results.filter(
          (r) => r.result === "unknown" || r.result === "error"
        ).length,
      },
    };
  },
});

/**
 * Re-verify addresses whose verdict has expired.
 *
 * Runs from a cron. Paginates: after the backfill this table holds tens of
 * thousands of rows and a transaction may scan 32,000, so a page is taken per
 * transaction and the sweep re-arms itself until it runs out.
 *
 * Deliberately bounded per run rather than exhaustive. At a 90 day TTL roughly
 * a ninetieth of the table expires each day, and re-verifying it in
 * daily-sized bites keeps the spend flat instead of arriving as one bill.
 */
export const revalidateExpired = internalAction({
  args: {
    cursor: v.optional(v.string()),
    processed: v.optional(v.number()),
    maxPerRun: v.optional(v.number()),
  },
  handler: async (ctx, { cursor, processed, maxPerRun }): Promise<void> => {
    const limit = maxPerRun ?? 2000;
    const done = processed ?? 0;
    if (done >= limit) return;

    const page = await ctx.runQuery(
      internal.emailVerificationQueries.listExpired,
      {
        now: Date.now(),
        paginationOpts: { cursor: cursor ?? null, numItems: 200 },
      }
    );

    // listExpired already restricts this to rows that carry a real, aged-out
    // verdict; legacy and failed rows are excluded there.
    const emails = page.page
      .map((row: { email: string }) => row.email)
      .filter((email: string) => isPlausibleAddress(email));

    if (emails.length > 0) {
      const outcome = await ctx.runAction(
        internal.verification.verifyAddresses,
        { emails }
      );
      // Stop the sweep on an outage rather than burning the rest of the run
      // against an API that is not answering. The next cron picks it up.
      if (outcome.outage) {
        console.warn("[verification] revalidation halted: verifier unavailable");
        return;
      }
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.verification.revalidateExpired,
        {
          cursor: page.continueCursor,
          processed: done + emails.length,
          maxPerRun: limit,
        }
      );
    }
  },
});
