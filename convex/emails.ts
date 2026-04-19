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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("emails", {
      ...args,
      folder: "inbox",
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
