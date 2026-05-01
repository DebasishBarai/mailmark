import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";

// ── Queries ──

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

    const schedules = await ctx.db
      .query("warmingSchedules")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    // Enrich with domain and mailbox info
    const enriched = await Promise.all(
      schedules.map(async (s) => {
        const domain = await ctx.db.get(s.domainId);
        const mailbox = await ctx.db.get(s.mailboxId);
        return {
          ...s,
          domainName: domain?.domain ?? "Unknown",
          mailboxAddress: mailbox?.fullAddress ?? "Unknown",
        };
      })
    );

    return enriched;
  },
});

export const getByDomain = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;

    return await ctx.db
      .query("warmingSchedules")
      .withIndex("by_domain_id", (q) => q.eq("domainId", domainId))
      .first();
  },
});

// ── Mutations ──

// Warming schedule ramp: days 1-3 = 5/day, 4-7 = 15/day, 8-14 = 40/day, 15-21 = 100/day, 22-28 = 250/day
function getDailyLimitForDay(day: number): number {
  if (day <= 3) return 5;
  if (day <= 7) return 15;
  if (day <= 14) return 40;
  if (day <= 21) return 100;
  return 250;
}

export const start = mutation({
  args: {
    domainId: v.id("domains"),
    mailboxId: v.id("mailboxes"),
  },
  handler: async (ctx, { domainId, mailboxId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    // Verify ownership
    const domain = await ctx.db.get(domainId);
    if (!domain || domain.userId !== user._id) throw new Error("Not authorized");

    const mailbox = await ctx.db.get(mailboxId);
    if (!mailbox || mailbox.userId !== user._id) throw new Error("Not authorized");

    // Check for existing active schedule for this domain
    const existing = await ctx.db
      .query("warmingSchedules")
      .withIndex("by_domain_id", (q) => q.eq("domainId", domainId))
      .first();
    if (existing && existing.status === "active") {
      throw new Error("Warming schedule already active for this domain");
    }

    return await ctx.db.insert("warmingSchedules", {
      userId: user._id,
      domainId,
      mailboxId,
      status: "active",
      currentDay: 1,
      totalDays: 28,
      dailyLimit: getDailyLimitForDay(1),
      sentToday: 0,
      startedAt: Date.now(),
    });
  },
});

export const pause = mutation({
  args: { scheduleId: v.id("warmingSchedules") },
  handler: async (ctx, { scheduleId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const schedule = await ctx.db.get(scheduleId);
    if (!schedule) throw new Error("Schedule not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user || schedule.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.patch(scheduleId, { status: "paused" });
  },
});

export const resume = mutation({
  args: { scheduleId: v.id("warmingSchedules") },
  handler: async (ctx, { scheduleId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const schedule = await ctx.db.get(scheduleId);
    if (!schedule) throw new Error("Schedule not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user || schedule.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.patch(scheduleId, { status: "active" });
  },
});

// ── Internal (called by send pipeline) ──

export const getActiveByDomainId = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    return await ctx.db
      .query("warmingSchedules")
      .withIndex("by_domain_id", (q) => q.eq("domainId", domainId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();
  },
});

// ── Internal (called by cron) ──

export const listActiveSchedules = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("warmingSchedules")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
  },
});

export const advanceDay = internalMutation({
  args: { scheduleId: v.id("warmingSchedules") },
  handler: async (ctx, { scheduleId }) => {
    const schedule = await ctx.db.get(scheduleId);
    if (!schedule) return;

    const nextDay = schedule.currentDay + 1;
    if (nextDay > schedule.totalDays) {
      await ctx.db.patch(scheduleId, { status: "completed" });
      return;
    }

    await ctx.db.patch(scheduleId, {
      currentDay: nextDay,
      dailyLimit: getDailyLimitForDay(nextDay),
      sentToday: 0,
    });
  },
});

export const incrementSentToday = internalMutation({
  args: { scheduleId: v.id("warmingSchedules") },
  handler: async (ctx, { scheduleId }) => {
    const schedule = await ctx.db.get(scheduleId);
    if (!schedule) return;

    await ctx.db.patch(scheduleId, {
      sentToday: schedule.sentToday + 1,
      lastSentAt: Date.now(),
    });
  },
});
