import { v } from "convex/values";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  bulkUpload,
  bulkStatus,
  bulkDownload,
  apiKey,
  isNotConfigured,
} from "./lib/millionVerifier";
import { VERIFICATION_TTL_MS } from "./lib/sendPolicy";

/**
 * Bulk backfill of addresses already sitting in the outbox.
 *
 * The queue holds 40,000+ messages to 22,024 unique recipients, all added
 * before any of this existed, and the ramp reaches them over the next three
 * weeks. They need verifying before it does.
 *
 * Bulk, not single: MillionVerifier charges per lookup on the single API and a
 * fraction of that per address in bulk, and 22,024 lookups is the difference
 * between a rounding error and a real bill.
 *
 * Every step is scheduled rather than looped, so no transaction goes near the
 * 32,000 document scan cap and no action runs long enough to be killed. The
 * shape is: walk the outbox a page at a time collecting addresses, submit them
 * in files of 5,000, poll each file, apply its verdicts to the cache in
 * chunks.
 */

// How long to wait between polls of a submitted file. MillionVerifier takes
// minutes to hours depending on list size and queue depth; a five minute poll
// is frequent enough to be responsive and rare enough to be free.
const POLL_INTERVAL_MS = 5 * 60 * 1000;

// How long a submitted file may sit unfinished before it is written off.
// MillionVerifier quotes minutes to hours depending on list size and queue
// depth, so two days is generous while still being finite.
const STALE_BATCH_MS = 48 * 60 * 60 * 1000;

// Verdicts applied per transaction. Each write is a read plus a patch on the
// verifications table, so this stays far inside the transaction caps.
const APPLY_CHUNK = 500;

// Addresses whose cached verdict is checked per transaction before a file goes
// out. Each is an indexed read, and a flush arrives holding up to
// BULK_BATCH_SIZE of them, so the check is chunked for the same reason the
// writes above are: 5,000 reads in one mutation is past what a transaction
// will do, and the throw took the whole scheduled chain with it.
const FRESH_CHUNK = 500;

// How long a walk may go without touching its row before the watchdog assumes
// its chain is gone and starts a new one. A running walk patches the row on
// every page, well under a second apart, so nothing healthy comes close.
const STALL_MS = 10 * 60 * 1000;

// Delay before retrying a step that threw. Long enough for a rate limit or a
// blip to pass, short enough not to stretch a 20,000 address run.
const RETRY_MS = 60 * 1000;

// Consecutive failures of one walk before it is written off. A transient error
// clears on the next attempt; ten in a row is a bug, and retrying it every
// minute forever would only fill the logs.
const MAX_WALK_ERRORS = 10;

/**
 * Handle a step that threw: record it, and either retry it or give up.
 *
 * Convex does not retry a scheduled function that throws, and every step of
 * the walk is one. Before this, any single failure - a transaction over its
 * limits, a deploy landing mid-chain - ended the run in silence, leaving a row
 * that said "collecting" and never changed again.
 */
async function retryStep(
  ctx: ActionCtx,
  runId: string,
  error: unknown,
  step: "collect" | "finalize"
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[backfill] ${step} step failed for run ${runId}:`, message);

  const { found, consecutiveErrors } = await ctx.runMutation(
    internal.verificationBackfillQueries.noteWalkError,
    { runId, error: message }
  );
  // No walk row means the run was deleted out from under us; there is nothing
  // left to retry and rescheduling would spin forever.
  if (!found) return;

  if (consecutiveErrors >= MAX_WALK_ERRORS) {
    await ctx.runMutation(internal.verificationBackfillQueries.finishWalk, {
      runId,
      status: "failed",
      error: `${step} step failed ${consecutiveErrors} times in a row: ${message}`,
    });
    return;
  }

  await ctx.scheduler.runAfter(
    RETRY_MS,
    step === "collect"
      ? internal.verificationBackfill.collectStep
      : internal.verificationBackfill.finalizeWalk,
    { runId }
  );
}

/**
 * Start a backfill run.
 *
 * Pausing sending for the duration is the caller's choice, not this
 * function's: the kill switch is in convex/sendingControls.ts and exists
 * precisely so the queue can be stopped while this runs.
 */
export const start = action({
  args: {},
  handler: async (ctx): Promise<{ runId: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    if (!apiKey()) {
      throw new Error(
        "MILLIONVERIFIER_API_KEY is not set; the backfill cannot run"
      );
    }

    const runId = `backfill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await ctx.runMutation(internal.verificationBackfillQueries.startWalk, {
      runId,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.verificationBackfill.collectStep,
      { runId }
    );
    return { runId };
  },
});

export const startInternal = internalAction({
  args: {},
  handler: async (ctx): Promise<{ runId: string }> => {
    const runId = `backfill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await ctx.runMutation(internal.verificationBackfillQueries.startWalk, {
      runId,
    });
    await ctx.scheduler.runAfter(
      0,
      internal.verificationBackfill.collectStep,
      { runId }
    );
    return { runId };
  },
});

/**
 * One step of the outbox scan.
 *
 * Re-schedules itself until the scan is exhausted, flushing a file to
 * MillionVerifier whenever enough addresses have accumulated.
 */
export const collectStep = internalAction({
  args: { runId: v.string() },
  handler: async (ctx, { runId }): Promise<void> => {
    try {
      const page = await ctx.runMutation(
        internal.verificationBackfillQueries.collectPage,
        { runId }
      );

      if (page.readyToFlush) {
        const flush = await ctx.runAction(
          internal.verificationBackfill.flushBatch,
          { runId }
        );
        if (flush.fatal) {
          await ctx.runMutation(
            internal.verificationBackfillQueries.finishWalk,
            { runId, status: "failed", error: flush.error }
          );
          return;
        }
      }

      if (page.done) {
        // The scan is done, which is not the same as the run being done: the
        // last flush may have left addresses behind. finishWalk used to be
        // called here regardless, which reported a run complete while the
        // recipients it had collected sat unsubmitted on the row.
        await ctx.scheduler.runAfter(
          0,
          internal.verificationBackfill.finalizeWalk,
          { runId }
        );
        return;
      }

      // Immediate re-entry: each step is one page and one transaction, so the
      // work is spread across scheduled calls rather than one long action.
      await ctx.scheduler.runAfter(
        0,
        internal.verificationBackfill.collectStep,
        { runId }
      );
    } catch (error) {
      await retryStep(ctx, runId, error, "collect");
    }
  },
});

/**
 * Submit whatever the scan left over, then close the run.
 *
 * Separate from collectStep because "the outbox has been walked" and "every
 * address collected has been submitted" are different conditions, and only the
 * second one means done.
 */
export const finalizeWalk = internalAction({
  args: { runId: v.string() },
  handler: async (ctx, { runId }): Promise<void> => {
    try {
      const walk = await ctx.runQuery(
        internal.verificationBackfillQueries.getWalk,
        { runId }
      );
      if (!walk) return;
      // Cancelled, superseded, or already closed out.
      if (walk.status !== "collecting" && walk.status !== "uploading") return;

      if ((walk.pending ?? []).length > 0) {
        const flush = await ctx.runAction(
          internal.verificationBackfill.flushBatch,
          { runId }
        );
        if (flush.fatal) {
          await ctx.runMutation(
            internal.verificationBackfillQueries.finishWalk,
            { runId, status: "failed", error: flush.error }
          );
          return;
        }

        const after = await ctx.runQuery(
          internal.verificationBackfillQueries.getWalk,
          { runId }
        );
        if ((after?.pending ?? []).length > 0) {
          // The upload failed in a way worth retrying. Keep the run open and
          // come back to it rather than closing a run whose last file never
          // went out.
          await ctx.scheduler.runAfter(
            RETRY_MS,
            internal.verificationBackfill.finalizeWalk,
            { runId }
          );
          return;
        }
      }

      await ctx.runMutation(internal.verificationBackfillQueries.finishWalk, {
        runId,
        status: "done",
      });
    } catch (error) {
      await retryStep(ctx, runId, error, "finalize");
    }
  },
});

/**
 * Restart runs whose scheduled chain has disappeared.
 *
 * Run from a cron. The file half of the backfill has had this cover since it
 * was written; the walk half did not, so a run that lost its chain - to a
 * deploy, or to a step that threw before steps were retried - stayed at
 * "collecting" indefinitely with no sign of it beyond an updatedAt that had
 * stopped moving.
 */
export const resumeStalled = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    const stalled = await ctx.runQuery(
      internal.verificationBackfillQueries.listStalledWalks,
      { olderThanMs: STALL_MS }
    );

    for (const walk of stalled) {
      const idleMinutes = Math.round((Date.now() - walk.updatedAt) / 60000);
      console.error(
        `[backfill] run ${walk.runId} has not advanced in ${idleMinutes}m at status "${walk.status}"; restarting it`
      );
      // Touch the row before scheduling: the restarted chain is the live one
      // now, and the next tick must not start a second chain beside it.
      await ctx.runMutation(internal.verificationBackfillQueries.touchWalk, {
        walkId: walk._id,
      });
      await ctx.scheduler.runAfter(
        0,
        walk.status === "collecting"
          ? internal.verificationBackfill.collectStep
          : internal.verificationBackfill.finalizeWalk,
        { runId: walk.runId }
      );
    }
  },
});

/**
 * Submit whatever has been collected so far as one bulk file.
 *
 * Nothing leaves the walk row until a file has been created for it. The old
 * order was the other way round - take the addresses off the row, then upload -
 * so an upload that failed for any reason at all lost the addresses outright
 * and marked the whole run failed, with the recipients it had already found
 * left to go out unverified.
 */
export const flushBatch = internalAction({
  args: { runId: v.string() },
  handler: async (
    ctx,
    { runId }
  ): Promise<{ submitted: number; fatal: boolean; error?: string }> => {
    const walk = await ctx.runQuery(
      internal.verificationBackfillQueries.getWalk,
      { runId }
    );
    const pending = walk?.pending ?? [];
    if (pending.length === 0) return { submitted: 0, fatal: false };

    // Drop addresses that already hold a live verdict, a chunk at a time.
    const emails: string[] = [];
    for (let offset = 0; offset < pending.length; offset += FRESH_CHUNK) {
      const unverified = await ctx.runQuery(
        internal.verificationBackfillQueries.filterUnverified,
        {
          emails: pending.slice(offset, offset + FRESH_CHUNK),
          ttlMs: VERIFICATION_TTL_MS,
        }
      );
      emails.push(...unverified);
    }

    if (emails.length === 0) {
      // Everything collected is already known. Clear it, or the same addresses
      // are re-checked on every later flush and the walk never drains.
      await ctx.runMutation(internal.verificationBackfillQueries.dropPending, {
        runId,
        emails: pending,
      });
      return { submitted: 0, fatal: false };
    }

    // Timestamped: a run flushes once per BULK_BATCH_SIZE, so a single
    // `${runId}.txt` named every file the run ever uploaded.
    const upload = await bulkUpload(emails, `${runId}-${Date.now()}.txt`);
    if (!upload.ok) {
      console.error("[backfill] bulk upload failed:", upload.error);
      await ctx.runMutation(internal.verificationBackfillQueries.noteWalkError, {
        runId,
        error: `bulk upload failed: ${upload.error}`,
      });
      // The addresses stay on the row for the next flush to retry. Only an
      // unset key is worth ending the run over: it will answer the same way
      // every time until someone sets it.
      return {
        submitted: 0,
        fatal: isNotConfigured(upload.error),
        error: upload.error,
      };
    }

    await ctx.runMutation(
      internal.verificationBackfillQueries.createFileBatch,
      { runId, fileId: upload.fileId, emails }
    );

    // Only now, with the file recorded and therefore pollable, is it safe to
    // forget these addresses: each was either submitted or already known.
    await ctx.runMutation(internal.verificationBackfillQueries.dropPending, {
      runId,
      emails: pending,
    });

    await ctx.scheduler.runAfter(
      POLL_INTERVAL_MS,
      internal.verificationBackfill.pollFiles,
      {}
    );
    return { submitted: emails.length, fatal: false };
  },
});

/**
 * Poll every submitted file that has not finished, and apply the ones that
 * have. Also runs from a cron, so a file survives a lost scheduled job.
 */
export const pollFiles = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    const batches = await ctx.runQuery(
      internal.verificationBackfillQueries.listUnfinishedFiles,
      {}
    );
    if (batches.length === 0) return;

    let anyPending = false;

    for (const batch of batches) {
      if (!batch.fileId) continue;

      const status = await bulkStatus(batch.fileId);
      if (!status.ok) {
        console.error(
          `[backfill] status check failed for file ${batch.fileId}:`,
          status.error
        );
        // A terminal failure will not change on the next poll. Record it and
        // stop, rather than asking about the same dead file every fifteen
        // minutes forever.
        await ctx.runMutation(internal.verificationBackfillQueries.updateBatch, {
          batchId: batch._id,
          lastError: status.error,
          ...(status.terminal
            ? { status: "failed" as const, finished: true }
            : {}),
        });
        if (!status.terminal) anyPending = true;
        continue;
      }

      if (!status.finished) {
        // Give up on a file that has been in progress implausibly long. Without
        // this, a file MillionVerifier silently loses would be polled for the
        // life of the deployment.
        if (Date.now() - batch.startedAt > STALE_BATCH_MS) {
          console.error(
            `[backfill] file ${batch.fileId} still unfinished after ${Math.round(STALE_BATCH_MS / 3600000)}h, giving up`
          );
          await ctx.runMutation(
            internal.verificationBackfillQueries.updateBatch,
            {
              batchId: batch._id,
              status: "failed",
              lastError: "timed out waiting for MillionVerifier to finish",
              finished: true,
            }
          );
          continue;
        }
        anyPending = true;
        continue;
      }

      await ctx.runMutation(internal.verificationBackfillQueries.updateBatch, {
        batchId: batch._id,
        status: "applying",
        resultCounts: status.counts,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.verificationBackfill.applyResults,
        { batchId: batch._id, offset: 0 }
      );
    }

    if (anyPending) {
      await ctx.scheduler.runAfter(
        POLL_INTERVAL_MS,
        internal.verificationBackfill.pollFiles,
        {}
      );
    }
  },
});

/**
 * Download a finished file's verdicts and write them to the cache in chunks.
 *
 * The download happens once and is re-fetched per chunk rather than held in
 * memory across scheduled calls; for a 5,000 address file that is a handful of
 * requests, which is cheaper than the alternative of one very long action.
 */
export const applyResults = internalAction({
  args: { batchId: v.id("verificationBatches"), offset: v.number() },
  handler: async (ctx, { batchId, offset }): Promise<void> => {
    const batch = await ctx.runQuery(
      internal.verificationBackfillQueries.getBatch,
      { batchId }
    );
    if (!batch || !batch.fileId) return;

    const download = await bulkDownload(batch.fileId);
    if (!download.ok) {
      console.error("[backfill] download failed:", download.error);
      // Back to "processing" so the next poll retries it, rather than
      // abandoning a file we have already paid for.
      await ctx.runMutation(internal.verificationBackfillQueries.updateBatch, {
        batchId,
        status: "processing",
        lastError: download.error,
      });
      return;
    }

    // A finished file that yields no rows at all, when we submitted addresses,
    // is a failed download rather than an empty report. Marking it applied
    // would throw away verdicts we have already paid for and leave the
    // addresses looking unverified forever.
    if (download.rows.length === 0 && (batch.total ?? 0) > 0) {
      console.error(
        `[backfill] file ${batch.fileId} returned no rows for ${batch.total} submitted addresses; will retry`
      );
      await ctx.runMutation(internal.verificationBackfillQueries.updateBatch, {
        batchId,
        status: "processing",
        lastError: "download returned no rows",
      });
      return;
    }

    const chunk = download.rows.slice(offset, offset + APPLY_CHUNK);
    if (chunk.length > 0) {
      await ctx.runMutation(internal.emailVerificationQueries.recordResults, {
        results: chunk.map((row) => ({
          email: row.email,
          result: row.result,
        })),
        provider: "millionverifier_bulk",
        // No userId: a bulk file spans every account's recipients, so there is
        // no single account to attribute an invalid verdict to. The gate still
        // blocks those addresses on the verdict itself; what is skipped is
        // writing a per-account suppression row, which would be wrong here.
      });
    }

    const applied = offset + chunk.length;
    await ctx.runMutation(internal.verificationBackfillQueries.updateBatch, {
      batchId,
      appliedCount: applied,
    });

    if (applied < download.rows.length) {
      await ctx.scheduler.runAfter(
        0,
        internal.verificationBackfill.applyResults,
        { batchId, offset: applied }
      );
      return;
    }

    await ctx.runMutation(internal.verificationBackfillQueries.updateBatch, {
      batchId,
      status: "done",
      finished: true,
    });
  },
});
