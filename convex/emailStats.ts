import { query } from "./_generated/server";
import { readMailboxStats } from "./lib/counters";

export const getForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;

    const mailboxes = await ctx.db
      .query("mailboxes")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    let totalSent = 0;
    let totalInbox = 0;
    let delivered = 0;
    let failed = 0;
    let bounced = 0;
    let pending = 0;
    let opened = 0;
    const dailyCounts: Record<string, { sent: number; received: number }> = {};

    // The totals below are all-time, which is what this query has always
    // reported. Producing them used to mean collecting every sent and every
    // inbox message across all of the user's mailboxes on each dashboard load
    // (unbounded, and heading for the 32,000 document scan cap). They now come
    // from the per-mailbox counters in mailboxStats: one document per mailbox.
    //
    // for (const mailbox of mailboxes) {
    //   const sentEmails = await ctx.db
    //     .query("emails")
    //     .withIndex("by_mailbox_folder", (q) =>
    //       q.eq("mailboxId", mailbox._id).eq("folder", "sent")
    //     )
    //     .collect();
    //   totalSent += sentEmails.length;
    //   for (const email of sentEmails) { ...tally delivery status and opens... }
    //   const inboxEmails = await ctx.db
    //     .query("emails")
    //     .withIndex("by_mailbox_folder", (q) =>
    //       q.eq("mailboxId", mailbox._id).eq("folder", "inbox")
    //     )
    //     .collect();
    //   totalInbox += inboxEmails.length;
    //   for (const email of inboxEmails) { ...bucket by day... }
    // }

    for (const mailbox of mailboxes) {
      const stats = await readMailboxStats(ctx, mailbox._id);
      totalSent += stats.byFolder["sent"] ?? 0;
      totalInbox += stats.byFolder["inbox"] ?? 0;
      delivered += stats.delivered;
      failed += stats.failed;
      bounced += stats.bounced;
      pending += stats.pending;
      opened += stats.opened;
    }

    // The chart only ever showed the last 30 days, but the old code built its
    // daily buckets from every message it had collected and then rendered 30 of
    // them. This reads exactly the window it draws, using the date component of
    // by_mailbox_folder_date.
    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - 29);
    windowStart.setHours(0, 0, 0, 0);
    const windowStartMs = windowStart.getTime();

    for (const mailbox of mailboxes) {
      for (const folder of ["sent", "inbox"] as const) {
        const recent = await ctx.db
          .query("emails")
          .withIndex("by_mailbox_folder_date", (q) =>
            q
              .eq("mailboxId", mailbox._id)
              .eq("folder", folder)
              .gte("date", windowStartMs)
          )
          .collect();

        for (const email of recent) {
          const dateKey = new Date(email.date).toISOString().slice(0, 10);
          if (!dailyCounts[dateKey]) {
            dailyCounts[dateKey] = { sent: 0, received: 0 };
          }
          if (folder === "sent") dailyCounts[dateKey].sent++;
          else dailyCounts[dateKey].received++;
        }
      }
    }

    const last30Days: { date: string; label: string; sent: number; received: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      last30Days.push({
        date: key,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        sent: dailyCounts[key]?.sent ?? 0,
        received: dailyCounts[key]?.received ?? 0,
      });
    }

    return {
      totalSent,
      totalInbox,
      delivered,
      failed,
      bounced,
      pending,
      opened,
      openRate: totalSent > 0 ? Math.round((opened / totalSent) * 100) : 0,
      deliveryRate: totalSent > 0 ? Math.round((delivered / totalSent) * 100) : 0,
      dailyVolume: last30Days,
    };
  },
});
