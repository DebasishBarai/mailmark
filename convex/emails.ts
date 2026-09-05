import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import type { Doc } from "./_generated/dataModel";
import type { DatabaseReader } from "./_generated/server";
import {
  applyEmailToTally,
  applyMailboxDelta,
  deleteEmailCounted,
  emptyMailboxTally,
  insertEmailCounted,
  patchEmailCounted,
  readMailboxStats,
} from "./lib/counters";
import { recordRecipientsForMailbox } from "./lib/recipients";
import { internal } from "./_generated/api";
import { suppress } from "./suppressions";
import { isPermanentBounce } from "./lib/sendPolicy";
import { maybeScheduleEvaluation } from "./reputationGuard";
import type { MutationCtx } from "./_generated/server";

export const getMailboxWithDomain = internalQuery({
  args: { mailboxId: v.id("mailboxes") },
  handler: async (ctx, { mailboxId }) => {
    const mailbox = await ctx.db.get(mailboxId);
    if (!mailbox) return null;

    const domain = await ctx.db.get(mailbox.domainId);
    if (!domain) return null;

    // Include the AWS account row (if the domain is BYO) so action callers
    // can route SES/S3 calls to the right account without an extra lookup.
    const awsAccount = domain.awsAccountId
      ? await ctx.db.get(domain.awsAccountId)
      : null;

    return {
      ...mailbox,
      domain: domain.domain,
      awsAccount,
    };
  },
});

export const getMailboxById = internalQuery({
  args: { mailboxId: v.id("mailboxes") },
  handler: async (ctx, { mailboxId }) => {
    return await ctx.db.get(mailboxId);
  },
});

// Retired. This collected an entire folder with no limit and shipped it to the
// browser. Its only caller was the mailbox page, which used it solely to count
// unread messages (inboxEmails.filter(e => !e.read).length) and now calls
// countUnreadByMailbox instead. listByFolderPaginated below is what actually
// renders the message list.
//
// export const listByFolder = query({
//   args: {
//     mailboxId: v.id("mailboxes"),
//     folder: v.string(),
//   },
//   handler: async (ctx, { mailboxId, folder }) => {
//     const identity = await ctx.auth.getUserIdentity();
//     if (!identity) return [];
//
//     // Verify ownership
//     const mailbox = await ctx.db.get(mailboxId);
//     if (!mailbox) return [];
//
//     const user = await ctx.db
//       .query("users")
//       .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
//       .unique();
//
//     if (!user || mailbox.userId !== user._id) return [];
//
//     return await ctx.db
//       .query("emails")
//       .withIndex("by_mailbox_folder", (q) =>
//         q.eq("mailboxId", mailboxId).eq("folder", folder)
//       )
//       .order("desc")
//       .collect();
//   },
// });

export const listByFolderPaginated = query({
  args: {
    mailboxId: v.id("mailboxes"),
    folder: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { mailboxId, folder, paginationOpts }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { page: [], isDone: true, continueCursor: "" };

    const mailbox = await ctx.db.get(mailboxId);
    if (!mailbox) return { page: [], isDone: true, continueCursor: "" };

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || mailbox.userId !== user._id) return { page: [], isDone: true, continueCursor: "" };

    return await ctx.db
      .query("emails")
      .withIndex("by_mailbox_folder", (q) =>
        q.eq("mailboxId", mailboxId).eq("folder", folder)
      )
      .order("desc")
      .paginate(paginationOpts);
  },
});

export const countByFolder = query({
  args: {
    mailboxId: v.id("mailboxes"),
    folder: v.string(),
  },
  handler: async (ctx, { mailboxId, folder }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;

    const mailbox = await ctx.db.get(mailboxId);
    if (!mailbox) return 0;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || mailbox.userId !== user._id) return 0;

    // Old: collect the whole folder and call .length, which reads every
    // message in it to produce one integer.
    //
    // const results = await ctx.db
    //   .query("emails")
    //   .withIndex("by_mailbox_folder", (q) =>
    //     q.eq("mailboxId", mailboxId).eq("folder", folder)
    //   )
    //   .collect();
    // return results.length;

    const stats = await readMailboxStats(ctx, mailboxId);
    return stats.byFolder[folder] ?? 0;
  },
});

export const countUnreadByMailbox = query({
  args: {
    mailboxId: v.id("mailboxes"),
  },
  handler: async (ctx, { mailboxId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;

    const mailbox = await ctx.db.get(mailboxId);
    if (!mailbox) return 0;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || mailbox.userId !== user._id) return 0;

    // Old: collect the entire inbox and count unread in memory. This runs from
    // the protected layout for every mailbox in the sidebar, so it fired on
    // every page load of the app.
    //
    // const results = await ctx.db
    //   .query("emails")
    //   .withIndex("by_mailbox_folder", (q) =>
    //     q.eq("mailboxId", mailboxId).eq("folder", "inbox")
    //   )
    //   .collect();
    // return results.filter((e) => !e.read).length;

    const stats = await readMailboxStats(ctx, mailboxId);
    return stats.unread;
  },
});

export const getById = query({
  args: { emailId: v.id("emails") },
  handler: async (ctx, { emailId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const email = await ctx.db.get(emailId);
    if (!email) return null;

    // Verify ownership through mailbox
    const mailbox = await ctx.db.get(email.mailboxId);
    if (!mailbox) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || mailbox.userId !== user._id) return null;

    return email;
  },
});

export const markAsRead = mutation({
  args: { emailId: v.id("emails") },
  handler: async (ctx, { emailId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const email = await ctx.db.get(emailId);
    if (!email) throw new Error("Email not found");

    const mailbox = await ctx.db.get(email.mailboxId);
    if (!mailbox) throw new Error("Mailbox not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || mailbox.userId !== user._id) {
      throw new Error("Not authorized");
    }

    // await ctx.db.patch(emailId, { read: true });
    await patchEmailCounted(ctx, emailId, { read: true });
  },
});

export const markAllAsRead = mutation({
  args: { mailboxId: v.id("mailboxes") },
  handler: async (ctx, { mailboxId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const mailbox = await ctx.db.get(mailboxId);
    if (!mailbox) throw new Error("Mailbox not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || mailbox.userId !== user._id) {
      throw new Error("Not authorized");
    }

    const emails = await ctx.db
      .query("emails")
      .withIndex("by_mailbox_folder", (q) =>
        q.eq("mailboxId", mailboxId).eq("folder", "inbox")
      )
      .collect();

    // Old: a bare patch per row, which left mailboxStats.unread stale.
    // Going through patchEmailCounted here would add a stats write per email,
    // so instead the unread delta is tallied in memory and written once, the
    // same shape as the cascade deletes in lib/counters.ts.
    const tally = emptyMailboxTally();
    for (const email of emails) {
      if (!email.read) {
        applyEmailToTally(tally, email, -1);
        await ctx.db.patch(email._id, { read: true });
        applyEmailToTally(tally, { ...email, read: true }, 1);
      }
    }
    await applyMailboxDelta(ctx, mailboxId, tally);
  },
});

export const toggleStar = mutation({
  args: { emailId: v.id("emails") },
  handler: async (ctx, { emailId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const email = await ctx.db.get(emailId);
    if (!email) throw new Error("Email not found");

    const mailbox = await ctx.db.get(email.mailboxId);
    if (!mailbox) throw new Error("Mailbox not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || mailbox.userId !== user._id) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(emailId, { starred: !email.starred });
  },
});

export const moveToFolder = mutation({
  args: {
    emailId: v.id("emails"),
    folder: v.string(),
  },
  handler: async (ctx, { emailId, folder }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const email = await ctx.db.get(emailId);
    if (!email) throw new Error("Email not found");

    const mailbox = await ctx.db.get(email.mailboxId);
    if (!mailbox) throw new Error("Mailbox not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || mailbox.userId !== user._id) {
      throw new Error("Not authorized");
    }

    // await ctx.db.patch(emailId, { folder });
    await patchEmailCounted(ctx, emailId, { folder });
  },
});

export const markAsUnread = mutation({
  args: { emailId: v.id("emails") },
  handler: async (ctx, { emailId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const email = await ctx.db.get(emailId);
    if (!email) throw new Error("Email not found");

    const mailbox = await ctx.db.get(email.mailboxId);
    if (!mailbox) throw new Error("Mailbox not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || mailbox.userId !== user._id) {
      throw new Error("Not authorized");
    }

    // await ctx.db.patch(emailId, { read: false });
    await patchEmailCounted(ctx, emailId, { read: false });
  },
});

export const deleteEmail = mutation({
  args: { emailId: v.id("emails") },
  handler: async (ctx, { emailId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const email = await ctx.db.get(emailId);
    if (!email) throw new Error("Email not found");

    const mailbox = await ctx.db.get(email.mailboxId);
    if (!mailbox) throw new Error("Mailbox not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || mailbox.userId !== user._id) {
      throw new Error("Not authorized");
    }

    // await ctx.db.delete(emailId);
    await deleteEmailCounted(ctx, emailId);
  },
});

// ── Internal queries for REST API ──

export const listByMailboxAndFolderInternal = internalQuery({
  args: {
    mailboxId: v.id("mailboxes"),
    folder: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { mailboxId, folder, limit }) => {
    const query = ctx.db
      .query("emails")
      .withIndex("by_mailbox_folder", (q) =>
        q.eq("mailboxId", mailboxId).eq("folder", folder)
      )
      .order("desc");

    if (limit) {
      return await query.take(limit);
    }
    return await query.take(50);
  },
});

export const getByIdInternal = internalQuery({
  args: { emailId: v.id("emails") },
  handler: async (ctx, { emailId }) => {
    return await ctx.db.get(emailId);
  },
});

export const deleteInternal = internalMutation({
  args: { emailId: v.id("emails") },
  handler: async (ctx, { emailId }) => {
    // await ctx.db.delete(emailId);
    await deleteEmailCounted(ctx, emailId);
  },
});

export const moveToFolderInternal = internalMutation({
  args: { emailId: v.id("emails"), folder: v.string() },
  handler: async (ctx, { emailId, folder }) => {
    // await ctx.db.patch(emailId, { folder });
    await patchEmailCounted(ctx, emailId, { folder });
  },
});

// Called by SES webhook when incoming email arrives
export const insertFromWebhook = internalMutation({
  args: {
    mailboxId: v.id("mailboxes"),
    messageId: v.string(),
    from: v.string(),
    to: v.array(v.string()),
    subject: v.string(),
    snippet: v.string(),
    date: v.number(),
    hasAttachments: v.boolean(),
    s3Key: v.string(),
    folder: v.optional(v.string()),
    inReplyTo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { folder, ...rest } = args;

    // The same inbound message can reach /ingestEmail more than once: SES
    // writes one S3 object per envelope recipient, so a message addressed to
    // two mailboxes on this domain is stored (and processed by the Lambda)
    // twice, and each run then ingests every domain recipient it finds in the
    // headers. A Lambda retry replays the event the same way.
    //
    // Two rows for one message is bad on its own, and the two runs also race
    // over the S3 move that follows the insert: whichever run finishes first
    // deletes the {domain}/{mailbox}/inbox/ copy, so the loser's row is left
    // pointing at a key that no longer exists and its body fails to load.
    //
    // Convex mutations are serializable, so two concurrent ingests of the same
    // message cannot both pass this check: the loser re-runs and sees the row
    // the winner inserted.
    if (rest.messageId) {
      const sameMessageId = await ctx.db
        .query("emails")
        .withIndex("by_message_id", (q) => q.eq("messageId", rest.messageId))
        .collect();
      const alreadyIngested = sameMessageId.some(
        (e) => e.mailboxId === rest.mailboxId
      );
      if (alreadyIngested) return null;
    }

    // return await ctx.db.insert("emails", { ... });
    return await insertEmailCounted(ctx, {
      ...rest,
      folder: folder ?? "inbox",
      read: false,
      starred: false,
    });
  },
});

export const updateS3Key = internalMutation({
  args: { emailId: v.id("emails"), s3Key: v.string() },
  handler: async (ctx, { emailId, s3Key }) => {
    await ctx.db.patch(emailId, { s3Key });
  },
});

// Called from moveIncomingEmail once the raw message has been parsed. The
// Lambda only reports the recipients that live on this domain, merged out of
// the To and Cc headers, so an inbound email's To line is wrong and its Cc is
// missing until the real headers are read back from S3.
export const updateIngestedRecipients = internalMutation({
  args: {
    emailId: v.id("emails"),
    to: v.optional(v.array(v.string())),
    cc: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { emailId, to, cc }) => {
    const email = await ctx.db.get(emailId);
    if (!email) return;
    await ctx.db.patch(emailId, {
      ...(to && to.length > 0 ? { to } : {}),
      ...(cc && cc.length > 0 ? { cc } : {}),
    });
  },
});

// The duplicate cleanup lives in ses.ts as internal.ses.purgeDuplicateIngests,
// not here. Deciding which of two rows to keep means knowing which one's S3
// object still exists, and only a Node action can ask S3. An earlier version of
// this file guessed from the shape of the s3Key and deleted the wrong rows.

// One mailbox's copy of a message, for the redelivery-heals-a-stalled-move
// path in /ingestEmail.
export const getByMailboxAndMessageId = internalQuery({
  args: {
    mailboxId: v.id("mailboxes"),
    messageId: v.string(),
  },
  handler: async (ctx, { mailboxId, messageId }) => {
    const rows = await ctx.db
      .query("emails")
      .withIndex("by_message_id", (q) => q.eq("messageId", messageId))
      .collect();
    return rows.find((e) => e.mailboxId === mailboxId) ?? null;
  },
});

// Every row in a folder, for the repair and purge actions. Unlike
// listByMailboxAndFolderInternal this is not capped at 50 rows.
export const listForRepairInternal = internalQuery({
  args: {
    mailboxId: v.id("mailboxes"),
    folder: v.string(),
  },
  handler: async (ctx, { mailboxId, folder }) => {
    return await ctx.db
      .query("emails")
      .withIndex("by_mailbox_folder", (q) =>
        q.eq("mailboxId", mailboxId).eq("folder", folder)
      )
      .collect();
  },
});

// Fold the read/starred flags of removed duplicates into the row being kept, so
// cleanup never makes a message you already handled pop back up as unread.
export const mergeDuplicateFlags = internalMutation({
  args: {
    emailId: v.id("emails"),
    read: v.boolean(),
    starred: v.boolean(),
  },
  handler: async (ctx, { emailId, read, starred }) => {
    const email = await ctx.db.get(emailId);
    if (!email) return;
    if (email.read === read && email.starred === starred) return;
    // await ctx.db.patch(emailId, { read, starred });
    await patchEmailCounted(ctx, emailId, { read, starred });
  },
});

// ── Looking up the message a tracking event refers to ──
//
// messageId is not unique across this table. Inbound rows carry the SES receipt
// id, and one message delivered to two mailboxes on the same domain (To: one,
// Cc: the other) produces two rows holding the same value. .unique() throws on
// that, which would turn an ordinary delivery, open, click or reply
// notification into a failed mutation.
//
// Every caller below is tracking mail we sent, so when a lookup matches more
// than one row, prefer an outgoing one, and fall back to the oldest match
// rather than throwing. A single match is returned as-is, exactly as before.
const OUTGOING_FOLDERS = ["sent", "outbox"];

function preferOutgoing(rows: Doc<"emails">[]): Doc<"emails"> | null {
  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0];
  const outgoing = rows.filter((e) => OUTGOING_FOLDERS.includes(e.folder));
  const pool = outgoing.length > 0 ? outgoing : rows;
  return pool.reduce((oldest, e) =>
    e._creationTime < oldest._creationTime ? e : oldest
  );
}

async function findByMessageId(db: DatabaseReader, messageId: string) {
  return preferOutgoing(
    await db
      .query("emails")
      .withIndex("by_message_id", (q) => q.eq("messageId", messageId))
      .collect()
  );
}

async function findBySesMessageId(db: DatabaseReader, sesMessageId: string) {
  return preferOutgoing(
    await db
      .query("emails")
      .withIndex("by_ses_message_id", (q) => q.eq("sesMessageId", sesMessageId))
      .collect()
  );
}

// Superseded by recordDeliveryEvent below, which records the SMTP diagnostic
// code and bounce subtype, handles complaints, distinguishes permanent from
// transient bounces, and feeds the suppression list. This one took a status
// and a timestamp, dropped everything else SES sent, and returned nothing, so
// a caller could not tell "applied" from "no such message" - which is why
// events that arrived before their message row were silently discarded and
// messages stayed pending indefinitely.
//
// Kept exported: nothing calls it any more, but removing an internalMutation
// that a stale scheduled job might still reference would turn that job into a
// hard failure.
export const updateDeliveryStatus = internalMutation({
  args: {
    messageId: v.string(),
    status: v.union(v.literal("delivered"), v.literal("failed"), v.literal("bounced")),
    timestamp: v.number(),
  },
  handler: async (ctx, { messageId, status, timestamp }) => {
    console.log("[updateDeliveryStatus] looking up sesMessageId:", messageId);
    const email =
      (await findBySesMessageId(ctx.db, messageId)) ??
      // Fallback: try the legacy custom messageId index
      (await findByMessageId(ctx.db, messageId));
    if (!email) {
      console.log("[updateDeliveryStatus] no email found for messageId:", messageId);
      return;
    }
    console.log("[updateDeliveryStatus] found email id:", email._id, "current status:", email.deliveryStatus, "→ updating to:", status);
    // await ctx.db.patch(email._id, { ... });
    await patchEmailCounted(ctx, email._id, {
      deliveryStatus: status,
      deliveredAt: status === "delivered" ? timestamp : undefined,
    });
    console.log("[updateDeliveryStatus] patch done");
  },
});

// Called by sendScheduledEmail to move the outbox record to sent after SES accepts it
export const markScheduledEmailAsSentByMessageId = internalMutation({
  args: {
    messageId: v.string(),
    sesMessageId: v.optional(v.string()),
  },
  handler: async (ctx, { messageId, sesMessageId }) => {
    const email = await findByMessageId(ctx.db, messageId);
    if (!email) {
      console.log("[markScheduledEmailAsSentByMessageId] email not found:", messageId);
      return;
    }
    // await ctx.db.patch(email._id, { ... });
    await patchEmailCounted(ctx, email._id, {
      folder: "sent",
      sesMessageId,
      deliveryStatus: "pending",
      scheduledAt: undefined,
      scheduledJobId: undefined,
      date: Date.now(),
    });
  },
});

// Called to save a scheduled email to the outbox folder
export const insertScheduled = internalMutation({
  args: {
    mailboxId: v.id("mailboxes"),
    messageId: v.string(),
    from: v.string(),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    bcc: v.optional(v.array(v.string())),
    subject: v.string(),
    snippet: v.string(),
    date: v.number(),
    s3Key: v.string(),
    hasAttachments: v.boolean(),
    scheduledAt: v.number(),
    scheduledJobId: v.string(),
    batchId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Scheduled mail counts towards the audience when it is queued, not when
    // it eventually leaves: the user has committed to sending to these people.
    await recordRecipientsForMailbox(ctx, args.mailboxId, [
      ...args.to,
      ...(args.cc ?? []),
      ...(args.bcc ?? []),
    ]);
    // return await ctx.db.insert("emails", { ... });
    return await insertEmailCounted(ctx, {
      ...args,
      folder: "outbox",
      read: true,
      starred: false,
    });
  },
});

// Fetches a scheduled email for the scheduler to send
export const getScheduledEmail = internalQuery({
  args: { emailId: v.id("emails") },
  handler: async (ctx, { emailId }) => {
    return await ctx.db.get(emailId);
  },
});

// Called after a scheduled email is sent - moves it to sent folder
export const markScheduledAsSent = internalMutation({
  args: {
    emailId: v.id("emails"),
    sesMessageId: v.optional(v.string()),
  },
  handler: async (ctx, { emailId, sesMessageId }) => {
    // await ctx.db.patch(emailId, { ... });
    await patchEmailCounted(ctx, emailId, {
      folder: "sent",
      sesMessageId,
      deliveryStatus: "pending",
      scheduledAt: undefined,
      scheduledJobId: undefined,
      date: Date.now(),
    });
  },
});

// Public mutation - user cancels a scheduled send
export const cancelScheduledEmail = mutation({
  args: { emailId: v.id("emails") },
  handler: async (ctx, { emailId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const email = await ctx.db.get(emailId);
    if (!email || email.folder !== "outbox") throw new Error("Email not found");

    const mailbox = await ctx.db.get(email.mailboxId);
    if (!mailbox) throw new Error("Mailbox not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || mailbox.userId !== user._id) throw new Error("Not authorized");

    if (email.scheduledJobId) {
      try {
        await ctx.scheduler.cancel(email.scheduledJobId as Id<"_scheduled_functions">);
      } catch {
        // Job may have already run; proceed to delete the record
      }
    }

    // await ctx.db.delete(emailId);
    await deleteEmailCounted(ctx, emailId);
  },
});

// Called when recipient loads the tracking pixel (email opened)
export const markAsOpened = internalMutation({
  args: { messageId: v.string() },
  handler: async (ctx, { messageId }) => {
    const email = await findByMessageId(ctx.db, messageId);
    if (!email || email.openedAt) return; // Only record first open
    // Two counted fields can move in this one patch (opened, and pending ->
    // delivered), which is why the counter hook diffs whole bucket sets rather
    // than adjusting one counter per field.
    // await ctx.db.patch(email._id, { ... });
    await patchEmailCounted(ctx, email._id, {
      openedAt: Date.now(),
      // If delivery status is still pending, upgrade to delivered since
      // the recipient opening the email implies it was delivered.
      ...(email.deliveryStatus === "pending"
        ? { deliveryStatus: "delivered" as const, deliveredAt: Date.now() }
        : {}),
    });
  },
});

// Called after sending an email via SES
export const insertSent = internalMutation({
  args: {
    mailboxId: v.id("mailboxes"),
    messageId: v.string(),
    sesMessageId: v.optional(v.string()),
    from: v.string(),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    bcc: v.optional(v.array(v.string())),
    subject: v.string(),
    snippet: v.string(),
    date: v.number(),
    s3Key: v.string(),
    hasAttachments: v.optional(v.boolean()),
    folder: v.optional(v.string()),
    batchId: v.optional(v.string()),
  },
  handler: async (ctx, { hasAttachments, folder, batchId, ...rest }) => {
    const emailFolder = folder ?? "sent";

    // Every immediate send, from the app and from the API, lands here, so this
    // is where the audience grows. Scheduled mail does not pass through: it is
    // inserted by insertScheduled and later patched from outbox to sent, and
    // insertScheduled records it at that point instead.
    await recordRecipientsForMailbox(ctx, rest.mailboxId, [
      ...rest.to,
      ...(rest.cc ?? []),
      ...(rest.bcc ?? []),
    ]);

    // return await ctx.db.insert("emails", { ... });
    return await insertEmailCounted(ctx, {
      ...rest,
      folder: emailFolder,
      read: true,
      starred: false,
      hasAttachments: hasAttachments ?? false,
      // Start as "pending" - SES delivery/bounce SNS notifications will update
      // this to "delivered", "bounced", or "failed" once the actual outcome is known.
      // ses.send() succeeding only means SES accepted the message, not that it
      // reached the recipient.
      deliveryStatus: emailFolder === "sent" ? "pending" : undefined,
      ...(batchId ? { batchId } : {}),
    });
  },
});

// ── Click tracking ──

export const markLinkClicked = internalMutation({
  args: {
    messageId: v.string(),
    url: v.string(),
  },
  handler: async (ctx, { messageId, url }) => {
    const email = await findByMessageId(ctx.db, messageId);
    if (!email) return;
    const existing = email.clickedLinks ?? [];
    if (existing.some((l) => l.url === url)) return;
    await ctx.db.patch(email._id, {
      clickedLinks: [...existing, { url, clickedAt: Date.now() }],
    });
  },
});

// ── Reply tracking ──

export const markAsReplied = internalMutation({
  args: { messageId: v.string() },
  handler: async (ctx, { messageId }) => {
    const email = await findByMessageId(ctx.db, messageId);
    if (!email || email.repliedAt) return;
    await ctx.db.patch(email._id, { repliedAt: Date.now() });
  },
});

// ── Bounce stats for a domain (used by /v1/bounces) ──

export const getBounceStatsForDomain = internalQuery({
  args: {
    domainId: v.id("domains"),
    sinceMs: v.number(),
  },
  handler: async (ctx, { domainId, sinceMs }) => {
    const mailboxes = await ctx.db
      .query("mailboxes")
      .withIndex("by_domain_id", (q) => q.eq("domainId", domainId))
      .collect();

    let totalSent = 0;
    let delivered = 0;
    let bounced = 0;
    let failed = 0;
    // Complaints were never counted here, which is why /v1/bounces reported
    // `failed` (hard bounces) under the name complaintRate. They are their own
    // figure now: a spam report and a dead mailbox are opposite problems.
    let complained = 0;
    let opened = 0;
    let clicked = 0;
    let replied = 0;

    for (const mb of mailboxes) {
      // Old: collect every sent message the mailbox ever had, then skip the
      // ones before sinceMs in the loop below. Same rows match either way, but
      // the range read stops scanning at the window boundary.
      //
      // const sentEmails = await ctx.db
      //   .query("emails")
      //   .withIndex("by_mailbox_folder", (q) =>
      //     q.eq("mailboxId", mb._id).eq("folder", "sent")
      //   )
      //   .collect();
      const sentEmails = await ctx.db
        .query("emails")
        .withIndex("by_mailbox_folder_date", (q) =>
          q.eq("mailboxId", mb._id).eq("folder", "sent").gte("date", sinceMs)
        )
        .collect();

      for (const email of sentEmails) {
        totalSent++;
        if (email.deliveryStatus === "delivered") delivered++;
        else if (email.deliveryStatus === "bounced") bounced++;
        else if (email.deliveryStatus === "failed") failed++;
        else if (email.deliveryStatus === "complained") complained++;
        if (email.openedAt) opened++;
        if (email.clickedLinks && email.clickedLinks.length > 0) clicked++;
        if (email.repliedAt) replied++;
      }
    }

    return {
      totalSent,
      delivered,
      bounced,
      failed,
      complained,
      opened,
      clicked,
      replied,
    };
  },
});

// ── Batch stats for a domain (used by /v1/campaign-stats) ──

export const getBatchStats = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    const mailboxes = await ctx.db
      .query("mailboxes")
      .withIndex("by_domain_id", (q) => q.eq("domainId", domainId))
      .collect();

    const batches: Record<string, {
      sentAt: number;
      total: number;
      delivered: number;
      bounced: number;
      failed: number;
      opened: number;
      clicked: number;
      replied: number;
    }> = {};

    for (const mb of mailboxes) {
      const sentEmails = await ctx.db
        .query("emails")
        .withIndex("by_mailbox_folder", (q) =>
          q.eq("mailboxId", mb._id).eq("folder", "sent")
        )
        .collect();

      for (const email of sentEmails) {
        if (!email.batchId) continue;
        if (!batches[email.batchId]) {
          batches[email.batchId] = {
            sentAt: email.date,
            total: 0,
            delivered: 0,
            bounced: 0,
            failed: 0,
            opened: 0,
            clicked: 0,
            replied: 0,
          };
        }
        const b = batches[email.batchId];
        b.total++;
        if (email.deliveryStatus === "delivered") b.delivered++;
        else if (email.deliveryStatus === "bounced") b.bounced++;
        else if (email.deliveryStatus === "failed") b.failed++;
        if (email.openedAt) b.opened++;
        if (email.clickedLinks && email.clickedLinks.length > 0) b.clicked++;
        if (email.repliedAt) b.replied++;
        if (email.date < b.sentAt) b.sentAt = email.date;
      }
    }

    return Object.entries(batches).map(([batchId, stats]) => ({
      batchId,
      ...stats,
    }));
  },
});

// ── Send gate bookkeeping ────────────────────────────────────────────────────

/** Look a queued message up by its own (non-SES) message id. */
export const getByMessageIdInternal = internalQuery({
  args: { messageId: v.string() },
  handler: async (ctx, { messageId }) => {
    return await findByMessageId(ctx.db, messageId);
  },
});

/**
 * Mark a queued message as refused by the gate.
 *
 * The row is kept, and kept queryable: the folder stays as it was so the
 * message is still findable where the user left it, and deliveryStatus becomes
 * "blocked" alongside the reason. Nothing is deleted, per the requirement that
 * a blocked message stays inspectable.
 *
 * Its scheduler job is dropped from the row because the job has already run
 * and decided not to send; leaving a stale job id would suggest a send is
 * still coming.
 */
export const markBlockedByMessageId = internalMutation({
  args: {
    messageId: v.string(),
    reason: v.string(),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, { messageId, reason, detail }) => {
    const email = await findByMessageId(ctx.db, messageId);
    if (!email) {
      console.log("[markBlockedByMessageId] no row for messageId:", messageId);
      return null;
    }
    await patchEmailCounted(ctx, email._id, {
      deliveryStatus: "blocked",
      blockedAt: Date.now(),
      blockReason: reason,
      blockDetail: detail,
      scheduledJobId: undefined,
    });
    return email._id;
  },
});

/**
 * Record that a scheduled send was held rather than sent.
 *
 * Returns the new hold count so the caller can decide whether to keep
 * re-arming or give up. A held message keeps its outbox row and its
 * scheduledAt untouched: the queue position is not what changed, only the
 * moment we next look at it.
 */
export const recordHoldByMessageId = internalMutation({
  args: { messageId: v.string() },
  handler: async (ctx, { messageId }) => {
    const email = await findByMessageId(ctx.db, messageId);
    if (!email) return { holdCount: 0, found: false };

    const holdCount = (email.holdCount ?? 0) + 1;
    await ctx.db.patch(email._id, { holdCount, lastHeldAt: Date.now() });
    return { holdCount, found: true };
  },
});

/** Re-point a held message at its newly armed scheduler job. */
export const updateScheduledJobId = internalMutation({
  args: { messageId: v.string(), scheduledJobId: v.string() },
  handler: async (ctx, { messageId, scheduledJobId }) => {
    const email = await findByMessageId(ctx.db, messageId);
    if (!email) return;
    await ctx.db.patch(email._id, { scheduledJobId });
  },
});

// ── SES sending events ───────────────────────────────────────────────────────

const deliveryEventArgs = {
  sesMessageId: v.string(),
  status: v.string(),
  timestamp: v.number(),
  reason: v.optional(v.string()),
  bounceType: v.optional(v.string()),
  bounceSubType: v.optional(v.string()),
  recipients: v.optional(
    v.array(
      v.object({
        email: v.string(),
        diagnosticCode: v.optional(v.string()),
        smtpStatus: v.optional(v.string()),
      })
    )
  ),
};

/**
 * Apply one SES sending event to the message it describes, and feed
 * suppression from it.
 *
 * Replaces updateDeliveryStatus, which took a status and a timestamp and
 * nothing else. Three things it could not do, and this does:
 *
 *   - Record the SMTP diagnostic code and bounce subtype. Without them a
 *     failure count cannot distinguish a dead mailbox ("550 5.1.1 user
 *     unknown", meaning the list is stale) from a policy rejection ("550 5.7.1
 *     blocked", meaning our reputation is), which are opposite problems with
 *     opposite fixes.
 *   - Suppress the address. Permanent bounces and complaints write a
 *     suppression row, which is what stops the next campaign repeating the
 *     mistake. Transient bounces deliberately do not: a full mailbox says
 *     nothing about whether the address is real.
 *   - Report whether it matched anything, so an event that arrived before its
 *     message row can be parked and replayed rather than dropped.
 */
export const recordDeliveryEvent = internalMutation({
  args: deliveryEventArgs,
  handler: async (ctx, args) => {
    const email =
      (await findBySesMessageId(ctx.db, args.sesMessageId)) ??
      // Fallback: try the legacy custom messageId index
      (await findByMessageId(ctx.db, args.sesMessageId));

    if (!email) return { matched: false, suppressed: 0 };

    return await applyDeliveryEvent(ctx, email, {
      sesMessageId: args.sesMessageId,
      status: args.status,
      timestamp: args.timestamp,
      reason: args.reason,
      bounceType: args.bounceType,
      bounceSubType: args.bounceSubType,
      recipients: args.recipients,
    });
  },
});

type DeliveryEventInput = {
  sesMessageId: string;
  status: string;
  timestamp: number;
  reason?: string;
  bounceType?: string;
  bounceSubType?: string;
  diagnosticCode?: string;
  recipients?:
    | Array<{ email: string; diagnosticCode?: string; smtpStatus?: string }>
    | string[];
};

/**
 * Apply one event to one known message row.
 *
 * Shared by the live webhook path and the replay of parked events, so a
 * replayed bounce suppresses exactly what a live one would. The two used to be
 * one path with no replay at all, which is why a lost event was lost for good.
 */
async function applyDeliveryEvent(
  ctx: MutationCtx,
  email: Doc<"emails">,
  args: DeliveryEventInput
): Promise<{ matched: boolean; suppressed: number }> {
  // Parked rows store recipients as bare addresses; the live path has the
  // richer per-recipient shape. Normalize to the richer one.
  const namedRecipients: Array<{ email: string; diagnosticCode?: string }> = (
    args.recipients ?? []
  ).map((r) =>
    typeof r === "string"
      ? { email: r, diagnosticCode: undefined }
      : { email: r.email, diagnosticCode: r.diagnosticCode }
  );

  const isPermanent = isPermanentBounce(args.bounceType);
  const isComplaint = args.status === "complained";
  const isBounce = args.status === "failed" || args.status === "bounced";

  // A delivered notification must never overwrite a bounce or a complaint.
  // SES can send both for one message (delivered to the domain, then bounced
  // by the mailbox behind it), and the failure is the fact worth keeping.
  const terminal =
    email.deliveryStatus === "failed" ||
    email.deliveryStatus === "bounced" ||
    email.deliveryStatus === "complained";
  if (args.status === "delivered" && terminal) {
    return { matched: true, suppressed: 0 };
  }

  // Take the first diagnostic code SES gave us, falling back to the reason
  // string the webhook assembled.
  const diagnosticCode =
    namedRecipients.find((r) => r.diagnosticCode)?.diagnosticCode ??
    args.diagnosticCode ??
    args.reason;

  // Only the fields this event actually speaks to are written. Patching the
  // rest to undefined would erase them: a complaint arriving after a delivery
  // would clear deliveredAt, losing the fact that the message did arrive
  // before the recipient reported it.
  const patch: Partial<Doc<"emails">> = {
    deliveryStatus: args.status as
      | "delivered"
      | "failed"
      | "bounced"
      | "complained",
  };
  if (args.status === "delivered") patch.deliveredAt = args.timestamp;
  if (isBounce) patch.bouncedAt = args.timestamp;
  if (isComplaint) patch.complainedAt = args.timestamp;
  if (args.bounceType) patch.bounceType = args.bounceType;
  if (args.bounceSubType) patch.bounceSubType = args.bounceSubType;
  if (diagnosticCode) patch.diagnosticCode = diagnosticCode;

  await patchEmailCounted(ctx, email._id, patch);

  // Suppression, per goal 1: a hard bounce or a complaint must permanently
  // prevent any future send to that address for this account.
  //
  // Transient bounces stop here deliberately. A full mailbox or a greylisting
  // server says nothing about whether the address exists, and suppressing on
  // one would permanently discard a valid recipient over a bad afternoon.
  if (!isPermanent && !isComplaint) return { matched: true, suppressed: 0 };

  const mailbox = await ctx.db.get(email.mailboxId);
  if (!mailbox) return { matched: true, suppressed: 0 };

  // Suppress exactly the addresses SES named. When it named none (an older
  // notification shape, or a complaint without a recipient list), fall back to
  // the message's own recipients: a single-recipient campaign send, which is
  // the overwhelming majority of this traffic, is unambiguous either way.
  const targets =
    namedRecipients.length > 0
      ? namedRecipients
      : email.to.map((address) => ({
          email: address.toLowerCase(),
          diagnosticCode,
        }));

  let suppressed = 0;
  for (const target of targets) {
    await suppress(ctx, {
      userId: mailbox.userId,
      email: target.email,
      reason: isComplaint ? "complaint" : "hard_bounce",
      bounceType: args.bounceType,
      bounceSubType: args.bounceSubType,
      diagnosticCode: target.diagnosticCode ?? diagnosticCode,
      sesMessageId: args.sesMessageId,
    });
    suppressed++;
  }

  // Suppression protects the one address that complained. It does nothing for
  // the rest of the list behind it, which is where a complaint rate actually
  // comes from: the same campaign, the same source, the same lack of consent.
  // Re-measure the domain so the brake in reputationGuard can stop the rest
  // before the rate reaches the level AWS acts on. Debounced in there, so a
  // burst of complaints from one send costs a single measurement.
  await maybeScheduleEvaluation(ctx, mailbox.domainId);

  return { matched: true, suppressed };
}

/**
 * Park an event whose message row does not exist yet.
 *
 * The race is real and routine: SES is called, then S3 is written, then the
 * row is inserted, and a hard bounce from a dead mailbox beats that sequence.
 * Idempotent on (sesMessageId, status) so an SNS redelivery does not stack up
 * duplicates.
 */
export const parkDeliveryEvent = internalMutation({
  args: deliveryEventArgs,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pendingDeliveryEvents")
      .withIndex("by_ses_message_id", (q) =>
        q.eq("sesMessageId", args.sesMessageId)
      )
      .collect();

    const duplicate = existing.find(
      (row) => row.status === args.status && row.resolvedAt === undefined
    );
    if (duplicate) return { parked: false };

    await ctx.db.insert("pendingDeliveryEvents", {
      sesMessageId: args.sesMessageId,
      status: args.status,
      timestamp: args.timestamp,
      reason: args.reason,
      bounceType: args.bounceType,
      bounceSubType: args.bounceSubType,
      diagnosticCode: args.recipients?.find((r) => r.diagnosticCode)
        ?.diagnosticCode,
      recipients: args.recipients?.map((r) => r.email),
      receivedAt: Date.now(),
      attempts: 0,
    });
    return { parked: true };
  },
});

// How long a parked event keeps being retried. A message row that has not
// appeared within a day is never going to: the send action died before
// inserting it. Retrying past that is pure noise.
const PARKED_EVENT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Replay parked events against rows that have since been written.
 *
 * Runs from a cron every few minutes. Paginated, because after an incident
 * this table can hold a lot of rows and a transaction may only scan 32,000.
 */
export const replayPendingDeliveryEvents = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { cursor, limit }): Promise<{
    replayed: number;
    expired: number;
    isDone: boolean;
    continueCursor: string;
  }> => {
    const page = await ctx.db
      .query("pendingDeliveryEvents")
      .withIndex("by_resolved_received", (q) => q.eq("resolvedAt", undefined))
      .paginate({ cursor: cursor ?? null, numItems: limit ?? 100 });

    const now = Date.now();
    let replayed = 0;
    let expired = 0;

    for (const event of page.page) {
      const email =
        (await findBySesMessageId(ctx.db, event.sesMessageId)) ??
        (await findByMessageId(ctx.db, event.sesMessageId));

      if (!email) {
        if (now - event.receivedAt > PARKED_EVENT_TTL_MS) {
          // Give up, but keep the row: an event with no message is itself
          // evidence that a send action died partway through.
          await ctx.db.patch(event._id, {
            resolvedAt: now,
            attempts: event.attempts + 1,
          });
          expired++;
        } else {
          await ctx.db.patch(event._id, { attempts: event.attempts + 1 });
        }
        continue;
      }

      await applyDeliveryEvent(ctx, email, {
        sesMessageId: event.sesMessageId,
        status: event.status,
        timestamp: event.timestamp,
        reason: event.reason,
        bounceType: event.bounceType,
        bounceSubType: event.bounceSubType,
        diagnosticCode: event.diagnosticCode,
        recipients: event.recipients,
      });
      await ctx.db.patch(event._id, {
        resolvedAt: now,
        attempts: event.attempts + 1,
      });
      replayed++;
    }

    return {
      replayed,
      expired,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});

/**
 * Cron entry point for the replay.
 *
 * replayPendingDeliveryEvents handles one page per transaction, so something
 * has to walk it to the end. This re-schedules itself rather than looping, for
 * the same reason every other walk in this codebase does: a transaction may
 * scan 32,000 documents and read 16 MiB, and a parking lot that has built up
 * during an incident will exceed both.
 */
export const replayPendingDeliveryEventsBatch = internalAction({
  args: { cursor: v.optional(v.string()), pages: v.optional(v.number()) },
  handler: async (ctx, { cursor, pages }): Promise<void> => {
    const page = await ctx.runMutation(
      internal.emails.replayPendingDeliveryEvents,
      { cursor, limit: 100 }
    );

    if (page.replayed > 0 || page.expired > 0) {
      console.log(
        `[replayPendingDeliveryEvents] replayed=${page.replayed} expired=${page.expired}`
      );
    }

    // Bounded per cron firing. Anything still parked is picked up five minutes
    // later; the point is to drain steadily, not to hold one action open.
    const walked = (pages ?? 0) + 1;
    if (!page.isDone && walked < 50) {
      await ctx.scheduler.runAfter(
        0,
        internal.emails.replayPendingDeliveryEventsBatch,
        { cursor: page.continueCursor, pages: walked }
      );
    }
  },
});

/**
 * Messages the gate blocked for a reason that may since have gone away.
 *
 * Only verifier problems qualify. A suppression, an unsubscribe, or an invalid
 * address is a correct and permanent refusal, and re-arming those would undo
 * the entire point of the gate. A message blocked because the verifier was
 * unreachable, or because the API key was missing, was refused for a reason
 * that had nothing to do with the recipient.
 *
 * Paginated: the outbox is 40,000+ rows and a transaction may scan 32,000.
 */
export const listBlockedByVerifier = internalQuery({
  args: {
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { cursor, limit }) => {
    const page = await ctx.db
      .query("sendBlocks")
      .withIndex("by_reason", (q) => q.eq("reason", "verifier_unavailable"))
      .paginate({ cursor: cursor ?? null, numItems: limit ?? 100 });

    const rows: Array<{
      emailId: Id<"emails">;
      messageId: string;
      mailboxId: Id<"mailboxes">;
      s3Key: string;
      to: string[];
      cc?: string[];
      bcc?: string[];
      from: string;
      batchId?: string;
    }> = [];

    for (const block of page.page) {
      if (!block.messageId) continue;
      const email = await findByMessageId(ctx.db, block.messageId);
      // Only still-blocked rows are candidates. A message that has since been
      // sent, or deliberately blocked for a different reason, is left alone.
      if (!email || email.deliveryStatus !== "blocked") continue;
      if (
        email.blockReason !== "verifier_unavailable" &&
        email.blockReason !== "verifier_not_configured"
      ) {
        continue;
      }
      rows.push({
        emailId: email._id,
        messageId: email.messageId,
        mailboxId: email.mailboxId,
        s3Key: email.s3Key,
        to: email.to,
        cc: email.cc,
        bcc: email.bcc,
        from: email.from,
        batchId: email.batchId,
      });
    }

    return { rows, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});

/**
 * Clear a verifier block so the message can be dispatched again.
 *
 * The hold counter is reset too, otherwise the message would arrive at its
 * exhausted ceiling immediately and block again on the first hold.
 */
export const clearVerifierBlock = internalMutation({
  args: { emailId: v.id("emails"), scheduledJobId: v.optional(v.string()) },
  handler: async (ctx, { emailId, scheduledJobId }) => {
    const email = await ctx.db.get(emailId);
    if (!email || email.deliveryStatus !== "blocked") return false;

    await patchEmailCounted(ctx, emailId, {
      deliveryStatus: undefined,
      blockedAt: undefined,
      blockReason: undefined,
      blockDetail: undefined,
      holdCount: 0,
      lastHeldAt: undefined,
      scheduledJobId,
    });
    return true;
  },
});
