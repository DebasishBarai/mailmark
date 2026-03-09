import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const PLANS = {
  starter: { priceMonthly: 900 },
  pro: { priceMonthly: 2900 },
  business: { priceMonthly: 9900 },
} as const;

export type PlanName = keyof typeof PLANS;

/** Return the current user's subscription + trial status. */
export const currentStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();

    const trialEndsAt = user._creationTime + TRIAL_DURATION_MS;
    const trialExpired = Date.now() > trialEndsAt;
    const hasActiveSubscription =
      subscription !== null && subscription.status === "active";

    return {
      subscription,
      trialEndsAt,
      trialExpired,
      hasActiveSubscription,
      needsUpgrade: trialExpired && !hasActiveSubscription,
    };
  },
});

/** Subscribe the current user to a plan. */
export const subscribe = mutation({
  args: {
    plan: v.union(
      v.literal("starter"),
      v.literal("pro"),
      v.literal("business")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    // Check for existing active subscription
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();

    if (existing && existing.status === "active") {
      // Upgrade/downgrade — update in place
      await ctx.db.patch(existing._id, {
        plan: args.plan,
        priceMonthly: PLANS[args.plan].priceMonthly,
      });
      return existing._id;
    }

    // Create new subscription
    return await ctx.db.insert("subscriptions", {
      userId: user._id,
      plan: args.plan,
      status: "active",
      priceMonthly: PLANS[args.plan].priceMonthly,
      startedAt: Date.now(),
    });
  },
});

/** Cancel the current user's subscription. */
export const cancel = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();

    if (!subscription || subscription.status !== "active") {
      throw new Error("No active subscription to cancel");
    }

    await ctx.db.patch(subscription._id, {
      status: "canceled",
      canceledAt: Date.now(),
    });
  },
});
