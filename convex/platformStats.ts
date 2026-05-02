import { query } from "./_generated/server";

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const emails = await ctx.db.query("emails").collect();
    const domains = await ctx.db
      .query("domains")
      .filter((q) => q.eq(q.field("verified"), true))
      .collect();
    const mailboxes = await ctx.db.query("mailboxes").collect();

    return {
      totalEmails: emails.length,
      totalDomains: domains.length,
      totalMailboxes: mailboxes.length,
    };
  },
});
