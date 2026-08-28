import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { applyAccountFailure } from "./platformWarmupAccounts";

// Most emails an engagement round will pick up at once. The round opens an
// IMAP connection per email, so an unbounded batch is a Convex action timeout
// waiting to happen once more than a handful of mailboxes are warming.
const ENGAGEMENT_BATCH_SIZE = 150;

// Placements a mailbox needs before its health score means anything.
const MIN_PLACEMENT_SAMPLE = 3;

// Bounce rate over the scoring window that stops warmup on its own, and the
// sample it needs first. AWS suspends sending above 10%, so a warmup run that
// gets there is actively spending the customer's SES account. A dead platform
// Gmail address is paused on its first hard bounce and so cannot push a
// healthy mailbox anywhere near this on its own.
const MAX_BOUNCE_RATE = 10;
const MIN_BOUNCE_SAMPLE = 10;

// A warmup send SES told us did not arrive. Everything here is a placement
// answer in its own right: the message never reached an inbox to be found in.
const FAILED_DELIVERY_STATUSES = ["bounced", "failed", "complained"];

function getDailyLimit(speed: "slow" | "normal" | "fast", day: number): number {
  if (speed === "slow") {
    if (day <= 7) return 2;
    if (day <= 14) return 5;
    if (day <= 21) return 10;
    if (day <= 28) return 15;
    return 20;
  }
  if (speed === "normal") {
    if (day <= 3) return 5;
    if (day <= 7) return 10;
    if (day <= 14) return 15;
    if (day <= 21) return 20;
    return 20;
  }
  // fast
  if (day <= 3) return 10;
  if (day <= 7) return 15;
  if (day <= 14) return 20;
  return 20;
}

export const startWarmup = mutation({
  args: {
    mailboxId: v.id("mailboxes"),
    speed: v.union(v.literal("slow"), v.literal("normal"), v.literal("fast")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const mailbox = await ctx.db.get(args.mailboxId);
    if (!mailbox || mailbox.userId !== user._id) throw new Error("Mailbox not found");

    const domain = await ctx.db.get(mailbox.domainId);
    if (!domain) throw new Error("Domain not found");
    if (!domain.spfVerified || !domain.dkimVerified || !domain.dmarcVerified) {
      throw new Error("Domain DNS (SPF + DKIM + DMARC) must be fully configured before starting warmup");
    }

    const existing = await ctx.db
      .query("warmupMailboxes")
      .withIndex("by_mailbox_id", (q) => q.eq("mailboxId", args.mailboxId))
      .first();
    if (existing && existing.status === "active") {
      throw new Error("This mailbox is already enrolled in warmup");
    }

    const dailyLimit = getDailyLimit(args.speed, 1);

    return await ctx.db.insert("warmupMailboxes", {
      userId: user._id,
      mailboxId: args.mailboxId,
      domainId: mailbox.domainId,
      status: "active",
      speed: args.speed,
      dailyLimit,
      sentToday: 0,
      receivedToday: 0,
      currentDay: 1,
      healthScore: 100,
      inboxRate: 100,
      startedAt: Date.now(),
    });
  },
});

export const pauseWarmup = mutation({
  args: { warmupMailboxId: v.id("warmupMailboxes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const entry = await ctx.db.get(args.warmupMailboxId);
    if (!entry || entry.userId !== user._id) throw new Error("Warmup entry not found");

    await ctx.db.patch(args.warmupMailboxId, { status: "paused" });
  },
});

export const resumeWarmup = mutation({
  args: { warmupMailboxId: v.id("warmupMailboxes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const entry = await ctx.db.get(args.warmupMailboxId);
    if (!entry || entry.userId !== user._id) throw new Error("Warmup entry not found");

    // await ctx.db.patch(args.warmupMailboxId, { status: "active" });
    // Clear any auto-pause explanation along with the pause it explains.
    await ctx.db.patch(args.warmupMailboxId, {
      status: "active",
      pausedReason: undefined,
    });
  },
});

export const updateSpeed = mutation({
  args: {
    warmupMailboxId: v.id("warmupMailboxes"),
    speed: v.union(v.literal("slow"), v.literal("normal"), v.literal("fast")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const entry = await ctx.db.get(args.warmupMailboxId);
    if (!entry || entry.userId !== user._id) throw new Error("Warmup entry not found");

    const dailyLimit = getDailyLimit(args.speed, entry.currentDay);
    await ctx.db.patch(args.warmupMailboxId, {
      speed: args.speed,
      dailyLimit,
    });
  },
});

export const getWarmupStatus = query({
  args: { mailboxId: v.id("mailboxes") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;

    const entry = await ctx.db
      .query("warmupMailboxes")
      .withIndex("by_mailbox_id", (q) => q.eq("mailboxId", args.mailboxId))
      .first();

    if (!entry || entry.userId !== user._id) return null;
    return entry;
  },
});

export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const entries = await ctx.db
      .query("warmupMailboxes")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    const enriched = await Promise.all(
      entries.map(async (entry) => {
        const mailbox = await ctx.db.get(entry.mailboxId);
        const domain = await ctx.db.get(entry.domainId);
        return {
          ...entry,
          mailboxAddress: mailbox?.fullAddress ?? "unknown",
          domainName: domain?.domain ?? "unknown",
        };
      })
    );

    return enriched;
  },
});

export const getWarmupHistory = query({
  args: {
    warmupMailboxId: v.id("warmupMailboxes"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const entry = await ctx.db.get(args.warmupMailboxId);
    if (!entry || entry.userId !== user._id) return [];

    const lookbackMs = (args.days ?? 14) * 24 * 60 * 60 * 1000;
    const since = Date.now() - lookbackMs;

    // const emails = await ctx.db
    //   .query("warmupEmails")
    //   .withIndex("by_warmup_mailbox", (q) => q.eq("warmupMailboxId", args.warmupMailboxId))
    //   .collect();
    //
    // return emails.filter((e) => e.sentAt >= since);
    return await ctx.db
      .query("warmupEmails")
      .withIndex("by_warmup_mailbox_and_date", (q) =>
        q.eq("warmupMailboxId", args.warmupMailboxId).gte("sentAt", since)
      )
      .collect();
  },
});

export const getRecentWarmupEmails = query({
  args: { warmupMailboxId: v.id("warmupMailboxes"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const entry = await ctx.db.get(args.warmupMailboxId);
    if (!entry || entry.userId !== user._id) return [];

    const emails = await ctx.db
      .query("warmupEmails")
      .withIndex("by_warmup_mailbox", (q) => q.eq("warmupMailboxId", args.warmupMailboxId))
      .order("desc")
      .take(args.limit ?? 20);

    return emails;
  },
});

export const getWarmupMailboxById = internalQuery({
  args: { warmupMailboxId: v.id("warmupMailboxes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.warmupMailboxId);
  },
});

export const listActiveWarmupMailboxes = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("warmupMailboxes")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
  },
});

export const incrementSentToday = internalMutation({
  args: { warmupMailboxId: v.id("warmupMailboxes") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.warmupMailboxId);
    if (!entry) return;
    await ctx.db.patch(args.warmupMailboxId, {
      sentToday: entry.sentToday + 1,
      lastActivityAt: Date.now(),
    });
  },
});

export const incrementReceivedToday = internalMutation({
  args: { warmupMailboxId: v.id("warmupMailboxes") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.warmupMailboxId);
    if (!entry) return;
    await ctx.db.patch(args.warmupMailboxId, {
      receivedToday: entry.receivedToday + 1,
      lastActivityAt: Date.now(),
    });
  },
});

export const advanceDay = internalMutation({
  args: { warmupMailboxId: v.id("warmupMailboxes") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.warmupMailboxId);
    if (!entry) return;

    const newDay = entry.currentDay + 1;
    const dailyLimit = getDailyLimit(entry.speed, newDay);

    await ctx.db.patch(args.warmupMailboxId, {
      currentDay: newDay,
      dailyLimit,
      sentToday: 0,
      receivedToday: 0,
    });
  },
});

// The score used to be inboxRate * 0.6 + openRate * 0.2 + replyRate * 0.2 over
// every recent outbound email. Two things were wrong with that:
//
//   1. Opens and replies are simulated on the Gmail side at fixed odds (85% and
//      25% of those, in warmupEngagement). They measure our own dice rolls, not
//      the mailbox. Baking them in capped a flawless mailbox at roughly 81 and
//      pushed it under the 80% the UI paints green.
//   2. Emails still marked "unknown" counted in the denominator as if they had
//      missed the inbox. An unresolved placement is missing data, not a failed
//      delivery, and the four hour engagement window leaves some behind.
//
// Placement is the only real deliverability signal here, so it is the score.
//
// export const recalculateHealthScore = internalMutation({
//   args: { warmupMailboxId: v.id("warmupMailboxes") },
//   handler: async (ctx, args) => {
//     const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
//
//     const emails = await ctx.db
//       .query("warmupEmails")
//       .withIndex("by_warmup_mailbox", (q) => q.eq("warmupMailboxId", args.warmupMailboxId))
//       .collect();
//
//     const recentOutbound = emails.filter(
//       (e) => e.direction === "outbound" && e.sentAt >= sevenDaysAgo
//     );
//
//     if (recentOutbound.length === 0) return;
//
//     const total = recentOutbound.length;
//     const inboxCount = recentOutbound.filter((e) => e.placement === "inbox").length;
//     const openedCount = recentOutbound.filter((e) => e.openedAt).length;
//     const repliedCount = recentOutbound.filter((e) => e.repliedAt).length;
//
//     const inboxRate = (inboxCount / total) * 100;
//     const openRate = (openedCount / total) * 100;
//     const replyRate = (repliedCount / total) * 100;
//
//     const healthScore = Math.round(inboxRate * 0.6 + openRate * 0.2 + replyRate * 0.2);
//
//     await ctx.db.patch(args.warmupMailboxId, {
//       healthScore,
//       inboxRate: Math.round(inboxRate),
//     });
//   },
// });
export const recalculateHealthScore = internalMutation({
  args: { warmupMailboxId: v.id("warmupMailboxes") },
  handler: async (ctx, args) => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const recent = await ctx.db
      .query("warmupEmails")
      .withIndex("by_warmup_mailbox_and_date", (q) =>
        q.eq("warmupMailboxId", args.warmupMailboxId).gte("sentAt", sevenDaysAgo)
      )
      .collect();

    const recentOutbound = recent.filter((e) => e.direction === "outbound");

    // Score only what we actually observed. Too few answers and we leave the
    // previous score alone rather than swinging it on one data point.
    //
    // A bounced send counts, and counts against us: SES told us it never
    // arrived, which is a worse outcome than landing in spam, and its
    // placement stays "unknown" forever precisely because there is no message
    // in any folder for the IMAP check to find.
    const bounced = recentOutbound.filter(
      (e) => e.deliveryStatus && FAILED_DELIVERY_STATUSES.includes(e.deliveryStatus)
    );
    const placed = recentOutbound.filter(
      (e) =>
        e.placement !== "unknown" &&
        !(e.deliveryStatus && FAILED_DELIVERY_STATUSES.includes(e.deliveryStatus))
    );

    const answered = placed.length + bounced.length;
    if (answered < MIN_PLACEMENT_SAMPLE) return;

    // A message Gmail filed as spam landed in spam even though the engagement
    // round then rescued it and rewrote placement to "inbox". rescuedFromSpam
    // is what survives that rewrite, so it is what keeps the score honest.
    const inboxCount = placed.filter(
      (e) => e.placement === "inbox" && !e.rescuedFromSpam
    ).length;

    const inboxRate = (inboxCount / answered) * 100;

    await ctx.db.patch(args.warmupMailboxId, {
      healthScore: Math.round(inboxRate),
      inboxRate: Math.round(inboxRate),
    });
  },
});

export const createWarmupEmailRecord = internalMutation({
  args: {
    warmupMailboxId: v.id("warmupMailboxes"),
    platformAccountId: v.id("platformWarmupAccounts"),
    direction: v.union(v.literal("outbound"), v.literal("inbound")),
    fromAddress: v.string(),
    toAddress: v.string(),
    messageId: v.string(),
    subject: v.string(),
    // Outbound only. Inbound warmup leaves the platform Gmail account over
    // SMTP, so SES never sees it and never reports on it.
    sesMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("warmupEmails", {
      warmupMailboxId: args.warmupMailboxId,
      platformAccountId: args.platformAccountId,
      direction: args.direction,
      fromAddress: args.fromAddress,
      toAddress: args.toAddress,
      messageId: args.messageId,
      subject: args.subject,
      sentAt: Date.now(),
      placement: "unknown",
      ...(args.sesMessageId
        ? { sesMessageId: args.sesMessageId, deliveryStatus: "pending" as const }
        : {}),
    });
  },
});

// SES delivery, bounce and complaint notifications land here by way of
// /trackDelivery. Before this, warmup sends carried no SES id and no row for a
// notification to find, so a warmup bounce was dropped on the floor while
// still counting towards the bounce rate AWS suspends accounts over.
export const recordWarmupDeliveryStatus = internalMutation({
  args: {
    sesMessageId: v.string(),
    status: v.union(
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("failed"),
      v.literal("complained")
    ),
    timestamp: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = await ctx.db
      .query("warmupEmails")
      .withIndex("by_ses_message_id", (q) => q.eq("sesMessageId", args.sesMessageId))
      .first();

    // Not a warmup send. Regular mail is handled by emails.updateDeliveryStatus.
    if (!email) return { matched: false };

    const failed = FAILED_DELIVERY_STATUSES.includes(args.status);

    await ctx.db.patch(email._id, {
      deliveryStatus: args.status,
      ...(failed
        ? { bouncedAt: args.timestamp, bounceReason: args.reason?.slice(0, 300) }
        : {}),
    });

    if (!failed) return { matched: true };

    // The recipient here is one of our own Gmail accounts, so a bounce says
    // more about that account than about the sender. "failed" is SES's
    // permanent bounce: the address is gone and no retry will fix it, so the
    // account leaves rotation now rather than after three strikes.
    await applyAccountFailure(
      ctx.db,
      email.platformAccountId,
      `SES ${args.status} on warmup send: ${args.reason ?? "no reason given"}`,
      args.status === "failed"
    );

    // Bounces that keep coming are the sending domain's problem, not one dead
    // recipient's, and warmup is then burning down the SES account it exists
    // to protect. Checked on every bounce rather than once a day: a day of
    // bounces is what we are trying not to send.
    const warmup = await ctx.db.get(email.warmupMailboxId);
    if (!warmup || warmup.status !== "active") return { matched: true };

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = await ctx.db
      .query("warmupEmails")
      .withIndex("by_warmup_mailbox_and_date", (q) =>
        q.eq("warmupMailboxId", email.warmupMailboxId).gte("sentAt", sevenDaysAgo)
      )
      .collect();

    // Only sends SES has reported on. Ones still pending say nothing yet and
    // would only dilute the rate.
    const answered = recent.filter(
      (e) =>
        e.direction === "outbound" &&
        e.deliveryStatus !== undefined &&
        e.deliveryStatus !== "pending"
    );
    if (answered.length < MIN_BOUNCE_SAMPLE) return { matched: true };

    const bounces = answered.filter((e) =>
      FAILED_DELIVERY_STATUSES.includes(e.deliveryStatus as string)
    ).length;
    const bounceRate = (bounces / answered.length) * 100;

    if (bounceRate >= MAX_BOUNCE_RATE) {
      const rounded = Math.round(bounceRate * 10) / 10;
      await ctx.db.patch(email.warmupMailboxId, {
        status: "paused",
        pausedReason: `Warmup paused automatically: ${rounded}% of the last ${answered.length} warmup sends bounced. Sending above 10% risks suspension of the SES account, so check the mailbox and its DNS before resuming.`,
      });
      console.error(
        `Warmup mailbox ${email.warmupMailboxId} auto-paused at ${rounded}% bounce rate over ${answered.length} sends`
      );
    }

    return { matched: true };
  },
});

export const updateWarmupEmailPlacement = internalMutation({
  args: {
    warmupEmailId: v.id("warmupEmails"),
    placement: v.union(v.literal("inbox"), v.literal("spam"), v.literal("unknown")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.warmupEmailId, { placement: args.placement });
  },
});

export const markWarmupEmailOpened = internalMutation({
  args: { warmupEmailId: v.id("warmupEmails") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.warmupEmailId, { openedAt: Date.now() });
  },
});

export const markWarmupEmailReplied = internalMutation({
  args: {
    warmupEmailId: v.id("warmupEmails"),
    repliedMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.warmupEmailId, {
      repliedAt: Date.now(),
      repliedMessageId: args.repliedMessageId,
    });
  },
});

export const markWarmupEmailImportant = internalMutation({
  args: { warmupEmailId: v.id("warmupEmails") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.warmupEmailId, { markedImportant: true });
  },
});

export const markWarmupEmailRescued = internalMutation({
  args: { warmupEmailId: v.id("warmupEmails") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.warmupEmailId, {
      rescuedFromSpam: true,
      placement: "inbox",
    });
  },
});

export const getWarmupEmailByMessageId = internalQuery({
  args: { messageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("warmupEmails")
      .withIndex("by_message_id", (q) => q.eq("messageId", args.messageId))
      .first();
  },
});

// This used to collect the entire warmupEmails table and filter in memory. That
// reads every warmup email ever sent by every customer, so it was on course to
// blow Convex's per-query document read limit and take the whole engagement
// cron down with it. The by_sent_date index bounds the read to the window we
// actually care about, and the batch cap bounds the work of one round.
//
// export const getRecentOutboundForEngagement = internalQuery({
//   args: {},
//   handler: async (ctx) => {
//     const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
//     const emails = await ctx.db
//       .query("warmupEmails")
//       .withIndex("by_sent_date")
//       .order("desc")
//       .collect();
//
//     return emails.filter(
//       (e) =>
//         e.direction === "outbound" &&
//         e.sentAt >= fourHoursAgo &&
//         !e.openedAt
//     );
//   },
// });
export const getRecentOutboundForEngagement = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;

    // Oldest first, not newest first: an email only has this four hour window
    // to get its placement resolved, so the ones about to fall out of it are
    // the ones a capped batch should spend its budget on.
    return await ctx.db
      .query("warmupEmails")
      .withIndex("by_sent_date", (q) => q.gte("sentAt", fourHoursAgo))
      .filter((q) =>
        q.and(
          q.eq(q.field("direction"), "outbound"),
          q.eq(q.field("openedAt"), undefined),
          // A bounced send is not sitting in an inbox waiting to be found, so
          // there is nothing for an IMAP session to do but cost us a
          // connection every round until the window closes.
          q.neq(q.field("deliveryStatus"), "bounced"),
          q.neq(q.field("deliveryStatus"), "failed"),
          q.neq(q.field("deliveryStatus"), "complained")
        )
      )
      .take(args.limit ?? ENGAGEMENT_BATCH_SIZE);
  },
});

export const listByDomainInternal = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    // const warmupMailboxes = await ctx.db
    //   .query("warmupMailboxes")
    //   .collect();
    // const filtered = warmupMailboxes.filter((w) => w.domainId === domainId);
    // Reading every warming mailbox on the platform to answer a question about
    // one domain. by_domain_id reads only that domain's.
    const filtered = await ctx.db
      .query("warmupMailboxes")
      .withIndex("by_domain_id", (q) => q.eq("domainId", domainId))
      .collect();

    const results = await Promise.all(
      filtered.map(async (w) => {
        const mailbox = await ctx.db.get(w.mailboxId);
        return {
          ...w,
          fullAddress: mailbox?.fullAddress ?? null,
        };
      })
    );

    return results;
  },
});
