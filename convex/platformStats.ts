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

export const getAdminStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser || currentUser.category !== "admin") return null;

    const [
      users,
      domains,
      mailboxes,
      emails,
      subscriptions,
      warmupMailboxes,
      warmupEmails,
      platformAccounts,
      sequences,
      contacts,
      apiKeys,
    ] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("domains").collect(),
      ctx.db.query("mailboxes").collect(),
      ctx.db.query("emails").collect(),
      ctx.db.query("subscriptions").collect(),
      ctx.db.query("warmupMailboxes").collect(),
      ctx.db.query("warmupEmails").collect(),
      ctx.db.query("platformWarmupAccounts").collect(),
      ctx.db.query("sequences").collect(),
      ctx.db.query("contacts").collect(),
      ctx.db.query("api_keys").collect(),
    ]);

    // Users breakdown
    const totalUsers = users.length;
    const adminUsers = users.filter((u) => u.category === "admin").length;
    const betaUsers = users.filter((u) => u.category === "beta").length;
    const normalUsers = users.filter((u) => u.category === "normal").length;

    // Emails breakdown
    //
    // Delivery and open counts are the numerators of rates whose denominator is
    // the sent count, so they have to come from the same set of rows. Scoping
    // them to the sent folder keeps that true: a sent row the user later trashed
    // would otherwise stay in the numerator after leaving the denominator, and
    // the rate would drift above what was actually sent.
    const sent = emails.filter((e) => e.folder === "sent");
    const sentEmails = sent.length;
    const inboxEmails = emails.filter((e) => e.folder === "inbox").length;
    const deliveredEmails = sent.filter((e) => e.deliveryStatus === "delivered").length;
    const bouncedEmails = sent.filter((e) => e.deliveryStatus === "bounced").length;
    const failedEmails = sent.filter((e) => e.deliveryStatus === "failed").length;
    const openedEmails = sent.filter((e) => e.openedAt != null).length;
    // const deliveredEmails = emails.filter((e) => e.deliveryStatus === "delivered").length;
    // const bouncedEmails = emails.filter((e) => e.deliveryStatus === "bounced").length;
    // const failedEmails = emails.filter((e) => e.deliveryStatus === "failed").length;
    // const openedEmails = emails.filter((e) => e.openedAt != null).length;

    // Every folder present in the table, so "Total Stored" reconciles against
    // sent + received. The rest is mostly inbound warmup mail, which the ingest
    // webhook parks in "_warmup" instead of the inbox, plus outbox and trash.
    // "drafts" is counted here too whenever a row carries it, though nothing
    // writes that folder today: the mailbox Drafts tab is UI only.
    const folderCounts = new Map<string, number>();
    for (const email of emails) {
      folderCounts.set(email.folder, (folderCounts.get(email.folder) ?? 0) + 1);
    }
    const emailsByFolder = [...folderCounts.entries()]
      .map(([folder, count]) => ({ folder, count }))
      .sort((a, b) => b.count - a.count);

    // Domains breakdown
    const verifiedDomains = domains.filter((d) => d.verified).length;
    const unverifiedDomains = domains.length - verifiedDomains;

    // Subscriptions breakdown
    const activeSubscriptions = subscriptions.filter((s) => s.status === "active" || s.status === "trialing");
    const subsByPlan = {
      starter: activeSubscriptions.filter((s) => s.plan === "starter").length,
      pro: activeSubscriptions.filter((s) => s.plan === "pro").length,
      business: activeSubscriptions.filter((s) => s.plan === "business").length,
    };

    // Warmup
    const activeWarmupMailboxes = warmupMailboxes.filter((w) => w.status === "active").length;
    const warmupEmailsSent = warmupEmails.filter((e) => e.direction === "outbound").length;
    const warmupEmailsInbox = warmupEmails.filter((e) => e.placement === "inbox").length;
    const activePlatformAccounts = platformAccounts.filter((a) => a.status === "active").length;

    // Sequences
    const activeSequences = sequences.filter((s) => s.status === "active").length;

    // Active API keys (not revoked)
    const activeApiKeys = apiKeys.filter((k) => !k.revokedAt).length;

    // Recent users (last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentUsers = users
      .filter((u) => u._creationTime > sevenDaysAgo)
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 10)
      .map((u) => ({
        email: u.email,
        name: u.name,
        category: u.category,
        createdAt: u._creationTime,
      }));

    return {
      users: {
        total: totalUsers,
        admin: adminUsers,
        beta: betaUsers,
        normal: normalUsers,
        recentSignups: recentUsers,
      },
      emails: {
        total: emails.length,
        sent: sentEmails,
        inbox: inboxEmails,
        byFolder: emailsByFolder,
        delivered: deliveredEmails,
        bounced: bouncedEmails,
        failed: failedEmails,
        opened: openedEmails,
      },
      domains: {
        total: domains.length,
        verified: verifiedDomains,
        unverified: unverifiedDomains,
      },
      mailboxes: {
        total: mailboxes.length,
      },
      subscriptions: {
        total: activeSubscriptions.length,
        byPlan: subsByPlan,
      },
      warmup: {
        activeMailboxes: activeWarmupMailboxes,
        totalMailboxes: warmupMailboxes.length,
        emailsSent: warmupEmailsSent,
        inboxPlacement: warmupEmailsSent > 0
          ? Math.round((warmupEmailsInbox / warmupEmailsSent) * 100)
          : 0,
        platformAccounts: activePlatformAccounts,
        totalPlatformAccounts: platformAccounts.length,
      },
      sequences: {
        total: sequences.length,
        active: activeSequences,
      },
      contacts: {
        total: contacts.length,
      },
      apiKeys: {
        active: activeApiKeys,
        total: apiKeys.length,
      },
    };
  },
});
