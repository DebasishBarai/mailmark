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

      // The chart's buckets come off the same document. Every day the row
      // carries is folded in and the render below picks the thirty it draws,
      // so there is no window to apply here.
      for (const [day, tally] of Object.entries(stats.byDay)) {
        if (!dailyCounts[day]) dailyCounts[day] = { sent: 0, received: 0 };
        dailyCounts[day].sent += tally.sent;
        dailyCounts[day].received += tally.received;
      }
    }

    // The chart only ever showed the last 30 days. It used to build its buckets
    // by collecting every sent and every inbox message in that window, for
    // every mailbox, on each dashboard load. That is bounded by time but not by
    // volume, so a sender whose output was climbing would eventually read past
    // the 16 MiB a Convex transaction may read and the page would stop
    // rendering, which is exactly how quotas failed. The counts now come off
    // mailboxStats.byDay, folded in above.
    //
    // const now = new Date();
    // const windowStart = new Date(now);
    // windowStart.setDate(windowStart.getDate() - 29);
    // windowStart.setHours(0, 0, 0, 0);
    // const windowStartMs = windowStart.getTime();
    //
    // for (const mailbox of mailboxes) {
    //   for (const folder of ["sent", "inbox"] as const) {
    //     const recent = await ctx.db
    //       .query("emails")
    //       .withIndex("by_mailbox_folder_date", (q) =>
    //         q.eq("mailboxId", mailbox._id).eq("folder", folder).gte("date", windowStartMs)
    //       )
    //       .collect();
    //     for (const email of recent) { ...bucket by day... }
    //   }
    // }
    const now = new Date();

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
