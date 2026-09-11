import { internalQuery, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
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

/** Hard ceiling on how many email rows one usage scan will read.
 *
 *  A sent-email row is small (the body lives in S3; only a 100 character
 *  snippet is stored inline) but not free, so ten thousand of them sits
 *  comfortably inside the 16 MiB a Convex transaction may read while leaving
 *  room for the rest of the query.
 *
 *  It is below the pro and business monthly allowances, so an account sending
 *  more than this in one month stops being counted exactly and its monthly
 *  limit stops being enforced. That is the deliberate direction to fail in: a
 *  paying sender who sends more than we counted is a billing question, whereas
 *  the alternative is refusing their mail on a number we cannot read. Removing
 *  the ceiling means keeping a per-month counter in mailboxStats the way the
 *  all-time folder counts are already kept, rather than scanning at send time.
 */
const MAX_USAGE_SCAN_ROWS = 10_000;

/** Count a user's sent mail on or after `since`, reading a bounded number of rows.
 *
 *  Two separate bounds, and both of them matter.
 *
 *  The index range is the first. This used to walk by_mailbox_folder, which
 *  pins only mailboxId and folder, and then narrow the result with
 *  .filter((q) => q.gte(q.field("date"), startOfMonth)). A Convex .filter()
 *  is applied after rows have been read out of the index, so counting one
 *  month meant reading every sent message the mailbox had ever held. The bytes
 *  read grew with the age of the account and nothing capped them, so a
 *  long-lived sender eventually crossed the 16 MiB per transaction limit and
 *  this started throwing "Too many bytes read in a single function execution".
 *  Every send path calls this before sending, so that one throw took out all
 *  sending on the account, and the same read shape in getUsageAndLimits took
 *  out the dashboard, billing and domains pages that render usage.
 *  by_mailbox_folder_date carries date as its third component, so the range
 *  itself excludes everything before the window and the scan is proportional
 *  to the month rather than to the lifetime of the account.
 *
 *  The cap is the second. Callers only ever ask whether the user has reached
 *  an allowance, so there is no reason to read past it: .take() stops there
 *  and a `count >= limit` test is still exact at the boundary.
 */
async function countSentEmailsSince(
  ctx: QueryCtx,
  userId: Id<"users">,
  since: number,
  cap: number,
): Promise<number> {
  const ceiling = Math.max(0, Math.min(cap, MAX_USAGE_SCAN_ROWS));

  const mailboxes = await ctx.db
    .query("mailboxes")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect();

  let count = 0;
  for (const mailbox of mailboxes) {
    const remaining = ceiling - count;
    if (remaining <= 0) break;

    const rows = await ctx.db
      .query("emails")
      .withIndex("by_mailbox_folder_date", (q) =>
        q.eq("mailboxId", mailbox._id).eq("folder", "sent").gte("date", since)
      )
      .take(remaining);
    count += rows.length;
  }

  return count;
}

/** Midnight on the first of the current month, in the server's timezone. */
function startOfThisMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
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
    // count the current month.
    //
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
    const emailsSentThisMonth = await countSentEmailsSince(
      ctx,
      user._id,
      startOfThisMonth(),
      limits.emailsPerMonth,
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
        emailsSentThisMonth,
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

/** Count how many sent emails the user has sent in the current calendar month.
 *
 *  `cap` is the allowance the caller is about to compare against. Pass it: the
 *  count stops there, which is all a `count >= cap` test needs and keeps the
 *  read proportional to the plan rather than to the account's history. Callers
 *  that omit it get the largest allowance any plan grants.
 */
export const countSentEmailsThisMonth = internalQuery({
  args: { userId: v.id("users"), cap: v.optional(v.number()) },
  handler: async (ctx, { userId, cap }): Promise<number> => {
    // Old: collected mailboxes here and, for each, read the whole sent folder
    // through by_mailbox_folder with a .filter() on date. See
    // countSentEmailsSince for why that was unbounded.
    return await countSentEmailsSince(
      ctx,
      userId,
      startOfThisMonth(),
      cap ?? PLAN_LIMITS.business.emailsPerMonth,
    );
  },
});
