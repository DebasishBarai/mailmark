import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  bulkUpload,
  bulkStatus,
  bulkDownload,
  apiKey,
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

// Verdicts applied per transaction. Each write is a read plus a patch on the
// verifications table, so this stays far inside the transaction caps.
const APPLY_CHUNK = 500;

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
    const page = await ctx.runMutation(
      internal.verificationBackfillQueries.collectPage,
      { runId }
    );

    if (page.readyToFlush) {
      await ctx.runAction(internal.verificationBackfill.flushBatch, { runId });
    }

    if (page.done) {
      await ctx.runMutation(internal.verificationBackfillQueries.finishWalk, {
        runId,
        status: "done",
      });
      return;
    }

    // Immediate re-entry: each step is one page and one transaction, so the
    // work is spread across scheduled calls rather than one long action.
    await ctx.scheduler.runAfter(
      0,
      internal.verificationBackfill.collectStep,
      { runId }
    );
  },
});

/** Submit whatever has been collected so far as one bulk file. */
export const flushBatch = internalAction({
  args: { runId: v.string() },
  handler: async (ctx, { runId }): Promise<{ submitted: number }> => {
    const { emails } = await ctx.runMutation(
      internal.verificationBackfillQueries.takePending,
      { runId, ttlMs: VERIFICATION_TTL_MS }
    );
    if (emails.length === 0) return { submitted: 0 };

    const upload = await bulkUpload(emails, `${runId}.txt`);
    if (!upload.ok) {
      console.error("[backfill] bulk upload failed:", upload.error);
      await ctx.runMutation(internal.verificationBackfillQueries.finishWalk, {
        runId,
        status: "failed",
        error: upload.error,
      });
      return { submitted: 0 };
    }

    await ctx.runMutation(
      internal.verificationBackfillQueries.createFileBatch,
      { runId, fileId: upload.fileId, emails }
    );

    await ctx.scheduler.runAfter(
      POLL_INTERVAL_MS,
      internal.verificationBackfill.pollFiles,
      {}
    );
    return { submitted: emails.length };
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
        await ctx.runMutation(internal.verificationBackfillQueries.updateBatch, {
          batchId: batch._id,
          lastError: status.error,
        });
        anyPending = true;
        continue;
      }

      if (!status.finished) {
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
