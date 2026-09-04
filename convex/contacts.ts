import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { contactBuckets, countCreated, countRemoved } from "./lib/counters";
import { isPlausibleAddress } from "./lib/sendPolicy";

export const listByUserInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("contacts")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const deleteInternal = internalMutation({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, { contactId }) => {
    // Read before the delete, since the row is the only thing that knows which
    // user's contactCount has to come down.
    const contact = await ctx.db.get(contactId);
    await ctx.db.delete(contactId);
    await countRemoved(ctx, contactBuckets());

    if (contact) {
      const user = await ctx.db.get(contact.userId);
      if (user) {
        // Clamped at 0: a row deleted before the backfill reached this user
        // would otherwise push an unset count negative.
        await ctx.db.patch(contact.userId, {
          contactCount: Math.max(0, (user.contactCount ?? 0) - 1),
        });
      }
    }
  },
});

export const getByIdInternal = internalQuery({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, { contactId }) => {
    return await ctx.db.get(contactId);
  },
});

// Upsert a contact when we learn a name for an email address
export const upsert = internalMutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, { userId, email, name }) => {
    if (!name || !email) return;

    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_user_email", (q) => q.eq("userId", userId).eq("email", email))
      .unique();

    if (existing) {
      // Update name if changed
      if (existing.name !== name) {
        await ctx.db.patch(existing._id, { name });
      }
    } else {
      await ctx.db.insert("contacts", { userId, email, name });
      await countCreated(ctx, contactBuckets());

      // Only the insert branch moves the count. A name update above changes no
      // row count, and this is deliberately not gated on PLAN_LIMITS.contacts:
      // the cap is measured, not enforced, so an over-limit user keeps having
      // their contacts captured and simply reports usage above their limit.
      const user = await ctx.db.get(userId);
      if (user) {
        await ctx.db.patch(userId, { contactCount: (user.contactCount ?? 0) + 1 });
      }

      // Verify at ingestion, not at send.
      //
      // This is the cheapest possible moment to learn an address is dead: it
      // is one lookup, it happens once, and the answer is cached long before
      // any campaign needs it, so the send path never waits on the API. It is
      // scheduled rather than awaited because this mutation runs inside
      // inbound mail ingestion and the contacts API, neither of which should
      // block on a third party.
      //
      // Only for new contacts. An address already in the table has either been
      // verified already or will be picked up by the revalidation sweep, and
      // re-verifying on every name update would pay for the same lookup twice.
      if (isPlausibleAddress(email)) {
        await ctx.scheduler.runAfter(
          0,
          internal.verification.verifyAddressesAsync,
          { emails: [email], userId }
        );
      }
    }
  },
});

// Get all contacts for the current user (used to resolve display names)
export const listForCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) return [];

    return await ctx.db
      .query("contacts")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();
  },
});

/** Display names for a named set of addresses.
 *
 *  The mailbox used to read the whole address book through
 *  listForCurrentUser just to turn a "from" line into a name. That is a table
 *  scan for every mailbox open, and it grows with the account while the thing
 *  it feeds never does: one screen of mail shows fifty rows. This takes the
 *  addresses actually on screen and looks up only those, over by_user_email.
 *
 *  Addresses are lowercased to match how upsert stores them. The cap is a
 *  backstop, not an expected limit: a page of fifty mails with every to and cc
 *  counted lands well under it. */
const MAX_NAME_LOOKUPS = 300;

export const namesByEmails = query({
  args: { emails: v.array(v.string()) },
  handler: async (ctx, { emails }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const wanted = [...new Set(emails.map((e) => e.toLowerCase().trim()))]
      .filter((e) => e.length > 0)
      .slice(0, MAX_NAME_LOOKUPS);

    const found = await Promise.all(
      wanted.map(async (email) => {
        const contact = await ctx.db
          .query("contacts")
          .withIndex("by_user_email", (q) =>
            q.eq("userId", user._id).eq("email", email)
          )
          .first();
        return contact ? { email, name: contact.name } : null;
      })
    );

    return found.filter(
      (row): row is { email: string; name: string } => row !== null
    );
  },
});

/** The current user's address book, paginated, newest first.
 *
 *  Separate from listForCurrentUser above rather than replacing it: that one is
 *  read whole by the mailbox view to resolve every display name in a thread
 *  list, which genuinely needs all of them. This one backs the contacts page,
 *  where the list is scrolled rather than looked up. */
export const listPageForCurrentUser = query({
  // Convex's own validator rather than the hand-rolled object it used to be:
  // usePaginatedQuery on the client only points at queries that take this exact
  // shape, and that is what accumulates pages behind the contacts scroll. It is
  // a superset of the old {numItems, cursor}, so existing callers are unaffected.
  // args: {
  //   paginationOpts: v.object({
  //     numItems: v.number(),
  //     cursor: v.union(v.string(), v.null()),
  //   }),
  // },
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { page: [], isDone: true, continueCursor: "" };

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return { page: [], isDone: true, continueCursor: "" };

    return await ctx.db
      .query("contacts")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(paginationOpts);
  },
});

// ── contactCount backfill ───────────────────────────────────────────────────
//
// users.contactCount is maintained incrementally by upsert and deleteInternal
// above, so every row written before that existed carries nothing. This walk
// fills them in. It is safe to run again at any time: each pass recounts a
// user from scratch rather than adjusting what is already there, so it also
// repairs drift from a future mutation that forgets to move the count.
//
// Paged and scheduled rather than looped, so no single transaction goes near
// the 32,000 document scan cap: one page of users per mutation, then one
// mutation per user walking that user's contacts a page at a time.

const USER_PAGE = 200;
const CONTACT_PAGE = 500;

/** Recount contactCount for every user. Run from the Convex dashboard. */
export const startContactCountBackfill = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query("users")
      .paginate({ cursor: cursor ?? null, numItems: USER_PAGE });

    for (const user of page.page) {
      await ctx.scheduler.runAfter(
        0,
        internal.contacts.backfillUserContactCount,
        { userId: user._id }
      );
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.contacts.startContactCountBackfill,
        { cursor: page.continueCursor }
      );
    }
  },
});

/** Recount one user's contacts and write the total to their contactCount. */
export const backfillUserContactCount = internalMutation({
  args: {
    userId: v.id("users"),
    t0: v.optional(v.number()),
    cursor: v.optional(v.string()),
    tally: v.optional(v.number()),
    snapshot: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    // User deleted mid-walk: there is nothing left to count for.
    if (!user) return;

    // First step of this user's walk: fix the cutoff and remember where the
    // count stood, so upserts and deletes landing during the walk are added
    // back at the end rather than overwritten. Same scheme as the mailbox and
    // domain stat rebuilds in platformStats.ts.
    const t0 = args.t0 ?? Date.now();
    const snapshot = args.snapshot ?? (user.contactCount ?? 0);
    let tally = args.tally ?? 0;

    const page = await ctx.db
      .query("contacts")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .paginate({ cursor: args.cursor ?? null, numItems: CONTACT_PAGE });

    for (const contact of page.page) {
      // Rows created at or after the cutoff are the live hooks' to count.
      if (contact._creationTime >= t0) continue;
      tally += 1;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.contacts.backfillUserContactCount,
        { userId: args.userId, t0, cursor: page.continueCursor, tally, snapshot }
      );
      return;
    }

    // Whatever the live hooks moved the count by during the walk is the drift
    // between the snapshot and the count as it stands now. Clamped at 0 so a
    // walk racing a delete cannot leave the field negative.
    const drift = (user.contactCount ?? 0) - snapshot;
    await ctx.db.patch(args.userId, { contactCount: Math.max(0, tally + drift) });
  },
});
