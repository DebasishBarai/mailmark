import { internalQuery, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { readMailboxStats } from "./lib/counters";
import { periodStartDayKey } from "./lib/period";
import { v } from "convex/values";

// null = unlimited
//
// recipients is a stock cap on the size of a user's audience: how many distinct
// addresses they have ever mailed, counted in the recipients table. It is not a
// monthly flow like emailsPerMonth, and it is deliberately not a cap on the
// contacts table. Production settled which of the two is the real measure: an
// account that had mailed thousands of people held 18 contacts, because
// contacts is reply derived and CSV merges and sequence enrollments never
// touch it.
//
// Nothing enforces this yet. The send paths still send past the cap and nothing
// is ever deleted. The number and the per user count exist so usage can be
// measured before any gate is turned on.
export const PLAN_LIMITS = {
  // Old: no recipients key, then briefly a contacts key with these same
  // numbers, which measured the address book rather than the audience.
  free:     { domains: 1,    mailboxes: 3,    emailsPerMonth: 1_000,   recipients: 500 },
  starter:  { domains: 1,    mailboxes: 3,    emailsPerMonth: 1_000,   recipients: 500 },
  pro:      { domains: 5,    mailboxes: null, emailsPerMonth: 25_000,  recipients: 10_000 },
  business: { domains: null, mailboxes: null, emailsPerMonth: 100_000, recipients: 50_000 },
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

/** Count a user's sent mail in the subscription period in progress.
 *
 *  One document per mailbox, and no email rows at all.
 *
 *  This used to count by reading the rows. It walked by_mailbox_folder, which
 *  pins only mailboxId and folder, and then narrowed the result with
 *  .filter((q) => q.gte(q.field("date"), startOfMonth)). A Convex .filter() is
 *  applied after rows have been read out of the index, so counting one window
 *  meant reading every sent message the mailbox had ever held. The bytes read
 *  grew with the age of the account and nothing capped them, so a long-lived
 *  sender crossed the 16 MiB per transaction limit and this began throwing
 *  "Too many bytes read in a single function execution", with the slower
 *  variant of the same read dying as "too many system operations" instead.
 *  Production logged 18.01 MB read on the last failure before this changed.
 *
 *  Every send path calls this before sending, so that throw refused every
 *  message on the account, including a campaign of one, and the same read
 *  shape in getUsageAndLimits took out the billing, domains and audience pages
 *  that render usage.
 *
 *  Putting the date into the index range would have bounded the scan to the
 *  window rather than the lifetime, but it would still have been unbounded
 *  work whose whole output is a single integer, and a big enough period would
 *  have walked into the same wall. So the count is kept where every other
 *  count in this codebase is kept: denormalised in mailboxStats, bumped by the
 *  email write wrappers in lib/counters, and rebuilt nightly by
 *  platformStats.startEntityStatsRebuild so drift cannot compound.
 */
async function countSentEmailsThisPeriodFor(
  ctx: QueryCtx,
  userId: Id<"users">,
  subscription: Doc<"subscriptions"> | null,
): Promise<number> {
  const since = periodStartDayKey(subscription?.startedAt, Date.now());

  const mailboxes = await ctx.db
    .query("mailboxes")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect();

  let count = 0;
  for (const mailbox of mailboxes) {
    const stats = await readMailboxStats(ctx, mailbox._id);
    // Day keys are zero padded, so lexical order is chronological order.
    for (const [day, sent] of Object.entries(stats.sentByDay)) {
      if (day >= since) count += sent;
    }
  }
  return count;
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

    // Old, and the reason the pages that call this stopped rendering with a
    // client-side exception: .withIndex("by_mailbox_folder") followed by
    // .filter() on date read every sent message in the mailbox, forever, to
    // count one window. It also measured the calendar month, which is not the
    // window the allowance actually runs over.
    //
    // const now = new Date();
    // const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    // let emailsSentThisMonth = 0;
    // for (const mailbox of mailboxes) {
    //   const emails = await ctx.db
    //     .query("emails")
    //     .withIndex("by_mailbox_folder", (q) =>
    //       q.eq("mailboxId", mailbox._id).eq("folder", "sent")
    //     )
    //     .filter((q) => q.gte(q.field("date"), startOfMonth))
    //     .collect();
    //   emailsSentThisMonth += emails.length;
    // }
    const emailsSentThisPeriod = await countSentEmailsThisPeriodFor(
      ctx,
      user._id,
      subscription
    );

    return {
      plan,
      limits: {
        domains: limits.domains,
        mailboxes: limits.mailboxes,
        emailsPerMonth: limits.emailsPerMonth,
        // Old: contacts: limits.contacts.
        recipients: limits.recipients,
      },
      usage: {
        domains: domains.length,
        mailboxes: mailboxes.length,
        // Old: emailsSentThisMonth, which named a calendar month the
        // allowance never ran on.
        emailsSentThisPeriod,
        periodStartedAt: periodStartDayKey(subscription?.startedAt, Date.now()),
        // Both read off denormalised counts rather than collecting the tables,
        // which keeps this query as cheap as it was. Each reads 0 for a user
        // its backfill has not reached yet.
        //
        // contacts has no plan limit any more. It is kept because it is a real
        // number about the account (people who have written in), just not the
        // one a plan is sized on.
        contacts: user.contactCount ?? 0,
        recipients: user.recipientCount ?? 0,
      },
    };
  },
});

/** Count how many sent emails the user has sent in the subscription period
 *  currently in progress.
 *
 *  Old name: countSentEmailsThisMonth, which described the calendar month the
 *  scan used to measure. The allowance has always been per subscription period.
 */
export const countSentEmailsThisPeriod = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<number> => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    return await countSentEmailsThisPeriodFor(ctx, userId, subscription);
  },
});
