import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
// Doc was only used by the commented-out listForCurrentUser above.
// import type { Doc } from "./_generated/dataModel";
import { applyUnsubscribeDelta, readDomainStats } from "./lib/counters";
// The same normalization the token was minted with. If these two ever
// disagreed, a legitimate legacy link would stop matching its own message.
import { normalizeAddress } from "./lib/unsubscribeToken";

// ── Queries ──

// Old: walk every domain and collect every unsubscribe it has ever had,
// then sort the lot in memory. Unsubscribes only accumulate, so that read grew
// without bound. Replaced by listPageForCurrentUser below, which pages.
//
// export const listForCurrentUser = query({
//   args: {},
//   handler: async (ctx) => {
//     const identity = await ctx.auth.getUserIdentity();
//     if (!identity) return [];
////     const user = await ctx.db
//       .query("users")
//       .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
//       .unique();
//     if (!user) return [];
////     const domains = await ctx.db
//       .query("domains")
//       .withIndex("by_user_id", (q) => q.eq("userId", user._id))
//       .collect();
////     const results: (Doc<"unsubscribes"> & { domainName: string })[] = [];
//     for (const domain of domains) {
//       const unsubs = await ctx.db
//         .query("unsubscribes")
//         .withIndex("by_domain_id", (q) => q.eq("domainId", domain._id))
//         .collect();
////       for (const unsub of unsubs) {
//         results.push({
//           ...unsub,
//           domainName: domain.domain,
//         });
//       }
//     }
////     return results.sort((a, b) => b.unsubscribedAt - a.unsubscribedAt);
//   },
// });
//
/** The current user's unsubscribes, newest first, one page at a time.
 *
 *  Unsubscribes hang off domains rather than users, so there is no single index
 *  to page over: the list is a merge across the user's domains. Each domain
 *  contributes at most one page from by_domain_date, the pages are merged, and
 *  the top numItems are returned. A read is therefore bounded by domains times
 *  page size rather than by how many people have ever opted out.
 *
 *  The cursor is the (unsubscribedAt, _id) of the last row returned, which is
 *  what the merge sorts on, so it survives rows arriving in between. The one
 *  soft spot is a single domain holding more than a page of unsubscribes
 *  recorded in the same millisecond, which the bulk paths do not produce. */
type MergeCursor = { ts: number; id: string };

function decodeCursor(cursor: string | null): MergeCursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(cursor) as MergeCursor;
    return typeof parsed?.ts === "number" && typeof parsed?.id === "string"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

/** Newest first: later timestamp wins, and _id breaks ties the same way the
 *  by_domain_date index does when read in descending order. */
function newestFirst(
  a: { unsubscribedAt: number; _id: string },
  b: { unsubscribedAt: number; _id: string }
) {
  if (a.unsubscribedAt !== b.unsubscribedAt)
    return b.unsubscribedAt - a.unsubscribedAt;
  return a._id < b._id ? 1 : a._id > b._id ? -1 : 0;
}

export const listPageForCurrentUser = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const empty = { page: [], isDone: true, continueCursor: "" };

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return empty;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return empty;

    const domains = await ctx.db
      .query("domains")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();
    if (domains.length === 0) return empty;

    const numItems = Math.max(1, paginationOpts.numItems);
    const after = decodeCursor(paginationOpts.cursor);

    // One page too many per domain: the extra row is what tells us whether
    // anything is left without a second read.
    const perDomain = await Promise.all(
      domains.map(async (domain) => {
        const rows = await ctx.db
          .query("unsubscribes")
          .withIndex("by_domain_date", (q) =>
            after
              ? q.eq("domainId", domain._id).lte("unsubscribedAt", after.ts)
              : q.eq("domainId", domain._id)
          )
          .order("desc")
          .take(numItems + 1);

        const cursorRow = after
          ? { unsubscribedAt: after.ts, _id: after.id }
          : null;

        return rows
          .filter((row) => !cursorRow || newestFirst(row, cursorRow) > 0)
          .map((row) => ({ ...row, domainName: domain.domain }));
      })
    );

    const merged = perDomain.flat().sort(newestFirst);
    const page = merged.slice(0, numItems);
    const last = page[page.length - 1];

    // Every domain was asked for numItems + 1, so a merge that came back within
    // numItems means no domain was truncated and there is nothing further.
    const isDone = merged.length <= numItems;

    return {
      page,
      isDone,
      continueCursor:
        isDone || !last
          ? ""
          : JSON.stringify({ ts: last.unsubscribedAt, id: last._id }),
    };
  },
});

export const listForDomain = query({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const domain = await ctx.db.get(domainId);
    if (!domain || domain.userId !== user._id) return [];

    return await ctx.db
      .query("unsubscribes")
      .withIndex("by_domain_id", (q) => q.eq("domainId", domainId))
      .collect();
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;

    const domains = await ctx.db
      .query("domains")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    let total = 0;
    let last7Days = 0;
    let last30Days = 0;
    const now = Date.now();
    const bySource: Record<string, number> = { "one-click": 0, link: 0, manual: 0 };

    // Old: collect every unsubscribe the domain has ever had, then derive all
    // four figures from it in memory. Unsubscribes only ever accumulate, so
    // that read grows without bound for an active sending domain.
    //
    // for (const domain of domains) {
    //   const unsubs = await ctx.db
    //     .query("unsubscribes")
    //     .withIndex("by_domain_id", (q) => q.eq("domainId", domain._id))
    //     .collect();
    //   for (const unsub of unsubs) { ...total, bySource, last7Days, last30Days... }
    // }
    //
    // total and bySource are all-time, so they come from the per-domain
    // counters. The two windows are bounded by definition and come from a
    // range read on by_domain_date, which only touches the last 30 days.
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    for (const domain of domains) {
      const stats = await readDomainStats(ctx, domain._id);
      total += stats.total;
      for (const [source, count] of Object.entries(stats.bySource)) {
        bySource[source] = (bySource[source] ?? 0) + count;
      }

      const recent = await ctx.db
        .query("unsubscribes")
        .withIndex("by_domain_date", (q) =>
          q.eq("domainId", domain._id).gte("unsubscribedAt", thirtyDaysAgo)
        )
        .collect();

      for (const unsub of recent) {
        last30Days++;
        if (unsub.unsubscribedAt >= sevenDaysAgo) last7Days++;
      }
    }

    return { total, last7Days, last30Days, bySource };
  },
});

// ── Mutations (user-facing) ──

export const addManual = mutation({
  args: {
    domainId: v.id("domains"),
    email: v.string(),
  },
  handler: async (ctx, { domainId, email }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const domain = await ctx.db.get(domainId);
    if (!domain || domain.userId !== user._id) throw new Error("Not authorized");

    const normalized = email.toLowerCase().trim();

    // Check if already unsubscribed
    const existing = await ctx.db
      .query("unsubscribes")
      .withIndex("by_domain_email", (q) =>
        q.eq("domainId", domainId).eq("email", normalized)
      )
      .first();
    if (existing) throw new Error("Email already unsubscribed");

    const token = generateToken();
    await ctx.db.insert("unsubscribes", {
      domainId,
      email: normalized,
      token,
      unsubscribedAt: Date.now(),
      source: "manual",
    });
    await applyUnsubscribeDelta(ctx, domainId, "manual", 1);
  },
});

export const remove = mutation({
  args: { unsubscribeId: v.id("unsubscribes") },
  handler: async (ctx, { unsubscribeId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const unsub = await ctx.db.get(unsubscribeId);
    if (!unsub) throw new Error("Not found");

    const domain = await ctx.db.get(unsub.domainId);
    if (!domain || domain.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.delete(unsubscribeId);
    await applyUnsubscribeDelta(ctx, unsub.domainId, unsub.source, -1);
  },
});

// ── Internal (used by HTTP routes and sending) ──

export const isUnsubscribed = internalQuery({
  args: { domainId: v.id("domains"), email: v.string() },
  handler: async (ctx, { domainId, email }) => {
    const record = await ctx.db
      .query("unsubscribes")
      .withIndex("by_domain_email", (q) =>
        q.eq("domainId", domainId).eq("email", email.toLowerCase())
      )
      .first();
    return !!record;
  },
});

export const checkUnsubscribedRecipients = internalQuery({
  args: { domainId: v.id("domains"), emails: v.array(v.string()) },
  handler: async (ctx, { domainId, emails }) => {
    const unsubscribed: string[] = [];
    for (const email of emails) {
      const record = await ctx.db
        .query("unsubscribes")
        .withIndex("by_domain_email", (q) =>
          q.eq("domainId", domainId).eq("email", email.toLowerCase())
        )
        .first();
      if (record) unsubscribed.push(email);
    }
    return unsubscribed;
  },
});

// Unused, and unusable for verifying an unsubscribe link: the token on an
// `unsubscribes` row is minted by generateToken() when the row is inserted,
// while the token in a delivered message is minted at send time by
// lib/unsubscribeToken.ts. They were never the same value. Link verification
// is resolveLegacyToken below plus the signature check in that library.
//
// export const getByToken = internalQuery({
//   args: { token: v.string() },
//   handler: async (ctx, { token }) => {
//     return await ctx.db
//       .query("unsubscribes")
//       .withIndex("by_token", (q) => q.eq("token", token))
//       .first();
//   },
// });

/**
 * Verify a legacy (unsigned) unsubscribe token against the message it names.
 *
 * Legacy tokens carry no signature, so on their own they prove nothing: the
 * shape is `${messageId}-${base64url(email)}` and anyone can type one. What
 * makes one trustworthy is that we sent that messageId to that address, which
 * is a fact in the emails table. An attacker would have to know a real
 * messageId of a message that actually went to the address they want opted
 * out, and messageIds only ever leave here inside the message itself.
 *
 * Returns the domain the message was sent from, so the caller never has to
 * trust a domain name off the query string either. Null means the token does
 * not match a message we sent, and the request is refused.
 *
 * The tradeoff: a message whose emails row was never written (or has since
 * been removed) can no longer be unsubscribed from through its old link.
 * Newly sent mail carries a signed token and does not come through here.
 */
export const resolveLegacyToken = internalQuery({
  args: { messageId: v.string(), email: v.string() },
  handler: async (ctx, { messageId, email }) => {
    const normalized = normalizeAddress(email);

    // by_message_id is not unique: a sender's own copy and an ingested copy can
    // both carry the id, so take the row that actually addressed this person
    // rather than whichever one sorts first. Bounded, because a messageId
    // identifies one send.
    const messages = await ctx.db
      .query("emails")
      .withIndex("by_message_id", (q) => q.eq("messageId", messageId))
      .take(10);

    const message = messages.find((candidate) =>
      [
        ...candidate.to,
        ...(candidate.cc ?? []),
        ...(candidate.bcc ?? []),
      ].some((address) => normalizeAddress(address) === normalized)
    );
    if (!message) return null;

    const mailbox = await ctx.db.get(message.mailboxId);
    if (!mailbox) return null;

    const domain = await ctx.db.get(mailbox.domainId);
    if (!domain) return null;

    return { domainId: domain._id, email: normalized };
  },
});

export const processUnsubscribe = internalMutation({
  args: {
    domainId: v.id("domains"),
    email: v.string(),
    source: v.union(v.literal("one-click"), v.literal("link"), v.literal("manual")),
    mailboxAddress: v.optional(v.string()),
  },
  handler: async (ctx, { domainId, email, source, mailboxAddress }) => {
    const normalized = email.toLowerCase().trim();

    // Idempotent: check if already unsubscribed
    const existing = await ctx.db
      .query("unsubscribes")
      .withIndex("by_domain_email", (q) =>
        q.eq("domainId", domainId).eq("email", normalized)
      )
      .first();
    if (existing) return existing._id;

    const token = generateToken();
    const unsubscribeId = await ctx.db.insert("unsubscribes", {
      domainId,
      email: normalized,
      token,
      unsubscribedAt: Date.now(),
      source,
      mailboxAddress,
    });
    await applyUnsubscribeDelta(ctx, domainId, source, 1);
    return unsubscribeId;
  },
});

export const listForDomainPaginated = internalQuery({
  args: {
    domainId: v.id("domains"),
    limit: v.number(),
    afterTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, { domainId, limit, afterTimestamp }) => {
    const all = await ctx.db
      .query("unsubscribes")
      .withIndex("by_domain_id", (q) => q.eq("domainId", domainId))
      .collect();

    const sorted = all.sort((a, b) => b.unsubscribedAt - a.unsubscribedAt);
    const filtered = afterTimestamp
      ? sorted.filter((u) => u.unsubscribedAt < afterTimestamp)
      : sorted;

    return {
      items: filtered.slice(0, limit),
      total: all.length,
      hasMore: filtered.length > limit,
    };
  },
});

export const countForDomain = internalQuery({
  args: { domainId: v.id("domains") },
  handler: async (ctx, { domainId }) => {
    const all = await ctx.db
      .query("unsubscribes")
      .withIndex("by_domain_id", (q) => q.eq("domainId", domainId))
      .collect();
    return all.length;
  },
});

// Generate a URL-safe token for unsubscribe links
function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}
