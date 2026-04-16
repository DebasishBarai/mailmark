import { action, internalMutation, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";

// const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const TRIAL_DURATION_MS = 0; // 0 days – upgrade required immediately

const PLANS = {
  starter: { priceMonthly: 1000 },
  pro: { priceMonthly: 2500 },
  business: { priceMonthly: 7500 },
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
      subscription !== null && (subscription.status === "active" || subscription.status === "trialing");
    const isBetaUser = user.category === "beta";
    const isAdmin = user.category === "admin";

    return {
      subscription,
      trialEndsAt,
      trialExpired,
      hasActiveSubscription,
      isBetaUser,
      isAdmin,
      needsUpgrade: trialExpired && !hasActiveSubscription && !isBetaUser && !isAdmin,
    };
  },
});

/**
 * Create a Polar checkout session and return the redirect URL.
 * The plan maps to a Polar product price ID configured via env vars.
 */
export const createCheckoutSession = action({
  args: {
    plan: v.union(
      v.literal("starter"),
      v.literal("pro"),
      v.literal("business")
    ),
  },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(internal.users.getUser, {
      subject: identity.subject,
    });
    if (!user) throw new Error("User not found");
    if (!user.polarCustomerId) throw new Error("Polar customer not linked to this account");

    const priceIdMap: Record<string, string | undefined> = {
      starter: process.env.POLAR_PRICE_ID_STARTER,
      pro: process.env.POLAR_PRICE_ID_PRO,
      business: process.env.POLAR_PRICE_ID_BUSINESS,
    };

    const priceId = priceIdMap[args.plan];
    if (!priceId) throw new Error(`Polar price ID not configured for plan: ${args.plan}`);

    const successUrl = `${process.env.APP_URL}/dashboard?upgraded=true`;

    const polarResponse = await fetch(`${process.env.POLAR_BASE_URL}/v1/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_price_id: priceId,
        customer_external_id: identity.subject,
        success_url: successUrl,
      }),
    });

    if (!polarResponse.ok) {
      const errorText = await polarResponse.text();
      throw new Error(`Failed to create Polar checkout: ${errorText}`);
    }

    const checkout = await polarResponse.json();
    return { url: checkout.url };
  },
});

/**
 * Called by the Polar webhook handler to activate/cancel a subscription.
 * Plan is resolved from the Polar product ID before calling this mutation.
 */
export const handlePolarSubscriptionEvent = internalMutation({
  args: {
    polarSubscriptionId: v.string(),
    clerkId: v.string(), // customer.external_id from Polar
    plan: v.union(v.literal("starter"), v.literal("pro"), v.literal("business")),
    status: v.union(v.literal("active"), v.literal("trialing"), v.literal("canceled"), v.literal("past_due")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) throw new Error(`User not found for clerkId: ${args.clerkId}`);

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        plan: args.plan,
        status: args.status,
        polarSubscriptionId: args.polarSubscriptionId,
        priceMonthly: PLANS[args.plan].priceMonthly,
        canceledAt: args.status === "canceled" ? Date.now() : existing.canceledAt,
      });
    } else {
      await ctx.db.insert("subscriptions", {
        userId: user._id,
        plan: args.plan,
        status: args.status,
        polarSubscriptionId: args.polarSubscriptionId,
        priceMonthly: PLANS[args.plan].priceMonthly,
        startedAt: Date.now(),
      });
    }
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

    if (!subscription || (subscription.status !== "active" && subscription.status !== "trialing")) {
      throw new Error("No active subscription to cancel");
    }

    await ctx.db.patch(subscription._id, {
      status: "canceled",
      canceledAt: Date.now(),
    });
  },
});

/** Cancel the current user's subscription via Polar API and update local DB. */
export const cancelViaPolar = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(internal.users.getUser, {
      subject: identity.subject,
    });
    if (!user) throw new Error("User not found");

    const status = await ctx.runQuery(api.subscriptions.currentStatus);
    const polarSubscriptionId = status?.subscription?.polarSubscriptionId;
    if (!polarSubscriptionId) throw new Error("No subscription to cancel");

    const polarResponse = await fetch(
      `${process.env.POLAR_BASE_URL}/v1/subscriptions/${polarSubscriptionId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
        },
      }
    );

    if (!polarResponse.ok) {
      const errorText = await polarResponse.text();
      throw new Error(`Failed to cancel subscription: ${errorText}`);
    }

    await ctx.runMutation(internal.subscriptions.handlePolarSubscriptionEvent, {
      polarSubscriptionId,
      clerkId: identity.subject,
      plan: status!.subscription!.plan,
      status: "canceled",
    });
  },
});
