import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { countChanged, countCreated, subscriptionBuckets } from "./lib/counters";
import {
  cancelAtPeriodEnd as dodoCancelAtPeriodEnd,
  changePlan as dodoChangePlan,
  createCheckout as dodoCreateCheckout,
} from "./lib/billing";

// const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const TRIAL_DURATION_MS = 0; // 0 days – upgrade required immediately

// Old values, which disagreed with every price the product quotes:
//   starter 1000, pro 2500, business 7500
// Pricing.tsx, UpgradeModal.tsx, billing/page.tsx and llms.txt all say
// $10 / $50 / $100, and those are the real prices.
const PLANS = {
  starter: { priceMonthly: 1000 },
  pro: { priceMonthly: 5000 },
  business: { priceMonthly: 10000 },
} as const;

export type PlanName = keyof typeof PLANS;

const planValidator = v.union(
  v.literal("starter"),
  v.literal("pro"),
  v.literal("business")
);

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

    // With TRIAL_DURATION_MS at 0 nobody ever gets in-app trial time, so a brand
    // new account is "expired" the moment it is created. That is intentional
    // (the 7 day trial now runs through Dodo checkout), but it means the UI
    // must not tell a first time visitor that a trial they never had has ended.
    const hadInAppTrial = TRIAL_DURATION_MS > 0;
    const hasEverSubscribed = subscription !== null;
    const upgradeReason: "new_user" | "trial_ended" | "subscription_ended" =
      hasEverSubscribed
        ? "subscription_ended"
        : hadInAppTrial
          ? "trial_ended"
          : "new_user";

    return {
      subscription,
      trialEndsAt,
      trialExpired,
      hasActiveSubscription,
      isBetaUser,
      isAdmin,
      // Old: only trialExpired was exposed, which the UI read as "trial ended".
      hadInAppTrial,
      hasEverSubscribed,
      upgradeReason,
      needsUpgrade: trialExpired && !hasActiveSubscription && !isBetaUser && !isAdmin,
    };
  },
});

/**
 * Start a Dodo Payments checkout for a plan, or move an existing Dodo
 * subscription onto that plan.
 *
 * Old behaviour (Polar): always created a checkout. That was safe on Polar
 * because a plan change there cancelled the old subscription and issued a new
 * one. Dodo does not do that, so sending an existing subscriber back through
 * checkout would leave them holding two live subscriptions and paying twice.
 * An existing Dodo subscriber therefore goes through change-plan instead, which
 * keeps the same subscription id and the same billing anchor.
 *
 * The return shape is unchanged so both callers (UpgradeModal and the billing
 * page) keep working: they assign `url` to window.location.
 */
export const createCheckoutSession = action({
  args: { plan: planValidator },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(internal.users.getUser, {
      subject: identity.subject,
    });
    if (!user) throw new Error("User not found");

    const appUrl = process.env.APP_URL;
    // Old: interpolated straight into the URL. Unset, that produced
    // "undefined/dashboard?upgraded=true" as the return_url, which Dodo rejects
    // with a validation error that says nothing about the real cause.
    if (!appUrl) throw new Error("APP_URL is not configured");

    // Old: required user.polarCustomerId, which signup created eagerly. Dodo
    // needs no pre-created customer, so there is nothing to check here.
    const existing = await ctx.runQuery(internal.subscriptions.getByUserId, {
      userId: user._id,
    });

    const isLive =
      existing !== null &&
      (existing.status === "active" || existing.status === "trialing");

    if (isLive && existing.dodoSubscriptionId) {
      if (existing.plan === args.plan) {
        // Already on this plan. Changing plan to itself would bill a proration
        // of zero and pointlessly move next_billing_date.
        return { url: `${appUrl}/billing` };
      }
      await dodoChangePlan({
        dodoSubscriptionId: existing.dodoSubscriptionId,
        plan: args.plan,
      });
      // The local row catches up when subscription.plan_changed arrives.
      return { url: `${appUrl}/billing?updated=true` };
    }

    // No subscription, or one that is canceled, past_due, or still billed
    // through Polar. All of those need a fresh mandate, so: hosted checkout.
    return await dodoCreateCheckout({
      plan: args.plan,
      clerkId: identity.subject,
      email: user.email || identity.email,
      name: user.name ?? identity.name,
      returnUrl: `${appUrl}/dashboard?upgraded=true`,
    });
  },
});

/** The caller's subscription row, for actions that cannot read the db directly. */
export const getByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("subscriptions")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();
  },
});

/**
 * Apply a Dodo subscription lifecycle event.
 *
 * Replaces handlePolarSubscriptionEvent. Two things moved inside this mutation
 * that used to sit in the HTTP handler, both because a Convex mutation is a
 * transaction and the pieces have to succeed or fail together:
 *
 *  - The idempotency claim. Dodo retries any delivery it did not get a 2xx for,
 *    reusing the same webhook-id. Claiming in a separate mutation would mark an
 *    event consumed and then lose the state change if this one threw, and the
 *    retry would be skipped as a duplicate. Claiming here means a throw rolls
 *    the claim back with it.
 *  - The affiliate commission, scheduled rather than called, because a mutation
 *    cannot runMutation. A scheduled job is enqueued transactionally, so it is
 *    dropped if this mutation rolls back.
 */
export const handleDodoSubscriptionEvent = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    dodoSubscriptionId: v.string(),
    dodoCustomerId: v.optional(v.string()),
    clerkId: v.string(),
    plan: planValidator,
    status: v.union(
      v.literal("active"),
      v.literal("trialing"),
      v.literal("canceled"),
      v.literal("past_due")
    ),
    currentPeriodEnd: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // ── Idempotency ─────────────────────────────────────────────────────────
    const seen = await ctx.db
      .query("webhookEvents")
      .withIndex("by_provider_event", (q) =>
        q.eq("provider", "dodo").eq("eventId", args.eventId)
      )
      .first();
    if (seen) {
      console.log(`[dodo-webhook] duplicate delivery ${args.eventId}, ignoring`);
      return;
    }
    await ctx.db.insert("webhookEvents", {
      provider: "dodo",
      eventId: args.eventId,
      eventType: args.eventType,
      receivedAt: Date.now(),
    });

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    // Throwing gives Dodo a 500 and it retries. The claim above rolls back with
    // this throw, so the retry is processed rather than skipped as a duplicate.
    if (!user) throw new Error(`User not found for clerkId: ${args.clerkId}`);

    if (args.dodoCustomerId && user.dodoCustomerId !== args.dodoCustomerId) {
      await ctx.db.patch(user._id, { dodoCustomerId: args.dodoCustomerId });
    }

    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();

    if (existing) {
      // A terminal event can arrive for a subscription the user has already
      // moved off, for example when an old subscription is cancelled after a
      // new one took over the row. Applying it would flip a live row to
      // canceled and drop a paying customer to free tier limits. Deactivations
      // are therefore only honoured when they are about the subscription this
      // row currently tracks. Activations still always apply, which is what
      // lets a new subscription take ownership of the row.
      const isDeactivation = args.status === "canceled" || args.status === "past_due";
      // Rows that predate Dodo, including the one still carrying a Polar
      // subscription, have nothing to compare against and must stay cancellable.
      const isForCurrentSubscription =
        existing.dodoSubscriptionId === undefined ||
        existing.dodoSubscriptionId === args.dodoSubscriptionId;

      if (isDeactivation && !isForCurrentSubscription) {
        console.warn(
          `[subscriptions] Ignoring "${args.status}" event for stale subscription ${args.dodoSubscriptionId}; row tracks ${existing.dodoSubscriptionId}`
        );
        return;
      }

      await ctx.db.patch(existing._id, {
        plan: args.plan,
        status: args.status,
        dodoSubscriptionId: args.dodoSubscriptionId,
        priceMonthly: PLANS[args.plan].priceMonthly,
        // Coalesced, not assigned. A patch that writes undefined removes the
        // field, and a terminal event usually carries no next_billing_date, so
        // assigning straight through would erase a period end the row already
        // knew and the billing page would lose the date it shows.
        currentPeriodEnd: args.currentPeriodEnd ?? existing.currentPeriodEnd,
        trialEndsAt: args.trialEndsAt ?? existing.trialEndsAt,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd ?? false,
        canceledAt: args.status === "canceled" ? Date.now() : existing.canceledAt,
        // startedAt is deliberately not patched. lib/period.periodStartDayKey
        // anchors the monthly send allowance on it, so moving it would move the
        // user's quota reset date. That includes the relink of the row that was
        // billed through Polar: it keeps its original anchor.
        //
        // The legacy polarSubscriptionId is left exactly as it is. Nothing can
        // act on it, because /polar-webhook no longer exists and no code looks a
        // subscription up by it, so leaving it costs nothing and makes the row
        // its own audit trail: both ids present means this row was migrated.
      });
      // Both status and plan can move here, so the row can leave one plan
      // counter and join another in a single write.
      const after = await ctx.db.get(existing._id);
      if (after) {
        await countChanged(
          ctx,
          subscriptionBuckets(existing),
          subscriptionBuckets(after)
        );
      }
    } else {
      const subscriptionId = await ctx.db.insert("subscriptions", {
        userId: user._id,
        plan: args.plan,
        status: args.status,
        dodoSubscriptionId: args.dodoSubscriptionId,
        priceMonthly: PLANS[args.plan].priceMonthly,
        startedAt: Date.now(),
        currentPeriodEnd: args.currentPeriodEnd,
        trialEndsAt: args.trialEndsAt,
        cancelAtPeriodEnd: args.cancelAtPeriodEnd ?? false,
      });
      const created = await ctx.db.get(subscriptionId);
      if (created) await countCreated(ctx, subscriptionBuckets(created));
    }

    // ── Affiliate commission ────────────────────────────────────────────────
    // subscription.active is the first-activation event, the Dodo counterpart
    // of Polar's subscription.created. plan_changed is here too because on
    // Polar a plan change cancelled and recreated the subscription, so the
    // commission rate followed the new plan by itself; Dodo keeps the same
    // subscription, so the rate has to be moved explicitly.
    //
    // Both are safe to deliver more than once: recordCommission adjusts the
    // affiliate's total by the difference from what this referral already
    // contributes, so a repeated subscription.active (which Dodo sends on every
    // recovery from on_hold) changes nothing.
    //
    // Scheduling rather than calling, because a mutation cannot runMutation
    // another mutation. The enqueue is transactional, so it is dropped if this
    // mutation rolls back.
    if (
      (args.eventType === "subscription.active" ||
        args.eventType === "subscription.plan_changed") &&
      (args.status === "active" || args.status === "trialing")
    ) {
      await ctx.scheduler.runAfter(0, internal.affiliates.recordCommission, {
        referredUserId: user._id,
        plan: args.plan,
        dodoSubscriptionId: args.dodoSubscriptionId,
      });
    } else if (args.status === "canceled") {
      // Keyed on the local status rather than the event name, so a cancel that
      // leaves the customer paid up to period end does not reverse the
      // referrer's commission until the subscription actually lapses.
      await ctx.scheduler.runAfter(0, internal.affiliates.cancelCommission, {
        dodoSubscriptionId: args.dodoSubscriptionId,
      });
    }
  },
});

/**
 * Cancel the current user's subscription at the end of the paid period.
 *
 * Old behaviour (cancelViaPolar): DELETE on Polar, then an immediate local
 * write of status "canceled". quotas.isEntitledStatus is false for canceled, so
 * the customer dropped to free tier limits (1 domain, 3 mailboxes, 1,000
 * emails) the moment they clicked Cancel, despite having paid for the rest of
 * the month, and despite the product promising the opposite.
 *
 * Now the provider is told to stop renewing and the local row is left entitled.
 * Dodo sends the terminal event when the period actually ends, and
 * lib/billing.mapDodoStatus keeps the row active until then.
 */
export const cancelViaDodo = action({
  args: {},
  handler: async (ctx): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.runQuery(internal.users.getUser, {
      subject: identity.subject,
    });
    if (!user) throw new Error("User not found");

    const existing = await ctx.runQuery(internal.subscriptions.getByUserId, {
      userId: user._id,
    });
    if (!existing || !existing.dodoSubscriptionId) {
      throw new Error("No subscription to cancel");
    }
    const dodoSubscriptionId = existing.dodoSubscriptionId;

    const updated = await dodoCancelAtPeriodEnd({ dodoSubscriptionId });

    // Reflect the request immediately so the billing page can say so without
    // waiting for the webhook. Entitlement is untouched on purpose.
    await ctx.runMutation(internal.subscriptions.markCancelAtPeriodEnd, {
      subscriptionId: existing._id,
      currentPeriodEnd: updated.next_billing_date
        ? Date.parse(updated.next_billing_date)
        : undefined,
    });
  },
});

/** Flag a subscription as cancelling at period end, without changing status. */
export const markCancelAtPeriodEnd = internalMutation({
  args: {
    subscriptionId: v.id("subscriptions"),
    currentPeriodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription) return;
    await ctx.db.patch(args.subscriptionId, {
      cancelAtPeriodEnd: true,
      currentPeriodEnd:
        args.currentPeriodEnd !== undefined && Number.isFinite(args.currentPeriodEnd)
          ? args.currentPeriodEnd
          : subscription.currentPeriodEnd,
    });
    // No counter movement: the row has not left active or trialing.
  },
});

/**
 * One-shot repair for a subscription whose Dodo id was not picked up from a
 * webhook, for example a subscription created from the Dodo dashboard with no
 * clerkId in its metadata.
 *
 * Run from the Convex dashboard or `bunx convex run --prod`. Patches, never
 * inserts, so startedAt and the user's send allowance window survive.
 */
export const relinkSubscriptionToDodo = internalMutation({
  args: {
    clerkId: v.string(),
    dodoSubscriptionId: v.string(),
    plan: planValidator,
    status: v.union(
      v.literal("active"),
      v.literal("trialing"),
      v.literal("canceled"),
      v.literal("past_due")
    ),
    currentPeriodEnd: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
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
    if (!existing) {
      throw new Error(
        `No subscription row for ${args.clerkId}. Let the webhook create it rather than inserting one here, so startedAt is set from the real activation.`
      );
    }

    await ctx.db.patch(existing._id, {
      plan: args.plan,
      status: args.status,
      dodoSubscriptionId: args.dodoSubscriptionId,
      priceMonthly: PLANS[args.plan].priceMonthly,
      currentPeriodEnd: args.currentPeriodEnd ?? existing.currentPeriodEnd,
      trialEndsAt: args.trialEndsAt ?? existing.trialEndsAt,
      // The legacy polarSubscriptionId is left untouched, as above.
    });

    const after = await ctx.db.get(existing._id);
    if (after) {
      await countChanged(
        ctx,
        subscriptionBuckets(existing),
        subscriptionBuckets(after)
      );
    }

    return {
      relinked: existing._id,
      // Echoed back so the operator can confirm the billing anchor survived.
      startedAt: existing.startedAt,
    };
  },
});

/** Drop webhook receipts older than 30 days. Scheduled from crons.ts. */
export const pruneWebhookEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const stale = await ctx.db
      .query("webhookEvents")
      .withIndex("by_receivedAt", (q) => q.lt("receivedAt", cutoff))
      .take(500);
    for (const row of stale) await ctx.db.delete(row._id);
    return { deleted: stale.length };
  },
});

/* Old: a local-only cancel that wrote status "canceled" without telling the
   payment provider, leaving the subscription billing on Polar while the app
   treated it as ended. Nothing ever called it. Commented out rather than
   deleted, per the repo convention, so it cannot be wired up by accident.

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
    const canceled = await ctx.db.get(subscription._id);
    if (canceled) {
      await countChanged(
        ctx,
        subscriptionBuckets(subscription),
        subscriptionBuckets(canceled)
      );
    }
  },
});
*/
