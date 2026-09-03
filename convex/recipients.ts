import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { recordRecipients, recordRecipientsForMailbox } from "./lib/recipients";

/**
 * Backfill of users.recipientCount and the recipients table.
 *
 * The audience of every account predates the table that measures it, so it has
 * to be reconstructed from the mail already sent: every address in the to, cc
 * and bcc of each sent and outbox row, plus every sequence enrollment.
 *
 * No cutoff or snapshot scheme here, unlike the contacts backfill. Recording is
 * idempotent (lib/recipients.ts dedups on by_user_email and only an actual
 * insert moves the count), so a send landing mid walk needs no reconciliation
 * and a re-run over mail already walked adds nothing. That also makes this
 * safe to run repeatedly as drift repair.
 *
 * Every step is scheduled rather than looped so no transaction goes near the
 * 32,000 document scan cap, and each page records its whole address list in one
 * call so the user row is patched once per page rather than once per message.
 */

const USER_PAGE = 100;
const MAILBOX_PAGE = 100;
const EMAIL_PAGE = 200;
const SEQUENCE_PAGE = 100;
const ENROLLMENT_PAGE = 500;

// The folders that mean "this user sent this". Inbox and trash are not the
// user's audience: inbox is who wrote to them, and a trashed draft was never
// committed to. Outbox is included because scheduled mail is a commitment.
const SENT_FOLDERS = ["sent", "outbox"] as const;

/** Rebuild the audience for every user. Run from the Convex dashboard. */
export const startRecipientBackfill = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query("users")
      .paginate({ cursor: cursor ?? null, numItems: USER_PAGE });

    for (const user of page.page) {
      await ctx.scheduler.runAfter(0, internal.recipients.backfillUserRecipients, {
        userId: user._id,
      });
      await ctx.scheduler.runAfter(
        0,
        internal.recipients.backfillUserSequenceRecipients,
        { userId: user._id }
      );
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.recipients.startRecipientBackfill, {
        cursor: page.continueCursor,
      });
    }
  },
});

/** Fan out over one user's mailboxes. */
export const backfillUserRecipients = internalMutation({
  args: { userId: v.id("users"), cursor: v.optional(v.string()) },
  handler: async (ctx, { userId, cursor }) => {
    const page = await ctx.db
      .query("mailboxes")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .paginate({ cursor: cursor ?? null, numItems: MAILBOX_PAGE });

    for (const mailbox of page.page) {
      await ctx.scheduler.runAfter(
        0,
        internal.recipients.backfillMailboxRecipients,
        { mailboxId: mailbox._id, folderIndex: 0 }
      );
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.recipients.backfillUserRecipients, {
        userId,
        cursor: page.continueCursor,
      });
    }
  },
});

/** Walk one mailbox's sent mail, one folder and one page at a time. */
export const backfillMailboxRecipients = internalMutation({
  args: {
    mailboxId: v.id("mailboxes"),
    folderIndex: v.number(),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, { mailboxId, folderIndex, cursor }) => {
    const folder = SENT_FOLDERS[folderIndex];
    // Walked every folder, or the mailbox was deleted mid walk.
    if (!folder) return;
    if (!(await ctx.db.get(mailboxId))) return;

    const page = await ctx.db
      .query("emails")
      .withIndex("by_mailbox_folder", (q) =>
        q.eq("mailboxId", mailboxId).eq("folder", folder)
      )
      .paginate({ cursor: cursor ?? null, numItems: EMAIL_PAGE });

    const addresses: (string | undefined)[] = [];
    for (const email of page.page) {
      addresses.push(...email.to, ...(email.cc ?? []), ...(email.bcc ?? []));
    }
    // One call for the whole page: it dedups internally and patches the user
    // row once, instead of once per message.
    await recordRecipientsForMailbox(ctx, mailboxId, addresses);

    await ctx.scheduler.runAfter(
      0,
      internal.recipients.backfillMailboxRecipients,
      page.isDone
        ? { mailboxId, folderIndex: folderIndex + 1 }
        : { mailboxId, folderIndex, cursor: page.continueCursor }
    );
  },
});

/** Fan out over one user's sequences. */
export const backfillUserSequenceRecipients = internalMutation({
  args: { userId: v.id("users"), cursor: v.optional(v.string()) },
  handler: async (ctx, { userId, cursor }) => {
    const page = await ctx.db
      .query("sequences")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .paginate({ cursor: cursor ?? null, numItems: SEQUENCE_PAGE });

    for (const sequence of page.page) {
      await ctx.scheduler.runAfter(
        0,
        internal.recipients.backfillSequenceRecipients,
        { sequenceId: sequence._id }
      );
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.recipients.backfillUserSequenceRecipients,
        { userId, cursor: page.continueCursor }
      );
    }
  },
});

/** Walk one sequence's enrollments. */
export const backfillSequenceRecipients = internalMutation({
  args: { sequenceId: v.id("sequences"), cursor: v.optional(v.string()) },
  handler: async (ctx, { sequenceId, cursor }) => {
    const sequence = await ctx.db.get(sequenceId);
    // Sequence deleted mid walk: its enrollments went with it.
    if (!sequence) return;

    const page = await ctx.db
      .query("sequenceEnrollments")
      .withIndex("by_sequence_id", (q) => q.eq("sequenceId", sequenceId))
      .paginate({ cursor: cursor ?? null, numItems: ENROLLMENT_PAGE });

    await recordRecipients(
      ctx,
      sequence.userId,
      page.page.map((enrollment) => enrollment.contactEmail)
    );

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.recipients.backfillSequenceRecipients,
        { sequenceId, cursor: page.continueCursor }
      );
    }
  },
});

/** The current user's audience, newest first.
 *
 *  Paginated rather than collected: this is the one list in the app expected to
 *  run to tens of thousands of rows (26,454 on the largest account at the time
 *  of writing), so it must never be read whole. Same hand-rolled paginationOpts
 *  shape as suppressions.listForCurrentUser. */
export const listForCurrentUser = query({
  args: {
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, { paginationOpts }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { page: [], isDone: true, continueCursor: "" };

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return { page: [], isDone: true, continueCursor: "" };

    return await ctx.db
      .query("recipients")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(paginationOpts);
  },
});
