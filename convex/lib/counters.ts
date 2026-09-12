import type { WithoutSystemFields } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { dayKeyOf } from "./period";

/**
 * Denormalized platform counters.
 *
 * Every number on the landing page and the admin dashboard used to be produced
 * by reading a whole table and calling .length on it. That is O(table)
 * documents scanned and O(table) bytes read per query call, against per
 * transaction caps of 32,000 documents and 16 MiB that apply on every Convex
 * plan. Instead each counted fact is maintained here as an integer, bumped by
 * the mutations that change it.
 *
 * The model is deliberately dumb: a document maps to a set of *bucket keys* it
 * currently contributes to, and any change is expressed as the difference
 * between the buckets before and the buckets after. Inserts diff [] -> after,
 * deletes diff before -> [], patches diff before -> after. Nothing has to
 * reason about which particular field moved, so a patch that changes two
 * counted fields at once (markAsOpened can set openedAt *and* upgrade
 * deliveryStatus in one write) is handled without special cases.
 *
 * Counters drift if a new mutation forgets to call in here. That is expected
 * and tolerated: platformStats.startCounterReconcile recomputes every key from
 * the tables nightly, and because it recounts from scratch rather than
 * adjusting, drift never compounds.
 */

// ── Keys ──

export const K = {
  usersTotal: "users.total",
  usersAdmin: "users.admin",
  usersBeta: "users.beta",
  usersNormal: "users.normal",

  emailsTotal: "emails.total",
  // One key per folder the app writes, so emails.total can be shown on the
  // admin dashboard as a sum of its parts. Sent and inbox are only two of the
  // five: scheduled mail waits in outbox, deleted mail stays in trash, and
  // inbound warmup pool mail is filed under _warmup by http.ts so it never
  // reaches the customer's inbox. Those three were in the total and named
  // nowhere, which is most of what the dashboard could not account for.
  emailsFolderSent: "emails.folder.sent",
  emailsFolderInbox: "emails.folder.inbox",
  emailsFolderOutbox: "emails.folder.outbox",
  emailsFolderTrash: "emails.folder.trash",
  emailsFolderWarmup: "emails.folder.warmup",
  emailsDelivered: "emails.delivered",
  emailsBounced: "emails.bounced",
  emailsFailed: "emails.failed",
  // Complaints used to be dropped before they reached the database, so there
  // was nothing to count. Blocked messages are new: a send the gate refused,
  // kept as a row rather than deleted.
  emailsComplained: "emails.complained",
  emailsBlocked: "emails.blocked",
  emailsOpened: "emails.opened",

  domainsTotal: "domains.total",
  domainsVerified: "domains.verified",

  mailboxesTotal: "mailboxes.total",

  subsStarter: "subscriptions.active.starter",
  subsPro: "subscriptions.active.pro",
  subsBusiness: "subscriptions.active.business",

  warmupMailboxesTotal: "warmupMailboxes.total",
  warmupMailboxesActive: "warmupMailboxes.active",

  warmupEmailsOutbound: "warmupEmails.outbound",
  warmupEmailsPlacementInbox: "warmupEmails.placement.inbox",

  platformAccountsTotal: "platformWarmupAccounts.total",
  platformAccountsActive: "platformWarmupAccounts.active",

  sequencesTotal: "sequences.total",
  sequencesActive: "sequences.active",

  contactsTotal: "contacts.total",

  apiKeysTotal: "apiKeys.total",
  apiKeysActive: "apiKeys.active",
} as const;

export const ALL_KEYS: string[] = Object.values(K);

// ── Bucket derivation ──
//
// Each function answers "which counters does this document currently count
// towards". These must stay faithful to what the old .filter() predicates in
// platformStats.ts did, including their edge cases: a user whose category is
// undefined (legacy rows written before the field existed) counted towards
// users.total and none of the three category counts, so it still does.

export function userBuckets(u: Doc<"users">): string[] {
  const keys: string[] = [K.usersTotal];
  if (u.category === "admin") keys.push(K.usersAdmin);
  if (u.category === "beta") keys.push(K.usersBeta);
  if (u.category === "normal") keys.push(K.usersNormal);
  return keys;
}

export function emailBuckets(e: Doc<"emails">): string[] {
  const keys: string[] = [K.emailsTotal];
  if (e.folder === "sent") keys.push(K.emailsFolderSent);
  if (e.folder === "inbox") keys.push(K.emailsFolderInbox);
  if (e.folder === "outbox") keys.push(K.emailsFolderOutbox);
  if (e.folder === "trash") keys.push(K.emailsFolderTrash);
  // Kept in step with the folder http.ts files inbound warmup mail under.
  if (e.folder === "_warmup") keys.push(K.emailsFolderWarmup);
  if (e.deliveryStatus === "delivered") keys.push(K.emailsDelivered);
  if (e.deliveryStatus === "bounced") keys.push(K.emailsBounced);
  if (e.deliveryStatus === "failed") keys.push(K.emailsFailed);
  if (e.deliveryStatus === "complained") keys.push(K.emailsComplained);
  if (e.deliveryStatus === "blocked") keys.push(K.emailsBlocked);
  if (e.openedAt != null) keys.push(K.emailsOpened);
  return keys;
}

export function domainBuckets(d: Doc<"domains">): string[] {
  const keys: string[] = [K.domainsTotal];
  if (d.verified) keys.push(K.domainsVerified);
  return keys;
}

// mailboxes and contacts are counted by row and nothing else, so unlike the
// others these take no document: there is no field to branch on.
export function mailboxBuckets(): string[] {
  return [K.mailboxesTotal];
}

export function subscriptionBuckets(s: Doc<"subscriptions">): string[] {
  // Only live subscriptions are counted, and the plan breakdown is taken over
  // that same set, so there is no "subscriptions.total" key: canceled and
  // past_due rows contribute nothing, exactly as before.
  if (s.status !== "active" && s.status !== "trialing") return [];
  if (s.plan === "starter") return [K.subsStarter];
  if (s.plan === "pro") return [K.subsPro];
  if (s.plan === "business") return [K.subsBusiness];
  return [];
}

export function warmupMailboxBuckets(w: Doc<"warmupMailboxes">): string[] {
  const keys: string[] = [K.warmupMailboxesTotal];
  if (w.status === "active") keys.push(K.warmupMailboxesActive);
  return keys;
}

export function warmupEmailBuckets(e: Doc<"warmupEmails">): string[] {
  const keys: string[] = [];
  if (e.direction === "outbound") keys.push(K.warmupEmailsOutbound);
  // Deliberately not restricted to outbound: the inbox placement percentage
  // divides this by the outbound count, and that is the ratio the admin page
  // has always shown.
  if (e.placement === "inbox") keys.push(K.warmupEmailsPlacementInbox);
  return keys;
}

export function platformAccountBuckets(
  a: Doc<"platformWarmupAccounts">
): string[] {
  const keys: string[] = [K.platformAccountsTotal];
  if (a.status === "active") keys.push(K.platformAccountsActive);
  return keys;
}

export function sequenceBuckets(s: Doc<"sequences">): string[] {
  const keys: string[] = [K.sequencesTotal];
  if (s.status === "active") keys.push(K.sequencesActive);
  return keys;
}

export function contactBuckets(): string[] {
  return [K.contactsTotal];
}

export function apiKeyBuckets(k: Doc<"api_keys">): string[] {
  const keys: string[] = [K.apiKeysTotal];
  if (k.revokedAt === undefined) keys.push(K.apiKeysActive);
  return keys;
}

// ── Applying changes ──

export type WriteCtx = { db: MutationCtx["db"] };
export type ReadCtx = { db: QueryCtx["db"] };

export function bucketDelta(
  before: string[],
  after: string[]
): Record<string, number> {
  const deltas: Record<string, number> = {};
  for (const key of before) deltas[key] = (deltas[key] ?? 0) - 1;
  for (const key of after) deltas[key] = (deltas[key] ?? 0) + 1;
  return deltas;
}

export async function bumpCounters(
  ctx: WriteCtx,
  deltas: Record<string, number>
): Promise<void> {
  for (const [key, delta] of Object.entries(deltas)) {
    // A patch that leaves a document in the same buckets writes nothing, which
    // is the common case for markAsRead, toggleStar and friends.
    if (delta === 0) continue;
    const row = await ctx.db
      .query("platformCounters")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (row) {
      await ctx.db.patch(row._id, { value: row.value + delta });
    } else {
      await ctx.db.insert("platformCounters", { key, value: delta });
    }
  }
}

export const countCreated = (ctx: WriteCtx, after: string[]) =>
  bumpCounters(ctx, bucketDelta([], after));

export const countRemoved = (ctx: WriteCtx, before: string[]) =>
  bumpCounters(ctx, bucketDelta(before, []));

export const countChanged = (
  ctx: WriteCtx,
  before: string[],
  after: string[]
) => bumpCounters(ctx, bucketDelta(before, after));

/** Set counters to absolute values. Only the reconcile walk uses this. */
export async function setCounters(
  ctx: WriteCtx,
  values: Record<string, number>
): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    const row = await ctx.db
      .query("platformCounters")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (row) {
      if (row.value !== value) await ctx.db.patch(row._id, { value });
    } else {
      await ctx.db.insert("platformCounters", { key, value });
    }
  }
}

/**
 * Read the given keys, defaulting to 0.
 *
 * Point reads rather than a .collect() of the whole counters table, so a query
 * only subscribes to the keys it actually uses and is not woken by unrelated
 * platform activity. A key absent from the table reads as 0, which is what the
 * dashboards should show before the first reconcile has run.
 */
export async function readCounters(
  ctx: ReadCtx,
  keys: string[]
): Promise<Record<string, number>> {
  const rows = await Promise.all(
    keys.map((key) =>
      ctx.db
        .query("platformCounters")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first()
    )
  );
  const out: Record<string, number> = {};
  keys.forEach((key, i) => {
    out[key] = rows[i]?.value ?? 0;
  });
  return out;
}

// ── Per-mailbox stats ──
//
// Same denormalization as the platform counters, scoped to one mailbox and
// kept in its own row so a mailbox page answers every count it needs from a
// single document read. Maintained through the same email wrappers below, so
// there are no extra call sites to keep in sync.

/** One day's worth of a mailbox's mail, as the dashboard and the health check
 *  need it broken down.
 *
 *  `sent` counts every row in the sent folder whatever its deliveryStatus,
 *  which is exactly what the scans these buckets replace counted. A blocked
 *  message is included for the same reason it is included in
 *  byFolder["sent"]: the row is kept rather than deleted, and the two numbers
 *  should not disagree.
 *
 *  The three failure counts are kept apart rather than merged because they are
 *  different problems. Per the emails schema, `failed` is a permanent hard
 *  bounce and means the address is dead, `bounced` is a transient one, and
 *  `complained` means the message arrived and the recipient reported it. Only
 *  the last is a complaint, and domainHealth used to compute its complaint
 *  rate from `failed`, which reported hard bounces under the complaint
 *  threshold and left real complaints counted nowhere.
 */
export type DayTally = {
  sent: number;
  received: number;
  bounced: number;
  failed: number;
  complained: number;
};

export const emptyDayTally = (): DayTally => ({
  sent: 0,
  received: 0,
  bounced: 0,
  failed: 0,
  complained: 0,
});

export type MailboxTally = {
  byFolder: Record<string, number>;
  // Mail keyed by the UTC day of the message's own date, "YYYY-MM-DD".
  //
  // A day, rather than something coarser, because the send allowance is
  // measured against a subscription period anchored on
  // subscriptions.startedAt, which falls on an arbitrary day of the month, and
  // because the dashboard chart draws one point per day. A day is the coarsest
  // bucket both can be summed out of.
  //
  // Keying off the message's date rather than off the clock is what makes this
  // safe to maintain through the same before/after diff as everything else
  // here: re-counting a message that has not changed day is a no-op, there is
  // no rollover to run when a period turns over, and a delivery notification
  // arriving hours after the send still lands on the day it was sent.
  byDay: Record<string, DayTally>;
  unread: number;
  delivered: number;
  failed: number;
  bounced: number;
  pending: number;
  opened: number;
};

/** How many days of buckets a stats row keeps.
 *
 *  Two readers set the floor: the longest billing period is 31 days, since
 *  every plan bills monthly, and the dashboard chart draws 30. The rest is
 *  slack for a write that lands against a day the period has already moved
 *  past, and it keeps the array small enough that reading it costs nothing
 *  worth measuring. Anything older is outside every live window and is dropped
 *  on the next write. */
const DAYS_KEPT = 45;

/**
 * Stored shape of the folder and source breakdowns.
 *
 * These are arrays of {name, count} rather than {[name]: count} maps because
 * Convex field names may only contain alphanumeric ASCII and underscores.
 * Folder names come straight from the client via emails.moveToFolder, and the
 * unsubscribe source "one-click" contains a hyphen, so either as an object key
 * would produce a document Convex rejects. The tallies stay plain objects in
 * memory, where no such rule applies, and are converted at the boundary.
 */
const foldersToRecord = (
  rows: { folder: string; count: number }[]
): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const row of rows) out[row.folder] = row.count;
  return out;
};

const sourcesToRecord = (
  rows: { source: string; count: number }[]
): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const row of rows) out[row.source] = row.count;
  return out;
};

const daysToRecord = (
  rows: {
    day: string;
    sent: number;
    received: number;
    bounced: number;
    failed: number;
    complained: number;
  }[]
): Record<string, DayTally> => {
  const out: Record<string, DayTally> = {};
  for (const row of rows) {
    out[row.day] = {
      sent: row.sent,
      received: row.received,
      bounced: row.bounced,
      failed: row.failed,
      complained: row.complained,
    };
  }
  return out;
};

/** Serialise day buckets, newest first, keeping at most DAYS_KEPT of them.
 *
 *  A day whose every count has fallen to zero is dropped rather than stored,
 *  so a mailbox that has been emptied does not carry a run of empty buckets. */
export const dayRows = (rec: Record<string, DayTally>) =>
  Object.entries(rec)
    .filter(
      ([, d]) =>
        d.sent > 0 ||
        d.received > 0 ||
        d.bounced > 0 ||
        d.failed > 0 ||
        d.complained > 0
    )
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .slice(0, DAYS_KEPT)
    .map(([day, d]) => ({
      day,
      sent: d.sent,
      received: d.received,
      bounced: d.bounced,
      failed: d.failed,
      complained: d.complained,
    }));

export const folderRows = (rec: Record<string, number>) =>
  Object.entries(rec)
    .filter(([, count]) => count > 0)
    .map(([folder, count]) => ({ folder, count }));

export const sourceRows = (rec: Record<string, number>) =>
  Object.entries(rec)
    .filter(([, count]) => count > 0)
    .map(([source, count]) => ({ source, count }));

export const emptyMailboxTally = (): MailboxTally => ({
  byFolder: {},
  byDay: {},
  unread: 0,
  delivered: 0,
  failed: 0,
  bounced: 0,
  pending: 0,
  opened: 0,
});

/**
 * Fold one email into a tally, with sign +1 to add and -1 to remove.
 *
 * The delivery breakdown deliberately only counts messages in the sent folder,
 * and treats "no deliveryStatus at all" as pending. That is what
 * emailStats.getForCurrentUser did when it computed these by reading every
 * email, and these counters exist to give the same answers more cheaply.
 */
export function applyEmailToTally(
  tally: MailboxTally,
  email: Doc<"emails">,
  sign: 1 | -1
): void {
  tally.byFolder[email.folder] = (tally.byFolder[email.folder] ?? 0) + sign;

  // Shared by both folder branches below, so a message moved between them
  // lands on one bucket for the day it carries.
  const day = dayKeyOf(email.date);
  const dayTally = (tally.byDay[day] ??= emptyDayTally());

  if (email.folder === "inbox") {
    // Every inbox message, read or not. The chart's "received" line counted
    // rows in the inbox folder, so a message the user later moves to trash
    // leaves the line, which is the behaviour this replaces.
    dayTally.received += sign;
    if (!email.read) tally.unread += sign;
  }

  if (email.folder === "sent") {
    dayTally.sent += sign;
    // Split by what actually happened, so domainHealth can tell a dead address
    // from a reputation problem from a genuine complaint.
    if (email.deliveryStatus === "bounced") dayTally.bounced += sign;
    else if (email.deliveryStatus === "failed") dayTally.failed += sign;
    else if (email.deliveryStatus === "complained") dayTally.complained += sign;

    if (email.deliveryStatus === "delivered") tally.delivered += sign;
    else if (email.deliveryStatus === "failed") tally.failed += sign;
    else if (email.deliveryStatus === "bounced") tally.bounced += sign;
    // A complaint is a failure the sender needs to see, and counting it as
    // pending would hide it. It joins failed rather than getting its own
    // per-mailbox figure, because the mailbox view's question is "did this
    // reach anyone", and a complaint means it did but should not have.
    else if (email.deliveryStatus === "complained") tally.failed += sign;
    // Blocked is not pending: nothing was ever sent, and there is no
    // notification coming. Counting it as pending is what would make the
    // "stuck in pending" figure meaningless once the gate starts refusing
    // sends.
    else if (email.deliveryStatus === "blocked") { /* counted by folder only */ }
    else tally.pending += sign;

    if (email.openedAt) tally.opened += sign;
  }
}

/** Apply a tally of deltas to a mailbox's stats row, creating it if needed. */
export async function applyMailboxDelta(
  ctx: WriteCtx,
  mailboxId: Id<"mailboxes">,
  delta: MailboxTally
): Promise<void> {
  const nonZeroFolders = Object.entries(delta.byFolder).filter(
    ([, n]) => n !== 0
  );
  const nonZeroDays = Object.entries(delta.byDay).filter(
    ([, d]) =>
      d.sent !== 0 ||
      d.received !== 0 ||
      d.bounced !== 0 ||
      d.failed !== 0 ||
      d.complained !== 0
  );
  if (
    nonZeroFolders.length === 0 &&
    nonZeroDays.length === 0 &&
    delta.unread === 0 &&
    delta.delivered === 0 &&
    delta.failed === 0 &&
    delta.bounced === 0 &&
    delta.pending === 0 &&
    delta.opened === 0
  ) {
    return;
  }

  // .first() rather than .unique() throughout: Convex's serializable
  // transactions make a duplicate row essentially impossible, but if one ever
  // appeared, .unique() would throw and take down whatever mutation was
  // running, including inbound mail ingestion. A slightly wrong count is a far
  // better failure mode for a statistic than a thrown write.
  const row = await ctx.db
    .query("mailboxStats")
    .withIndex("by_mailbox", (q) => q.eq("mailboxId", mailboxId))
    .first();

  if (!row) {
    const byFolder: Record<string, number> = {};
    for (const [folder, n] of nonZeroFolders) byFolder[folder] = Math.max(0, n);
    const byDay: Record<string, DayTally> = {};
    for (const [day, d] of nonZeroDays) {
      byDay[day] = {
        sent: Math.max(0, d.sent),
        received: Math.max(0, d.received),
        bounced: Math.max(0, d.bounced),
        failed: Math.max(0, d.failed),
        complained: Math.max(0, d.complained),
      };
    }
    await ctx.db.insert("mailboxStats", {
      mailboxId,
      byFolder: folderRows(byFolder),
      byDay: dayRows(byDay),
      unread: Math.max(0, delta.unread),
      delivered: Math.max(0, delta.delivered),
      failed: Math.max(0, delta.failed),
      bounced: Math.max(0, delta.bounced),
      pending: Math.max(0, delta.pending),
      opened: Math.max(0, delta.opened),
    });
    return;
  }

  const byFolder = foldersToRecord(row.byFolder);
  for (const [folder, n] of nonZeroFolders) {
    byFolder[folder] = Math.max(0, (byFolder[folder] ?? 0) + n);
  }

  const byDay = daysToRecord(row.byDay ?? []);
  for (const [day, d] of nonZeroDays) {
    const current = byDay[day] ?? emptyDayTally();
    byDay[day] = {
      sent: Math.max(0, current.sent + d.sent),
      received: Math.max(0, current.received + d.received),
      bounced: Math.max(0, current.bounced + d.bounced),
      failed: Math.max(0, current.failed + d.failed),
      complained: Math.max(0, current.complained + d.complained),
    };
  }

  await ctx.db.patch(row._id, {
    byFolder: folderRows(byFolder),
    byDay: dayRows(byDay),
    unread: Math.max(0, row.unread + delta.unread),
    delivered: Math.max(0, row.delivered + delta.delivered),
    failed: Math.max(0, row.failed + delta.failed),
    bounced: Math.max(0, row.bounced + delta.bounced),
    pending: Math.max(0, row.pending + delta.pending),
    opened: Math.max(0, row.opened + delta.opened),
  });
}

/** Read a mailbox's stats row, or zeros if it has none yet. */
export async function readMailboxStats(
  ctx: ReadCtx,
  mailboxId: Id<"mailboxes">
): Promise<MailboxTally> {
  const row = await ctx.db
    .query("mailboxStats")
    .withIndex("by_mailbox", (q) => q.eq("mailboxId", mailboxId))
    .first();
  if (!row) return emptyMailboxTally();
  return {
    byFolder: foldersToRecord(row.byFolder),
    // Absent on every row written before this field existed. Those read as no
    // mail at all until platformStats.startEntityStatsRebuild, which runs
    // nightly and can be run by hand, walks the mailbox and fills them in.
    byDay: daysToRecord(row.byDay ?? []),
    unread: row.unread,
    delivered: row.delivered,
    failed: row.failed,
    bounced: row.bounced,
    pending: row.pending,
    opened: row.opened,
  };
}

// ── Per-domain stats ──

export async function applyUnsubscribeDelta(
  ctx: WriteCtx,
  domainId: Id<"domains">,
  source: string,
  sign: 1 | -1
): Promise<void> {
  const row = await ctx.db
    .query("domainStats")
    .withIndex("by_domain", (q) => q.eq("domainId", domainId))
    .first();

  if (!row) {
    await ctx.db.insert("domainStats", {
      domainId,
      unsubscribesTotal: Math.max(0, sign),
      unsubscribesBySource: sign > 0 ? [{ source, count: 1 }] : [],
    });
    return;
  }

  const bySource = sourcesToRecord(row.unsubscribesBySource);
  bySource[source] = Math.max(0, (bySource[source] ?? 0) + sign);

  await ctx.db.patch(row._id, {
    unsubscribesTotal: Math.max(0, row.unsubscribesTotal + sign),
    unsubscribesBySource: sourceRows(bySource),
  });
}

export async function readDomainStats(
  ctx: ReadCtx,
  domainId: Id<"domains">
): Promise<{ total: number; bySource: Record<string, number> }> {
  const row = await ctx.db
    .query("domainStats")
    .withIndex("by_domain", (q) => q.eq("domainId", domainId))
    .first();
  return {
    total: row?.unsubscribesTotal ?? 0,
    bySource: row ? sourcesToRecord(row.unsubscribesBySource) : {},
  };
}

// ── emails: insert/patch/delete wrappers ──
//
// The emails table is written from a dozen places across emails.ts, so rather
// than open-coding a before/after diff at each one, those call sites go
// through these. Each keeps the same signature as the ctx.db call it replaces.

export async function insertEmailCounted(
  ctx: WriteCtx,
  fields: WithoutSystemFields<Doc<"emails">>
): Promise<Id<"emails">> {
  const id = await ctx.db.insert("emails", fields);
  const doc = await ctx.db.get(id);
  if (doc) {
    await countCreated(ctx, emailBuckets(doc));
    const tally = emptyMailboxTally();
    applyEmailToTally(tally, doc, 1);
    await applyMailboxDelta(ctx, doc.mailboxId, tally);
  }
  return id;
}

export async function patchEmailCounted(
  ctx: WriteCtx,
  id: Id<"emails">,
  patch: Partial<WithoutSystemFields<Doc<"emails">>>
): Promise<void> {
  const before = await ctx.db.get(id);
  if (!before) return;
  await ctx.db.patch(id, patch);
  const after = await ctx.db.get(id);
  if (!after) return;

  await countChanged(ctx, emailBuckets(before), emailBuckets(after));

  // A patch can move a message between mailboxes in principle, so remove it
  // from the old mailbox's tally and add it to the new one rather than
  // assuming they are the same row.
  if (before.mailboxId === after.mailboxId) {
    const tally = emptyMailboxTally();
    applyEmailToTally(tally, before, -1);
    applyEmailToTally(tally, after, 1);
    await applyMailboxDelta(ctx, after.mailboxId, tally);
  } else {
    const removed = emptyMailboxTally();
    applyEmailToTally(removed, before, -1);
    await applyMailboxDelta(ctx, before.mailboxId, removed);

    const added = emptyMailboxTally();
    applyEmailToTally(added, after, 1);
    await applyMailboxDelta(ctx, after.mailboxId, added);
  }
}

export async function deleteEmailCounted(
  ctx: WriteCtx,
  id: Id<"emails">
): Promise<void> {
  const before = await ctx.db.get(id);
  await ctx.db.delete(id);
  if (before) {
    await countRemoved(ctx, emailBuckets(before));
    const tally = emptyMailboxTally();
    applyEmailToTally(tally, before, -1);
    await applyMailboxDelta(ctx, before.mailboxId, tally);
  }
}

/**
 * Delete a batch of already-loaded emails, counting them in aggregate.
 *
 * The cascade deletes in domains.ts and mailboxes.ts remove every email under
 * a mailbox in one transaction. Bumping a counter per email there would add a
 * counter write per row to a mutation that is already at risk of the 32,000
 * document limit for a large mailbox. Tallying in memory first means the
 * counters cost a handful of writes regardless of how many emails are removed.
 */
export async function deleteEmailsCounted(
  ctx: WriteCtx,
  emails: Doc<"emails">[]
): Promise<void> {
  const deltas: Record<string, number> = {};
  const byMailbox = new Map<Id<"mailboxes">, MailboxTally>();

  for (const email of emails) {
    for (const key of emailBuckets(email)) deltas[key] = (deltas[key] ?? 0) - 1;

    let tally = byMailbox.get(email.mailboxId);
    if (!tally) {
      tally = emptyMailboxTally();
      byMailbox.set(email.mailboxId, tally);
    }
    applyEmailToTally(tally, email, -1);

    await ctx.db.delete(email._id);
  }

  await bumpCounters(ctx, deltas);
  for (const [mailboxId, tally] of byMailbox) {
    await applyMailboxDelta(ctx, mailboxId, tally);
  }
}

/** Remove a mailbox's stats row. Called when the mailbox itself is deleted. */
export async function deleteMailboxStats(
  ctx: WriteCtx,
  mailboxId: Id<"mailboxes">
): Promise<void> {
  const row = await ctx.db
    .query("mailboxStats")
    .withIndex("by_mailbox", (q) => q.eq("mailboxId", mailboxId))
    .first();
  if (row) await ctx.db.delete(row._id);
}

/** Remove a domain's stats row. Called when the domain itself is deleted. */
export async function deleteDomainStats(
  ctx: WriteCtx,
  domainId: Id<"domains">
): Promise<void> {
  const row = await ctx.db
    .query("domainStats")
    .withIndex("by_domain", (q) => q.eq("domainId", domainId))
    .first();
  if (row) await ctx.db.delete(row._id);
}
