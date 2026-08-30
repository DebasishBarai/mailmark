import { internalQuery, query } from "./_generated/server";
import { v } from "convex/values";

// null = unlimited
export const PLAN_LIMITS = {
  free:     { domains: 1,    mailboxes: 3,    emailsPerMonth: 1_000 },
  starter:  { domains: 1,    mailboxes: 3,    emailsPerMonth: 1_000 },
  pro:      { domains: 5,    mailboxes: null, emailsPerMonth: 25_000 },
  business: { domains: null, mailboxes: null, emailsPerMonth: 100_000 },
} as const;

export type PlanLimits = typeof PLAN_LIMITS[keyof typeof PLAN_LIMITS];

/** Statuses that entitle a user to the limits of the plan they signed up for.
 *  Kept in sync with hasActiveSubscription in subscriptions.currentStatus.
 *  "trialing" counts: starter and pro carry a 7 day trial through Polar, and a
 *  subscriber inside that trial must get their plan's limits, not free tier
 *  ones. Note "past_due" is deliberately excluded, since that is a payment
 *  failure rather than a live entitlement. */
export function isEntitledStatus(status: string | undefined | null): boolean {
  return status === "active" || status === "trialing";
}

/** Returns the limits for the user's current effective plan.
 *  Beta users get starter-tier limits (paywall bypassed, not unlimited).
 *  Users with no active or trialing subscription get free-tier limits. */
export const getUserLimits = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<PlanLimits> => {
    const user = await ctx.db.get(userId);
    if (user?.category === "admin") {
      return PLAN_LIMITS["business"];
    }
    if (user?.category === "beta") {
      return PLAN_LIMITS["starter"];
    }

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    // Old: subscription?.status === "active" ? subscription.plan : "free"
    // That sent trialing subscribers to free tier limits mid-trial.
    const plan =
      subscription && isEntitledStatus(subscription.status) ? subscription.plan : "free";

    return PLAN_LIMITS[plan];
  },
});

/** Returns the effective plan name for a user (used in mutations that can't call internalQuery). */
export function resolvePlan(
  userCategory: string | undefined,
  subscriptionStatus: string | undefined | null,
  subscriptionPlan: string | undefined | null,
): keyof typeof PLAN_LIMITS {
  if (userCategory === "admin") return "business";
  if (userCategory === "beta") return "starter";
  // Old: if (subscriptionStatus === "active" && subscriptionPlan)
  if (isEntitledStatus(subscriptionStatus) && subscriptionPlan) {
    return subscriptionPlan as keyof typeof PLAN_LIMITS;
  }
  return "free";
}

/** Public query: returns the user's plan limits and current usage counts. */
export const getUsageAndLimits = query({
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

    const plan = resolvePlan(user.category, subscription?.status, subscription?.plan);
    const limits = PLAN_LIMITS[plan];

    const domains = await ctx.db
      .query("domains")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    const mailboxes = await ctx.db
      .query("mailboxes")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let emailsSentThisMonth = 0;
    for (const mailbox of mailboxes) {
      const emails = await ctx.db
        .query("emails")
        .withIndex("by_mailbox_folder", (q) =>
          q.eq("mailboxId", mailbox._id).eq("folder", "sent")
        )
        .filter((q) => q.gte(q.field("date"), startOfMonth))
        .collect();
      emailsSentThisMonth += emails.length;
    }

    return {
      plan,
      limits: {
        domains: limits.domains,
        mailboxes: limits.mailboxes,
        emailsPerMonth: limits.emailsPerMonth,
      },
      usage: {
        domains: domains.length,
        mailboxes: mailboxes.length,
        emailsSentThisMonth,
      },
    };
  },
});

/** Count how many sent emails the user has sent in the current calendar month. */
export const countSentEmailsThisMonth = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<number> => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const mailboxes = await ctx.db
      .query("mailboxes")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    let count = 0;
    for (const mailbox of mailboxes) {
      const emails = await ctx.db
        .query("emails")
        .withIndex("by_mailbox_folder", (q) =>
          q.eq("mailboxId", mailbox._id).eq("folder", "sent")
        )
        .filter((q) => q.gte(q.field("date"), startOfMonth))
        .collect();
      count += emails.length;
    }
    return count;
  },
});
