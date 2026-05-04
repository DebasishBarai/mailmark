import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";

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

    await ctx.db.patch(args.warmupMailboxId, { status: "active" });
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

    const emails = await ctx.db
      .query("warmupEmails")
      .withIndex("by_warmup_mailbox", (q) => q.eq("warmupMailboxId", args.warmupMailboxId))
      .collect();

    return emails.filter((e) => e.sentAt >= since);
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

export const recalculateHealthScore = internalMutation({
  args: { warmupMailboxId: v.id("warmupMailboxes") },
  handler: async (ctx, args) => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const emails = await ctx.db
      .query("warmupEmails")
      .withIndex("by_warmup_mailbox", (q) => q.eq("warmupMailboxId", args.warmupMailboxId))
      .collect();

    const recentOutbound = emails.filter(
      (e) => e.direction === "outbound" && e.sentAt >= sevenDaysAgo
    );

    if (recentOutbound.length === 0) return;

    const total = recentOutbound.length;
    const inboxCount = recentOutbound.filter((e) => e.placement === "inbox").length;
    const openedCount = recentOutbound.filter((e) => e.openedAt).length;
    const repliedCount = recentOutbound.filter((e) => e.repliedAt).length;

    const inboxRate = (inboxCount / total) * 100;
    const openRate = (openedCount / total) * 100;
    const replyRate = (repliedCount / total) * 100;

    const healthScore = Math.round(inboxRate * 0.6 + openRate * 0.2 + replyRate * 0.2);

    await ctx.db.patch(args.warmupMailboxId, {
      healthScore,
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
    });
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

export const getRecentOutboundForEngagement = internalQuery({
  args: {},
  handler: async (ctx) => {
    const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
    const emails = await ctx.db
      .query("warmupEmails")
      .withIndex("by_sent_date")
      .order("desc")
      .collect();

    return emails.filter(
      (e) =>
        e.direction === "outbound" &&
        e.sentAt >= fourHoursAgo &&
        !e.openedAt
    );
  },
});
