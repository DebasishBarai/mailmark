import { internalQuery } from "./_generated/server";
import { v } from "convex/values";

// null = unlimited
export const PLAN_LIMITS = {
  free:     { domains: 1,    mailboxes: 3,    emailsPerMonth: 1_000 },
  starter:  { domains: 1,    mailboxes: 3,    emailsPerMonth: 1_000 },
  pro:      { domains: 5,    mailboxes: null, emailsPerMonth: 25_000 },
  business: { domains: null, mailboxes: null, emailsPerMonth: 100_000 },
} as const;

export type PlanLimits = typeof PLAN_LIMITS[keyof typeof PLAN_LIMITS];

/** Returns the limits for the user's current effective plan.
 *  Users with no active subscription get starter (free trial) limits. */
export const getUserLimits = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<PlanLimits> => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    const plan =
      subscription?.status === "active" ? subscription.plan : "free";

    return PLAN_LIMITS[plan];
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
