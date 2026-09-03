import { v } from "convex/values";
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
    await ctx.db.delete(contactId);
    await countRemoved(ctx, contactBuckets());
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
