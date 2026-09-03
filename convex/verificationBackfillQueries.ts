import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  query,
  type DatabaseReader,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { normalizeAddress, isPlausibleAddress } from "./lib/sendPolicy";

/**
 * Database half of the bulk backfill. The action half is in
 * convex/verificationBackfill.ts.
 *
 * Everything here is paginated. The outbox holds 40,000+ rows against a
 * per-transaction cap of 32,000 documents scanned and 16 MiB read, so no step
 * may read the whole thing; each takes a page, records where it got to, and
 * hands off to the next transaction.
 */

// One page of mailboxes, and one page of a mailbox's outbox. Both small enough
// that a step stays well inside the transaction caps even when every row is
// wide.
const MAILBOX_PAGE = 50;
const OUTBOX_PAGE = 400;

/**
 * Addresses collected before a file is submitted to MillionVerifier.
 *
 * The binding constraint is the 1 MiB *document* limit, not the 16 MiB
 * transaction read limit: this array is stored inline on the walk row. At
 * roughly 30 bytes per address, 5,000 is about 150 KB, and the walk can
 * overflow by up to one page of recipients before it flushes (see collectPage),
 * so the real peak is nearer 200 KB. That leaves comfortable headroom.
 *
 * Raising this is not free: 30,000 addresses would put the row within reach of
 * the 1 MiB ceiling, and a walk row that fails to write strands the run.
 */
export const BULK_BATCH_SIZE = 5000;

/**
 * The one walk row for a run.
 *
 * By runId *and* kind. Every caller here used to collect the whole run and
 * pick the walk out of it, which meant re-reading every file row - each one
 * carrying the 5,000 addresses it submitted - on every step of a scan that
 * runs hundreds of steps.
 */
async function walkRow(db: DatabaseReader, runId: string) {
  return await db
    .query("verificationBatches")
    .withIndex("by_run_kind", (q) => q.eq("runId", runId).eq("kind", "walk"))
    .first();
}

export const getWalk = internalQuery({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => await walkRow(ctx.db, runId),
});

export const startWalk = internalMutation({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const now = Date.now();
    return await ctx.db.insert("verificationBatches", {
      kind: "walk",
      runId,
      status: "collecting",
      pending: [],
      startedAt: now,
      updatedAt: now,
      total: 0,
      consecutiveErrors: 0,
    });
  },
});

/**
 * Advance the outbox scan by one page and collect the recipients it finds.
 *
 * Walks mailboxes, and within each mailbox walks its outbox folder, because
 * the emails table is only indexed by (mailboxId, folder) and there is no
 * global "everything in the outbox" index to range over. Two cursors are
 * therefore carried: where we are in the mailbox list, and where we are in the
 * current mailbox's outbox.
 *
 * Addresses that already have a fresh verdict are dropped here rather than
 * submitted, so the file we pay for contains only addresses we do not know
 * about.
 */
// Sentinel for "the mailbox listing is exhausted", which an absent cursor
// cannot express: undefined also means "not started".
const MAILBOXES_DONE = "DONE";

export const collectPage = internalMutation({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const walk = await walkRow(ctx.db, runId);

    // A newer run has taken over, or this one was cancelled.
    if (!walk || walk.status !== "collecting") {
      return { done: true, collected: 0, readyToFlush: false, scanned: 0 };
    }

    const collected = new Set(walk.pending ?? []);
    const before = collected.size;

    let currentMailboxId = walk.currentMailboxId ?? null;
    let mailboxCursor = walk.mailboxCursor;
    let queue = [...(walk.mailboxQueue ?? [])];

    // Pick the next mailbox to walk: from the queue if there is one, otherwise
    // by taking another page of the mailbox listing.
    if (!currentMailboxId) {
      if (queue.length === 0 && mailboxCursor !== MAILBOXES_DONE) {
        // take(), not paginate().
        //
        // Convex allows one paginate() per transaction, and this function
        // already spends it on the outbox read below. Calling it twice threw,
        // which rolled the whole mutation back - including the patch that
        // records progress - so the walk row sat at its initial state looking
        // as though the step had never run at all. Every other walk in this
        // codebase (platformStats) calls paginate exactly once; this was the
        // only one that did not.
        //
        // The mailbox list is small enough not to need a real cursor, so it is
        // walked by creation-time watermark instead, stored in mailboxCursor.
        const after = mailboxCursor ? Number(mailboxCursor) : null;
        const nextMailboxes = await (
          after === null
            ? ctx.db.query("mailboxes").withIndex("by_creation_time")
            : ctx.db
                .query("mailboxes")
                .withIndex("by_creation_time", (q) =>
                  q.gt("_creationTime", after)
                )
        ).take(MAILBOX_PAGE);

        queue = nextMailboxes.map((m) => m._id);
        // A short page means there are no more mailboxes after this one.
        mailboxCursor =
          nextMailboxes.length < MAILBOX_PAGE
            ? MAILBOXES_DONE
            : String(nextMailboxes[nextMailboxes.length - 1]._creationTime);
      }

      if (queue.length === 0) {
        // Nothing left anywhere: the scan is complete.
        await ctx.db.patch(walk._id, {
          status: "uploading",
          pending: [...collected],
          mailboxCursor,
          mailboxQueue: [],
          currentMailboxId: undefined,
          emailCursor: undefined,
          consecutiveErrors: 0,
          updatedAt: Date.now(),
        });
        return {
          done: true,
          collected: 0,
          readyToFlush: collected.size > 0,
          scanned: 0,
        };
      }

      currentMailboxId = queue[0];
      queue = queue.slice(1);
    }

    const outboxPage = await ctx.db
      .query("emails")
      .withIndex("by_mailbox_folder", (q) =>
        q.eq("mailboxId", currentMailboxId!).eq("folder", "outbox")
      )
      .paginate({
        cursor: walk.currentMailboxId ? (walk.emailCursor ?? null) : null,
        numItems: OUTBOX_PAGE,
      });

    for (const email of outboxPage.page) {
      for (const address of [
        ...email.to,
        ...(email.cc ?? []),
        ...(email.bcc ?? []),
      ]) {
        const normalized = normalizeAddress(address);
        if (!isPlausibleAddress(normalized)) continue;
        // Every address on this page is collected, even past the batch size.
        //
        // The obvious alternative - stop adding once the batch is full - loses
        // addresses: the page cursor has already moved past them, so a
        // recipient skipped here would never be collected by any later step
        // and would go out unverified. The batch size is a flush threshold,
        // not a hard cap. Overflow is bounded by one page (OUTBOX_PAGE
        // messages times their recipients), a few hundred KB at worst against
        // a 16 MiB document limit.
        collected.add(normalized);
      }
    }
    const full = collected.size >= BULK_BATCH_SIZE;

    const mailboxFinished = outboxPage.isDone;
    const finished =
      mailboxFinished && queue.length === 0 && mailboxCursor === MAILBOXES_DONE;

    await ctx.db.patch(walk._id, {
      pending: [...collected],
      mailboxQueue: queue,
      mailboxCursor,
      currentMailboxId: mailboxFinished ? undefined : currentMailboxId,
      emailCursor: mailboxFinished ? undefined : outboxPage.continueCursor,
      total: (walk.total ?? 0) + outboxPage.page.length,
      status: finished ? "uploading" : "collecting",
      consecutiveErrors: 0,
      updatedAt: Date.now(),
    });

    return {
      done: finished,
      collected: collected.size - before,
      readyToFlush: full || finished,
      scanned: outboxPage.page.length,
    };
  },
});

/**
 * Of the addresses handed in, the ones that still need verifying.
 *
 * Called a chunk at a time (see FRESH_CHUNK in verificationBackfill.ts), which
 * is the whole point of it. This was takePending, which did the same lookup for
 * every address on the walk row in a single mutation - up to the full
 * BULK_BATCH_SIZE of 5,000 indexed reads, each one a separate round trip
 * against a transaction that may run for one second and scan 32,000 documents.
 * It is the one step in the flush that can throw while leaving the walk row
 * untouched, which is exactly the state the first production run stalled in:
 * pending full, status still "collecting", updatedAt frozen six seconds after
 * the run began. APPLY_CHUNK already chunks the write side for this reason;
 * the read side was simply missed.
 *
 * A query, not a mutation: it decides what to submit and changes nothing, so a
 * failed upload leaves the addresses where they were. See dropPending.
 */
export const filterUnverified = internalQuery({
  args: { emails: v.array(v.string()), ttlMs: v.optional(v.number()) },
  handler: async (ctx, { emails, ttlMs }) => {
    const now = Date.now();
    const unverified: string[] = [];
    for (const email of emails) {
      const cached = await ctx.db
        .query("emailVerifications")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      const fresh =
        cached &&
        cached.result != null &&
        cached.result !== "error" &&
        (cached.expiresAt ?? cached.checkedAt + (ttlMs ?? 0)) > now;
      // Never pay twice: an address with a live verdict is not submitted.
      if (!fresh) unverified.push(email);
    }
    return unverified;
  },
});

/**
 * Forget addresses the flush has finished with: submitted in a file, or
 * dropped because they already held a live verdict.
 *
 * Removes the named addresses rather than emptying the array, so anything a
 * concurrent collect step has added since survives, and so a flush that failed
 * before this point leaves every address in place to be retried.
 */
export const dropPending = internalMutation({
  args: { runId: v.string(), emails: v.array(v.string()) },
  handler: async (ctx, { runId, emails }) => {
    const walk = await walkRow(ctx.db, runId);
    if (!walk) return;
    const handled = new Set(emails);
    await ctx.db.patch(walk._id, {
      pending: (walk.pending ?? []).filter((email) => !handled.has(email)),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Record that a step threw, and report how many have thrown in a row.
 *
 * Also bumps updatedAt, so a run that is failing and retrying does not look
 * stalled to the watchdog and get a second chain started alongside it.
 */
export const noteWalkError = internalMutation({
  args: { runId: v.string(), error: v.string() },
  handler: async (ctx, { runId, error }) => {
    const walk = await walkRow(ctx.db, runId);
    if (!walk) return { found: false, consecutiveErrors: 0 };
    const consecutiveErrors = (walk.consecutiveErrors ?? 0) + 1;
    await ctx.db.patch(walk._id, {
      consecutiveErrors,
      lastError: error,
      updatedAt: Date.now(),
    });
    return { found: true, consecutiveErrors };
  },
});

/**
 * Runs whose scheduled chain has gone away.
 *
 * A healthy walk patches its row on every page, a fraction of a second apart,
 * so a row that has not moved in minutes has no chain behind it any more: the
 * step that was to schedule the next one threw, or a deploy landed on it. The
 * file half of the backfill has had a cron to cover that since it was written
 * (see "poll bulk verification files"); the walk half had nothing, which is
 * why a stalled run stayed stalled until someone noticed.
 */
export const listStalledWalks = internalQuery({
  args: { olderThanMs: v.number() },
  handler: async (ctx, { olderThanMs }) => {
    const cutoff = Date.now() - olderThanMs;
    const stalled: Doc<"verificationBatches">[] = [];
    // Both live statuses: "collecting" is mid-scan, "uploading" is a scan that
    // finished but whose last file never made it out.
    for (const status of ["collecting", "uploading"] as const) {
      const rows = await ctx.db
        .query("verificationBatches")
        .withIndex("by_kind_status", (q) =>
          q.eq("kind", "walk").eq("status", status)
        )
        .take(25);
      stalled.push(...rows.filter((row) => row.updatedAt < cutoff));
    }
    return stalled;
  },
});

/** Mark a walk as just touched, so the next watchdog tick leaves it alone. */
export const touchWalk = internalMutation({
  args: { walkId: v.id("verificationBatches") },
  handler: async (ctx, { walkId }) => {
    await ctx.db.patch(walkId, { updatedAt: Date.now() });
  },
});

export const createFileBatch = internalMutation({
  args: { runId: v.string(), fileId: v.string(), emails: v.array(v.string()) },
  handler: async (ctx, { runId, fileId, emails }) => {
    const now = Date.now();
    return await ctx.db.insert("verificationBatches", {
      kind: "file",
      runId,
      status: "processing",
      fileId,
      emails,
      total: emails.length,
      appliedCount: 0,
      startedAt: now,
      updatedAt: now,
    });
  },
});

export const listUnfinishedFiles = internalQuery({
  args: {},
  handler: async (ctx) => {
    const processing = await ctx.db
      .query("verificationBatches")
      .withIndex("by_kind_status", (q) =>
        q.eq("kind", "file").eq("status", "processing")
      )
      .take(25);
    const applying = await ctx.db
      .query("verificationBatches")
      .withIndex("by_kind_status", (q) =>
        q.eq("kind", "file").eq("status", "applying")
      )
      .take(25);
    return [...processing, ...applying];
  },
});

/**
 * One batch by id.
 *
 * applyResults used to find its batch by scanning listUnfinishedFiles, which
 * takes at most 25 rows: past that a batch would quietly never be applied
 * despite having been paid for.
 */
export const getBatch = internalQuery({
  args: { batchId: v.id("verificationBatches") },
  handler: async (ctx, { batchId }) => await ctx.db.get(batchId),
});

export const updateBatch = internalMutation({
  args: {
    batchId: v.id("verificationBatches"),
    status: v.optional(
      v.union(
        v.literal("collecting"),
        v.literal("uploading"),
        v.literal("processing"),
        v.literal("applying"),
        v.literal("done"),
        v.literal("failed")
      )
    ),
    appliedCount: v.optional(v.number()),
    resultCounts: v.optional(v.any()),
    lastError: v.optional(v.string()),
    finished: v.optional(v.boolean()),
  },
  handler: async (ctx, { batchId, status, appliedCount, resultCounts, lastError, finished }) => {
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (status !== undefined) patch.status = status;
    if (appliedCount !== undefined) patch.appliedCount = appliedCount;
    if (resultCounts !== undefined) patch.resultCounts = resultCounts;
    if (lastError !== undefined) patch.lastError = lastError;
    if (finished) patch.finishedAt = Date.now();
    await ctx.db.patch(batchId, patch);
  },
});

export const finishWalk = internalMutation({
  args: { runId: v.string(), status: v.union(v.literal("done"), v.literal("failed")), error: v.optional(v.string()) },
  handler: async (ctx, { runId, status, error }) => {
    const walk = await walkRow(ctx.db, runId);
    if (!walk) return;
    await ctx.db.patch(walk._id, {
      status,
      lastError: error,
      finishedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/** Progress view for the dashboard. */
export const getProgress = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    // Bounded read: the most recent batches only, never the whole table.
    const recent = await ctx.db.query("verificationBatches").order("desc").take(25);
    return recent.map((batch) => ({
      id: batch._id,
      kind: batch.kind,
      runId: batch.runId,
      status: batch.status,
      fileId: batch.fileId ?? null,
      total: batch.total ?? 0,
      applied: batch.appliedCount ?? 0,
      resultCounts: batch.resultCounts ?? null,
      startedAt: batch.startedAt,
      finishedAt: batch.finishedAt ?? null,
      lastError: batch.lastError ?? null,
    }));
  },
});
