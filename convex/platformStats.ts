import { internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  ALL_KEYS,
  K,
  type MailboxTally,
  applyEmailToTally,
  emptyMailboxTally,
  folderRows,
  sourceRows,
  readDomainStats,
  readMailboxStats,
  apiKeyBuckets,
  contactBuckets,
  domainBuckets,
  emailBuckets,
  mailboxBuckets,
  platformAccountBuckets,
  readCounters,
  sequenceBuckets,
  setCounters,
  subscriptionBuckets,
  type WriteCtx,
  userBuckets,
  warmupEmailBuckets,
  warmupMailboxBuckets,
} from "./lib/counters";

// Both queries below used to derive every number by .collect()ing whole tables
// and calling .length. That reads every document in full purely to count it,
// which put getAdminStats over Convex's 16 MiB per-transaction read cap and
// getStats near the 32,000 document scan cap. Crossing either makes the query
// throw, and the caps are the same on every plan.
//
// They now read integers maintained by convex/lib/counters.ts.
// app/components/PlatformStats.tsx reads getStats, whose shape is unchanged.
// getAdminStats has since grown the per-folder email counts that let
// app/(protected)/admin/page.tsx account for every row in the total.

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    // Old: three unbounded reads per call, on a public page whose useQuery
    // re-ran for every visitor on every email insert. The domains read also
    // used .filter() rather than .withIndex(), so unverified rows were scanned
    // and discarded, and there is no index on `verified` to use instead.
    //
    // const emails = await ctx.db.query("emails").collect();
    // const domains = await ctx.db
    //   .query("domains")
    //   .filter((q) => q.eq(q.field("verified"), true))
    //   .collect();
    // const mailboxes = await ctx.db.query("mailboxes").collect();
    //
    // return {
    //   totalEmails: emails.length,
    //   totalDomains: domains.length,
    //   totalMailboxes: mailboxes.length,
    // };

    const c = await readCounters(ctx, [
      K.emailsTotal,
      K.domainsVerified,
      K.mailboxesTotal,
    ]);

    return {
      totalEmails: c[K.emailsTotal],
      totalDomains: c[K.domainsVerified],
      totalMailboxes: c[K.mailboxesTotal],
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

    // Old: eleven full-table .collect() calls sharing one 16 MiB budget. The
    // expensive ones were sequences (steps[] holds full HTML email bodies
    // inline), emails and warmupEmails (highest row counts, and warmupEmails
    // grows forever from the half-hourly cron), and mailboxes (signature is
    // arbitrary user HTML). platformWarmupAccounts also pulled every plaintext
    // Gmail app password into the transaction just to count active accounts.
    //
    // const [ users, domains, mailboxes, emails, subscriptions,
    //   warmupMailboxes, warmupEmails, platformAccounts, sequences, contacts,
    //   apiKeys ] = await Promise.all([
    //   ctx.db.query("users").collect(),
    //   ctx.db.query("domains").collect(),
    //   ctx.db.query("mailboxes").collect(),
    //   ctx.db.query("emails").collect(),
    //   ctx.db.query("subscriptions").collect(),
    //   ctx.db.query("warmupMailboxes").collect(),
    //   ctx.db.query("warmupEmails").collect(),
    //   ctx.db.query("platformWarmupAccounts").collect(),
    //   ctx.db.query("sequences").collect(),
    //   ctx.db.query("contacts").collect(),
    //   ctx.db.query("api_keys").collect(),
    // ]);

    const c = await readCounters(ctx, ALL_KEYS);

    // Recent users (last 7 days). This one stays a live read rather than a
    // counter: it needs the rows themselves, not a count. Every Convex table
    // has a built-in by_creation_time index, so this is a bounded range read
    // of at most 10 documents. Old code sorted the entire users array in
    // memory and sliced it.
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentUserDocs = await ctx.db
      .query("users")
      .withIndex("by_creation_time", (q) => q.gt("_creationTime", sevenDaysAgo))
      .order("desc")
      .take(10);

    const recentUsers = recentUserDocs.map((u) => ({
      email: u.email,
      name: u.name,
      category: u.category,
      createdAt: u._creationTime,
    }));

    const warmupEmailsSent = c[K.warmupEmailsOutbound];
    const warmupEmailsInbox = c[K.warmupEmailsPlacementInbox];

    const activeSubscriptions =
      c[K.subsStarter] + c[K.subsPro] + c[K.subsBusiness];

    return {
      users: {
        total: c[K.usersTotal],
        admin: c[K.usersAdmin],
        beta: c[K.usersBeta],
        normal: c[K.usersNormal],
        recentSignups: recentUsers,
      },
      emails: {
        total: c[K.emailsTotal],
        // The folder counts partition the table, so the dashboard can show
        // where every stored row lives: total = sent + inbox + outbox + trash
        // + warmup.
        sent: c[K.emailsFolderSent],
        inbox: c[K.emailsFolderInbox],
        outbox: c[K.emailsFolderOutbox],
        trash: c[K.emailsFolderTrash],
        warmup: c[K.emailsFolderWarmup],
        delivered: c[K.emailsDelivered],
        bounced: c[K.emailsBounced],
        failed: c[K.emailsFailed],
        opened: c[K.emailsOpened],
      },
      domains: {
        total: c[K.domainsTotal],
        verified: c[K.domainsVerified],
        unverified: c[K.domainsTotal] - c[K.domainsVerified],
      },
      mailboxes: {
        total: c[K.mailboxesTotal],
      },
      subscriptions: {
        total: activeSubscriptions,
        byPlan: {
          starter: c[K.subsStarter],
          pro: c[K.subsPro],
          business: c[K.subsBusiness],
        },
      },
      warmup: {
        activeMailboxes: c[K.warmupMailboxesActive],
        totalMailboxes: c[K.warmupMailboxesTotal],
        emailsSent: warmupEmailsSent,
        inboxPlacement:
          warmupEmailsSent > 0
            ? Math.round((warmupEmailsInbox / warmupEmailsSent) * 100)
            : 0,
        platformAccounts: c[K.platformAccountsActive],
        totalPlatformAccounts: c[K.platformAccountsTotal],
      },
      sequences: {
        total: c[K.sequencesTotal],
        active: c[K.sequencesActive],
      },
      contacts: {
        total: c[K.contactsTotal],
      },
      apiKeys: {
        active: c[K.apiKeysActive],
        total: c[K.apiKeysTotal],
      },
    };
  },
});

// ── Counter reconcile ──
//
// Recomputes every counter from the underlying tables. This is both the
// initial backfill (existing rows predate the counter hooks and were never
// counted) and the ongoing safety net: it repairs drift from a mutation that
// forgets to call into lib/counters.ts, from a row edited by hand in the
// Convex dashboard (users.category is only ever set to "normal" in code, so
// promoting an admin is a dashboard edit no hook can see), and from the
// backfill's own races.
//
// It cannot .collect() the tables it counts, since that is the limit this
// whole change exists to avoid, so it pages through them one transaction at a
// time and keeps its position in platformCounterState.

const RECONCILE_TABLES = [
  // Page sizes are per-table because rows differ wildly in size. Each page is
  // its own transaction, so these only need to keep one page well under
  // 16 MiB: sequences carry whole HTML bodies in steps[], mailboxes carry
  // arbitrary HTML signatures.
  { table: "users", pageSize: 500 },
  { table: "domains", pageSize: 200 },
  { table: "mailboxes", pageSize: 200 },
  { table: "emails", pageSize: 300 },
  { table: "subscriptions", pageSize: 500 },
  { table: "warmupMailboxes", pageSize: 500 },
  { table: "warmupEmails", pageSize: 500 },
  { table: "platformWarmupAccounts", pageSize: 500 },
  { table: "sequences", pageSize: 25 },
  { table: "contacts", pageSize: 500 },
  { table: "api_keys", pageSize: 500 },
] as const;

type CountedTable = (typeof RECONCILE_TABLES)[number]["table"];

// The cast in each branch is safe: `doc` came from `ctx.db.query(table)` for
// this same `table`, so it is that table's document type. TypeScript cannot
// follow that correspondence through a union on its own.
function bucketsOf(table: CountedTable, doc: Doc<CountedTable>): string[] {
  switch (table) {
    case "users":
      return userBuckets(doc as Doc<"users">);
    case "domains":
      return domainBuckets(doc as Doc<"domains">);
    case "mailboxes":
      return mailboxBuckets();
    case "emails":
      return emailBuckets(doc as Doc<"emails">);
    case "subscriptions":
      return subscriptionBuckets(doc as Doc<"subscriptions">);
    case "warmupMailboxes":
      return warmupMailboxBuckets(doc as Doc<"warmupMailboxes">);
    case "warmupEmails":
      return warmupEmailBuckets(doc as Doc<"warmupEmails">);
    case "platformWarmupAccounts":
      return platformAccountBuckets(doc as Doc<"platformWarmupAccounts">);
    case "sequences":
      return sequenceBuckets(doc as Doc<"sequences">);
    case "contacts":
      return contactBuckets();
    case "api_keys":
      return apiKeyBuckets(doc as Doc<"api_keys">);
  }
}

const STATE_NAME = "reconcile";

export const startCounterReconcile = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const runId = `${now}-${Math.random().toString(36).slice(2, 10)}`;

    // Snapshot the counters as they stand. Live hooks keep bumping them while
    // the walk runs; at the end the difference between then and now is added
    // back to the freshly counted tally, so rows created (or changed) during
    // the walk are not lost. See finishReconcile.
    const snapshot = await readCounters(ctx, ALL_KEYS);
    const tally: Record<string, number> = {};
    for (const key of ALL_KEYS) tally[key] = 0;

    const existing = await ctx.db
      .query("platformCounterState")
      .withIndex("by_name", (q) => q.eq("name", STATE_NAME))
      .unique();

    const fields = {
      name: STATE_NAME,
      runId,
      // Rows created at or after t0 are skipped by the walk and left entirely
      // to the live hooks, so no row is counted by both.
      t0: now,
      tableIndex: 0,
      cursor: undefined,
      tally,
      snapshot,
      pages: 0,
      startedAt: now,
      finishedAt: undefined,
      lastError: undefined,
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("platformCounterState", fields);
    }

    await ctx.scheduler.runAfter(
      0,
      internal.platformStats.reconcileCountersStep,
      { runId }
    );

    return { runId };
  },
});

export const reconcileCountersStep = internalMutation({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const state = await ctx.db
      .query("platformCounterState")
      .withIndex("by_name", (q) => q.eq("name", STATE_NAME))
      .unique();

    // A newer run has taken over (the nightly cron fired while a manual
    // recount was walking, say). Stop rather than tally into its state.
    if (!state || state.runId !== runId) return;
    if (state.finishedAt !== undefined) return;

    const entry = RECONCILE_TABLES[state.tableIndex];
    if (!entry) {
      await finishReconcile(ctx, state);
      return;
    }

    const result = await ctx.db
      .query(entry.table)
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", state.t0))
      .paginate({ cursor: state.cursor ?? null, numItems: entry.pageSize });

    const tally: Record<string, number> = { ...(state.tally ?? {}) };
    for (const doc of result.page) {
      for (const key of bucketsOf(entry.table, doc)) {
        tally[key] = (tally[key] ?? 0) + 1;
      }
    }

    const advanceTable = result.isDone;
    await ctx.db.patch(state._id, {
      tally,
      pages: state.pages + 1,
      tableIndex: advanceTable ? state.tableIndex + 1 : state.tableIndex,
      cursor: advanceTable ? undefined : result.continueCursor,
    });

    const moreTables = advanceTable
      ? state.tableIndex + 1 < RECONCILE_TABLES.length
      : true;

    if (moreTables) {
      await ctx.scheduler.runAfter(
        0,
        internal.platformStats.reconcileCountersStep,
        { runId }
      );
    } else {
      const finished = await ctx.db.get(state._id);
      if (finished) await finishReconcile(ctx, finished);
    }
  },
});

async function finishReconcile(
  ctx: WriteCtx,
  state: Doc<"platformCounterState">
) {
  // tally counts every row created before t0. Anything the live hooks did
  // since t0 shows up as the drift between the counters now and the snapshot
  // taken at t0, so adding it back keeps concurrent inserts and deletes.
  //
  // The residual error is a mutation to a *pre-t0* row that lands after the
  // walk passed that row's position: it is counted in both terms. That window
  // is why the cron runs at a quiet hour. It does not accumulate, since every
  // run recounts the tables from scratch rather than adjusting the previous
  // run's answer.
  const current = await readCounters(ctx, ALL_KEYS);
  const snapshot: Record<string, number> = state.snapshot ?? {};
  const tally: Record<string, number> = state.tally ?? {};

  const values: Record<string, number> = {};
  for (const key of ALL_KEYS) {
    const liveDelta = (current[key] ?? 0) - (snapshot[key] ?? 0);
    values[key] = Math.max(0, (tally[key] ?? 0) + liveDelta);
  }

  await setCounters(ctx, values);
  await ctx.db.patch(state._id, { finishedAt: Date.now() });
}

/** Progress of the current or last counter reconcile, for the admin panel. */
export const counterReconcileStatus = internalQuery({
  args: {},
  handler: async (ctx) => {
    const state = await ctx.db
      .query("platformCounterState")
      .withIndex("by_name", (q) => q.eq("name", STATE_NAME))
      .unique();
    if (!state) return null;
    return {
      runId: state.runId,
      startedAt: state.startedAt,
      finishedAt: state.finishedAt,
      pages: state.pages,
      table:
        RECONCILE_TABLES[state.tableIndex]?.table ??
        (state.finishedAt ? "done" : "finishing"),
      lastError: state.lastError,
    };
  },
});


// ── Per-entity stats rebuild ──
//
// The same job as startCounterReconcile, for the mailboxStats and domainStats
// rows. It is both the initial backfill (rows written before these counters
// existed were never counted) and the nightly drift repair.
//
// The walk is per entity rather than one pass over the whole emails table:
// each mailbox's rebuild is self-contained, so the accumulator stays a handful
// of integers instead of a per-mailbox map for the entire platform, and a
// single mailbox can be repaired on its own when something looks wrong.

const MAILBOX_PAGE = 200;
const MAILBOX_EMAIL_PAGE = 500;
const DOMAIN_PAGE = 200;
const DOMAIN_UNSUB_PAGE = 500;

/** Kick off a rebuild of every mailboxStats and domainStats row. */
export const startEntityStatsRebuild = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query("mailboxes")
      .paginate({ cursor: cursor ?? null, numItems: MAILBOX_PAGE });

    for (const mailbox of page.page) {
      await ctx.scheduler.runAfter(
        0,
        internal.platformStats.rebuildMailboxStats,
        { mailboxId: mailbox._id }
      );
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.platformStats.startEntityStatsRebuild,
        { cursor: page.continueCursor }
      );
    } else {
      // Mailboxes are done being scheduled; move on to the domain rows.
      await ctx.scheduler.runAfter(
        0,
        internal.platformStats.startDomainStatsRebuild,
        {}
      );
    }
  },
});

export const rebuildMailboxStats = internalMutation({
  args: {
    mailboxId: v.id("mailboxes"),
    t0: v.optional(v.number()),
    cursor: v.optional(v.string()),
    tally: v.optional(v.any()),
    snapshot: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const mailbox = await ctx.db.get(args.mailboxId);
    // Mailbox deleted mid-rebuild: its stats row went with it.
    if (!mailbox) return;

    // First step of this mailbox's walk: fix the cutoff and remember where the
    // counters stood, so live writes during the walk can be added back at the
    // end rather than lost. Same scheme as finishReconcile above.
    const t0 = args.t0 ?? Date.now();
    const snapshot: MailboxTally =
      args.snapshot ?? (await readMailboxStats(ctx, args.mailboxId));
    const tally: MailboxTally = args.tally ?? emptyMailboxTally();

    const page = await ctx.db
      .query("emails")
      .withIndex("by_mailbox_folder", (q) => q.eq("mailboxId", args.mailboxId))
      .paginate({ cursor: args.cursor ?? null, numItems: MAILBOX_EMAIL_PAGE });

    for (const email of page.page) {
      // Rows created at or after the cutoff are the live hooks' to count.
      if (email._creationTime >= t0) continue;
      applyEmailToTally(tally, email, 1);
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.platformStats.rebuildMailboxStats,
        {
          mailboxId: args.mailboxId,
          t0,
          cursor: page.continueCursor,
          tally,
          snapshot,
        }
      );
      return;
    }

    const current = await readMailboxStats(ctx, args.mailboxId);

    const folders = new Set([
      ...Object.keys(tally.byFolder),
      ...Object.keys(current.byFolder),
      ...Object.keys(snapshot.byFolder),
    ]);
    const byFolder: Record<string, number> = {};
    for (const folder of folders) {
      const live =
        (current.byFolder[folder] ?? 0) - (snapshot.byFolder[folder] ?? 0);
      const value = (tally.byFolder[folder] ?? 0) + live;
      if (value > 0) byFolder[folder] = value;
    }

    const merge = (key: Exclude<keyof MailboxTally, "byFolder">) =>
      Math.max(0, tally[key] + (current[key] - snapshot[key]));

    const row = await ctx.db
      .query("mailboxStats")
      .withIndex("by_mailbox", (q) => q.eq("mailboxId", args.mailboxId))
      .first();

    const values = {
      mailboxId: args.mailboxId,
      byFolder: folderRows(byFolder),
      unread: merge("unread"),
      delivered: merge("delivered"),
      failed: merge("failed"),
      bounced: merge("bounced"),
      pending: merge("pending"),
      opened: merge("opened"),
    };

    if (row) await ctx.db.patch(row._id, values);
    else await ctx.db.insert("mailboxStats", values);
  },
});

export const startDomainStatsRebuild = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query("domains")
      .paginate({ cursor: cursor ?? null, numItems: DOMAIN_PAGE });

    for (const domain of page.page) {
      await ctx.scheduler.runAfter(
        0,
        internal.platformStats.rebuildDomainStats,
        { domainId: domain._id }
      );
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.platformStats.startDomainStatsRebuild,
        { cursor: page.continueCursor }
      );
    }
  },
});

export const rebuildDomainStats = internalMutation({
  args: {
    domainId: v.id("domains"),
    t0: v.optional(v.number()),
    cursor: v.optional(v.string()),
    total: v.optional(v.number()),
    bySource: v.optional(v.any()),
    snapshot: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const domain = await ctx.db.get(args.domainId);
    if (!domain) return;

    const t0 = args.t0 ?? Date.now();
    const snapshot: { total: number; bySource: Record<string, number> } =
      args.snapshot ?? (await readDomainStats(ctx, args.domainId));

    let total = args.total ?? 0;
    const bySource: Record<string, number> = { ...(args.bySource ?? {}) };

    const page = await ctx.db
      .query("unsubscribes")
      .withIndex("by_domain_id", (q) => q.eq("domainId", args.domainId))
      .paginate({ cursor: args.cursor ?? null, numItems: DOMAIN_UNSUB_PAGE });

    for (const unsub of page.page) {
      if (unsub._creationTime >= t0) continue;
      total++;
      bySource[unsub.source] = (bySource[unsub.source] ?? 0) + 1;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.platformStats.rebuildDomainStats,
        {
          domainId: args.domainId,
          t0,
          cursor: page.continueCursor,
          total,
          bySource,
          snapshot,
        }
      );
      return;
    }

    const current = await readDomainStats(ctx, args.domainId);

    const sources = new Set([
      ...Object.keys(bySource),
      ...Object.keys(current.bySource),
      ...Object.keys(snapshot.bySource),
    ]);
    const mergedBySource: Record<string, number> = {};
    for (const source of sources) {
      const live =
        (current.bySource[source] ?? 0) - (snapshot.bySource[source] ?? 0);
      const value = (bySource[source] ?? 0) + live;
      if (value > 0) mergedBySource[source] = value;
    }

    const row = await ctx.db
      .query("domainStats")
      .withIndex("by_domain", (q) => q.eq("domainId", args.domainId))
      .first();

    const values = {
      domainId: args.domainId,
      unsubscribesTotal: Math.max(0, total + (current.total - snapshot.total)),
      unsubscribesBySource: sourceRows(mergedBySource),
    };

    if (row) await ctx.db.patch(row._id, values);
    else await ctx.db.insert("domainStats", values);
  },
});
