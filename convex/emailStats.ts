import { query } from "./_generated/server";

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

    for (const mailbox of mailboxes) {
      const sentEmails = await ctx.db
        .query("emails")
        .withIndex("by_mailbox_folder", (q) =>
          q.eq("mailboxId", mailbox._id).eq("folder", "sent")
        )
        .collect();

      totalSent += sentEmails.length;

      for (const email of sentEmails) {
        if (email.deliveryStatus === "delivered") delivered++;
        else if (email.deliveryStatus === "failed") failed++;
        else if (email.deliveryStatus === "bounced") bounced++;
        else pending++;

        if (email.openedAt) opened++;

        const dateKey = new Date(email.date).toISOString().slice(0, 10);
        if (!dailyCounts[dateKey]) dailyCounts[dateKey] = { sent: 0, received: 0 };
        dailyCounts[dateKey].sent++;
      }

      const inboxEmails = await ctx.db
        .query("emails")
        .withIndex("by_mailbox_folder", (q) =>
          q.eq("mailboxId", mailbox._id).eq("folder", "inbox")
        )
        .collect();

      totalInbox += inboxEmails.length;

      for (const email of inboxEmails) {
        const dateKey = new Date(email.date).toISOString().slice(0, 10);
        if (!dailyCounts[dateKey]) dailyCounts[dateKey] = { sent: 0, received: 0 };
        dailyCounts[dateKey].received++;
      }
    }

    const now = new Date();
    const last30Days = [];
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
