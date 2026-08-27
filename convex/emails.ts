import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";

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

export const listByFolder = query({
  args: {
    mailboxId: v.id("mailboxes"),
    folder: v.string(),
  },
  handler: async (ctx, { mailboxId, folder }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    // Verify ownership
    const mailbox = await ctx.db.get(mailboxId);
    if (!mailbox) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user || mailbox.userId !== user._id) return [];

    return await ctx.db
      .query("emails")
      .withIndex("by_mailbox_folder", (q) =>
        q.eq("mailboxId", mailboxId).eq("folder", folder)
      )
      .order("desc")
      .collect();
  },
});

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

    const results = await ctx.db
      .query("emails")
      .withIndex("by_mailbox_folder", (q) =>
        q.eq("mailboxId", mailboxId).eq("folder", folder)
      )
      .collect();

    return results.length;
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

    const results = await ctx.db
      .query("emails")
      .withIndex("by_mailbox_folder", (q) =>
        q.eq("mailboxId", mailboxId).eq("folder", "inbox")
      )
      .collect();

    return results.filter((e) => !e.read).length;
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

    await ctx.db.patch(emailId, { read: true });
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

    for (const email of emails) {
      if (!email.read) {
        await ctx.db.patch(email._id, { read: true });
      }
    }
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

    await ctx.db.patch(emailId, { folder });
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

    await ctx.db.patch(emailId, { read: false });
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

    await ctx.db.delete(emailId);
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
    await ctx.db.delete(emailId);
  },
});

export const moveToFolderInternal = internalMutation({
  args: { emailId: v.id("emails"), folder: v.string() },
  handler: async (ctx, { emailId, folder }) => {
    await ctx.db.patch(emailId, { folder });
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

    return await ctx.db.insert("emails", {
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

// One-shot cleanup for the duplicate rows written before insertFromWebhook
// started deduping by messageId. Run it per mailbox from the Convex dashboard:
//
//   internal.emails.purgeDuplicateIngests
//   { "mailboxId": "...", "dryRun": false }
//
// dryRun defaults to true, so the first run only reports what it would delete.
//
// Within a group of rows sharing a messageId it keeps the one whose s3Key was
// successfully moved to the mailbox's incoming/ prefix: the duplicate ingests
// raced over that move, and the row that lost still points at an inbox/ key
// the winner deleted, which is the copy whose body fails to load. Read and
// starred flags are carried over from the rows being removed so cleanup never
// makes a message you already handled pop back up as unread.
export const purgeDuplicateIngests = internalMutation({
  args: {
    mailboxId: v.id("mailboxes"),
    folder: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { mailboxId, folder, dryRun }) => {
    const targetFolder = folder ?? "inbox";
    const isDryRun = dryRun ?? true;

    const emails = await ctx.db
      .query("emails")
      .withIndex("by_mailbox_folder", (q) =>
        q.eq("mailboxId", mailboxId).eq("folder", targetFolder)
      )
      .collect();

    const byMessageId = new Map<string, typeof emails>();
    for (const email of emails) {
      if (!email.messageId) continue;
      const group = byMessageId.get(email.messageId);
      if (group) group.push(email);
      else byMessageId.set(email.messageId, [email]);
    }

    const removed: Array<{ messageId: string; subject: string; s3Key: string }> = [];
    let duplicateGroups = 0;

    for (const [messageId, group] of byMessageId) {
      if (group.length < 2) continue;
      duplicateGroups++;

      const ranked = [...group].sort((a, b) => {
        // The Lambda stages every copy under .../inbox/, and moveIncomingEmail
        // rewrites the key to .../incoming/ once the move succeeds. A row still
        // pointing at the staging key is the one whose move lost the race, and
        // the object it names was deleted by the winner. Prefer a moved row,
        // then the oldest of the remaining rows.
        const aStaged = a.s3Key.includes("/inbox/") ? 1 : 0;
        const bStaged = b.s3Key.includes("/inbox/") ? 1 : 0;
        if (aStaged !== bStaged) return aStaged - bStaged;
        return a._creationTime - b._creationTime;
      });

      const [keep, ...duplicates] = ranked;
      const read = keep.read || duplicates.some((e) => e.read);
      const starred = keep.starred || duplicates.some((e) => e.starred);

      for (const duplicate of duplicates) {
        removed.push({
          messageId,
          subject: duplicate.subject,
          s3Key: duplicate.s3Key,
        });
        if (!isDryRun) await ctx.db.delete(duplicate._id);
      }

      if (!isDryRun && (read !== keep.read || starred !== keep.starred)) {
        await ctx.db.patch(keep._id, { read, starred });
      }
    }

    return {
      dryRun: isDryRun,
      folder: targetFolder,
      scanned: emails.length,
      duplicateGroups,
      deleted: isDryRun ? 0 : removed.length,
      wouldDelete: isDryRun ? removed.length : 0,
      rows: removed,
    };
  },
});

// Called when SES delivery notification is received via SNS
export const updateDeliveryStatus = internalMutation({
  args: {
    messageId: v.string(),
    status: v.union(v.literal("delivered"), v.literal("failed"), v.literal("bounced")),
    timestamp: v.number(),
  },
  handler: async (ctx, { messageId, status, timestamp }) => {
    console.log("[updateDeliveryStatus] looking up sesMessageId:", messageId);
    const email =
      (await ctx.db
        .query("emails")
        .withIndex("by_ses_message_id", (q) => q.eq("sesMessageId", messageId))
        .unique()) ??
      // Fallback: try the legacy custom messageId index
      (await ctx.db
        .query("emails")
        .withIndex("by_message_id", (q) => q.eq("messageId", messageId))
        .unique());
    if (!email) {
      console.log("[updateDeliveryStatus] no email found for messageId:", messageId);
      return;
    }
    console.log("[updateDeliveryStatus] found email id:", email._id, "current status:", email.deliveryStatus, "→ updating to:", status);
    await ctx.db.patch(email._id, {
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
    const email = await ctx.db
      .query("emails")
      .withIndex("by_message_id", (q) => q.eq("messageId", messageId))
      .unique();
    if (!email) {
      console.log("[markScheduledEmailAsSentByMessageId] email not found:", messageId);
      return;
    }
    await ctx.db.patch(email._id, {
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
    return await ctx.db.insert("emails", {
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
    await ctx.db.patch(emailId, {
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

    await ctx.db.delete(emailId);
  },
});

// Called when recipient loads the tracking pixel (email opened)
export const markAsOpened = internalMutation({
  args: { messageId: v.string() },
  handler: async (ctx, { messageId }) => {
    const email = await ctx.db
      .query("emails")
      .withIndex("by_message_id", (q) => q.eq("messageId", messageId))
      .unique();
    if (!email || email.openedAt) return; // Only record first open
    await ctx.db.patch(email._id, {
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
    return await ctx.db.insert("emails", {
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
    const email = await ctx.db
      .query("emails")
      .withIndex("by_message_id", (q) => q.eq("messageId", messageId))
      .unique();
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
    const email = await ctx.db
      .query("emails")
      .withIndex("by_message_id", (q) => q.eq("messageId", messageId))
      .unique();
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
    let opened = 0;
    let clicked = 0;
    let replied = 0;

    for (const mb of mailboxes) {
      const sentEmails = await ctx.db
        .query("emails")
        .withIndex("by_mailbox_folder", (q) =>
          q.eq("mailboxId", mb._id).eq("folder", "sent")
        )
        .collect();

      for (const email of sentEmails) {
        if (email.date < sinceMs) continue;
        totalSent++;
        if (email.deliveryStatus === "delivered") delivered++;
        else if (email.deliveryStatus === "bounced") bounced++;
        else if (email.deliveryStatus === "failed") failed++;
        if (email.openedAt) opened++;
        if (email.clickedLinks && email.clickedLinks.length > 0) clicked++;
        if (email.repliedAt) replied++;
      }
    }

    return { totalSent, delivered, bounced, failed, opened, clicked, replied };
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
