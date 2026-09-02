import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { readMailboxStats } from "./lib/counters";

// Per-domain outgoing mail, for the admin email activity page.
//
// Everything here is read on demand rather than from the counters in
// convex/lib/counters.ts, because the page needs the rows themselves
// (timings, recipients, repeat counts) and not just totals. That makes the
// reads unbounded in principle, so every one of them is capped: Convex fails
// a query outright at 16 MiB read or 32,000 documents scanned, and an admin
// looking at the platform's busiest domain is exactly the case that would hit
// it. The caps below are deliberately well under both, and whenever one bites
// the result says so via `truncated` rather than quietly reporting a number
// that is short.

// Most rows we will read across all of a domain's mailboxes in one call.
const SCAN_CAP = 4000;
// Most rows we ship back for the table. Stats are computed over everything
// scanned, not just these, so the summary stays right when the table is cut.
const ROW_CAP = 500;
// Most per-recipient rows we ship back, highest count first.
const RECIPIENT_CAP = 500;

// The folders a domain's outgoing mail lives in. "outbox" holds messages that
// have been composed and scheduled but not yet handed to SES; ses.ts moves a
// row to "sent" once SES accepts it (see markScheduledAsSent in emails.ts).
const SENT_FOLDER = "sent";
const OUTBOX_FOLDER = "outbox";

async function requireAdminUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) throw new Error("Admin access required");
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!user || user.category !== "admin") throw new Error("Admin access required");
  return user;
}

// Every address a message went to, deduped within the message. One email
// addressed to the same person on both To and Cc is one send to that person,
// not two, and counting it twice would inflate every repeat figure on the page.
function recipientsOf(email: Doc<"emails">): string[] {
  const all = [...email.to, ...(email.cc ?? []), ...(email.bcc ?? [])];
  const seen = new Set<string>();
  for (const raw of all) {
    const address = normalizeAddress(raw);
    if (address) seen.add(address);
  }
  return [...seen];
}

// Recipients are stored as written by the composer, so the same person can
// appear as "Ann <ann@x.com>", "ann@x.com" and "Ann@X.com" across messages.
// Repeat counting is only meaningful once those collapse to one key.
function normalizeAddress(raw: string): string {
  const angled = raw.match(/<([^>]+)>/);
  const address = (angled ? angled[1] : raw).trim().toLowerCase();
  return address;
}

// The display name in front of an address, when the composer recorded one.
function displayNameOf(raw: string): string | null {
  const angled = raw.match(/^\s*"?([^"<]*?)"?\s*<[^>]+>\s*$/);
  const name = angled?.[1]?.trim();
  return name ? name : null;
}

export const listDomains = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminUser(ctx);

    const domains = await ctx.db.query("domains").order("desc").collect();

    return await Promise.all(
      domains.map(async (domain) => {
        const owner = await ctx.db.get(domain.userId);
        const mailboxes = await ctx.db
          .query("mailboxes")
          .withIndex("by_domain_id", (q) => q.eq("domainId", domain._id))
          .collect();

        // All-time counts straight from the per-mailbox counters. These are
        // exact however large the domain is, which is what makes them safe to
        // show next to the scanned figures below.
        let sent = 0;
        let scheduled = 0;
        for (const mailbox of mailboxes) {
          const stats = await readMailboxStats(ctx, mailbox._id);
          sent += stats.byFolder[SENT_FOLDER] ?? 0;
          scheduled += stats.byFolder[OUTBOX_FOLDER] ?? 0;
        }

        return {
          _id: domain._id,
          domain: domain.domain,
          verified: domain.verified,
          ownerEmail: owner?.email ?? null,
          ownerName: owner?.name ?? null,
          mailboxCount: mailboxes.length,
          sentAllTime: sent,
          scheduledAllTime: scheduled,
        };
      })
    );
  },
});

export const getDomainEmailActivity = query({
  args: {
    domainId: v.id("domains"),
    // Window for sent mail, in days. Omitted means all time. Scheduled mail is
    // always returned in full: it is future-dated and a pending send matters
    // whatever window the admin is looking at.
    days: v.optional(v.number()),
  },
  handler: async (ctx, { domainId, days }) => {
    await requireAdminUser(ctx);

    const domain = await ctx.db.get(domainId);
    if (!domain) return null;

    const owner = await ctx.db.get(domain.userId);

    const mailboxes = await ctx.db
      .query("mailboxes")
      .withIndex("by_domain_id", (q) => q.eq("domainId", domainId))
      .collect();

    const mailboxLabel = new Map<Id<"mailboxes">, string>();
    for (const mailbox of mailboxes) {
      mailboxLabel.set(mailbox._id, mailbox.fullAddress);
    }

    const since =
      days && days > 0 ? Date.now() - days * 24 * 60 * 60 * 1000 : null;

    let budget = SCAN_CAP;
    let truncated = false;
    const scanned: Doc<"emails">[] = [];

    for (let i = 0; i < mailboxes.length; i++) {
      const mailbox = mailboxes[i];
      if (budget <= 0) {
        // Mailboxes left unread, so the answer below is short.
        truncated = true;
        break;
      }
      for (const folder of [SENT_FOLDER, OUTBOX_FOLDER]) {
        if (budget <= 0) {
          truncated = true;
          break;
        }
        // Ask for one more than the budget so a full page tells us there was
        // more to read, rather than us guessing from an exact-length result.
        const rows = await ctx.db
          .query("emails")
          .withIndex("by_mailbox_folder_date", (q) => {
            const base = q.eq("mailboxId", mailbox._id).eq("folder", folder);
            // The window applies to sent mail only. An outbox row carries its
            // scheduled time in `date`, so a lower bound of "30 days ago" is
            // no filter at all for it, and a send scheduled before an admin
            // widened the window would still need showing.
            return since !== null && folder === SENT_FOLDER
              ? base.gte("date", since)
              : base;
          })
          .order("desc")
          .take(budget + 1);

        if (rows.length > budget) {
          truncated = true;
          rows.length = budget;
        }
        budget -= rows.length;
        scanned.push(...rows);
      }
    }

    // Per-recipient tally across everything scanned.
    const tally = new Map<
      string,
      {
        email: string;
        name: string | null;
        count: number;
        sentCount: number;
        scheduledCount: number;
        firstAt: number;
        lastAt: number;
      }
    >();

    let sentCount = 0;
    let scheduledCount = 0;
    let recipientSlots = 0;
    let opened = 0;
    let delivered = 0;
    let bounced = 0;
    let failed = 0;

    for (const email of scanned) {
      const isScheduled = email.folder === OUTBOX_FOLDER;
      if (isScheduled) scheduledCount += 1;
      else sentCount += 1;

      if (email.openedAt) opened += 1;
      if (email.deliveryStatus === "delivered") delivered += 1;
      if (email.deliveryStatus === "bounced") bounced += 1;
      if (email.deliveryStatus === "failed") failed += 1;

      const when = isScheduled ? email.scheduledAt ?? email.date : email.date;
      const raws = [...email.to, ...(email.cc ?? []), ...(email.bcc ?? [])];
      const addresses = recipientsOf(email);
      recipientSlots += addresses.length;

      for (const address of addresses) {
        const existing = tally.get(address);
        if (existing) {
          existing.count += 1;
          if (isScheduled) existing.scheduledCount += 1;
          else existing.sentCount += 1;
          existing.firstAt = Math.min(existing.firstAt, when);
          existing.lastAt = Math.max(existing.lastAt, when);
          if (!existing.name) {
            const raw = raws.find((r) => normalizeAddress(r) === address);
            existing.name = raw ? displayNameOf(raw) : null;
          }
        } else {
          const raw = raws.find((r) => normalizeAddress(r) === address);
          tally.set(address, {
            email: address,
            name: raw ? displayNameOf(raw) : null,
            count: 1,
            sentCount: isScheduled ? 0 : 1,
            scheduledCount: isScheduled ? 1 : 0,
            firstAt: when,
            lastAt: when,
          });
        }
      }
    }

    const recipients = [...tally.values()].sort(
      (a, b) => b.count - a.count || b.lastAt - a.lastAt
    );

    const repeated = recipients.filter((r) => r.count > 1);
    // Sends beyond the first for every address that got more than one. This is
    // the figure that answers "how much of this volume is re-contact", which
    // the raw slot total hides.
    const repeatSends = repeated.reduce((sum, r) => sum + (r.count - 1), 0);
    const maxRepeat = repeated.length > 0 ? repeated[0].count : 0;

    // Newest activity first, mixing sent and scheduled on the time each one
    // actually happens (or is due to happen).
    const rows = scanned
      .map((email) => {
        const isScheduled = email.folder === OUTBOX_FOLDER;
        return {
          _id: email._id,
          mailboxId: email.mailboxId,
          mailbox: mailboxLabel.get(email.mailboxId) ?? email.from,
          from: email.from,
          subject: email.subject,
          snippet: email.snippet,
          status: isScheduled ? ("scheduled" as const) : ("sent" as const),
          // When it was sent, or when it is due to go out.
          at: isScheduled ? email.scheduledAt ?? email.date : email.date,
          scheduledAt: email.scheduledAt ?? null,
          to: email.to,
          cc: email.cc ?? [],
          bcc: email.bcc ?? [],
          recipientCount: recipientsOf(email).length,
          deliveryStatus: email.deliveryStatus ?? null,
          deliveredAt: email.deliveredAt ?? null,
          openedAt: email.openedAt ?? null,
          repliedAt: email.repliedAt ?? null,
          clickCount: email.clickedLinks?.length ?? 0,
          batchId: email.batchId ?? null,
        };
      })
      .sort((a, b) => b.at - a.at);

    // All-time totals from the counters, so the header can say how much of the
    // domain's mail the scanned window actually covers.
    let sentAllTime = 0;
    let scheduledAllTime = 0;
    for (const mailbox of mailboxes) {
      const stats = await readMailboxStats(ctx, mailbox._id);
      sentAllTime += stats.byFolder[SENT_FOLDER] ?? 0;
      scheduledAllTime += stats.byFolder[OUTBOX_FOLDER] ?? 0;
    }

    return {
      domain: {
        _id: domain._id,
        domain: domain.domain,
        verified: domain.verified,
        ownerEmail: owner?.email ?? null,
        ownerName: owner?.name ?? null,
      },
      mailboxes: mailboxes.map((m) => ({
        _id: m._id,
        fullAddress: m.fullAddress,
        displayName: m.displayName ?? null,
      })),
      windowDays: days ?? null,
      since,
      truncated,
      scannedCount: scanned.length,
      scanCap: SCAN_CAP,
      totals: {
        emails: scanned.length,
        sent: sentCount,
        scheduled: scheduledCount,
        sentAllTime,
        scheduledAllTime,
        // Every recipient slot across the scanned mail, duplicates included.
        recipientSlots,
        uniqueRecipients: recipients.length,
        repeatedRecipients: repeated.length,
        repeatSends,
        maxRepeat,
        opened,
        delivered,
        bounced,
        failed,
      },
      rows: rows.slice(0, ROW_CAP),
      rowsTruncated: rows.length > ROW_CAP,
      rowCap: ROW_CAP,
      recipients: recipients.slice(0, RECIPIENT_CAP),
      recipientsTruncated: recipients.length > RECIPIENT_CAP,
      recipientCap: RECIPIENT_CAP,
    };
  },
});
