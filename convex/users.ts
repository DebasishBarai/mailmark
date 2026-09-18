import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { countCreated, userBuckets } from "./lib/counters";

export const getUser = internalQuery({
  args: { subject: v.string() },
  handler: async (ctx, args): Promise<Doc<"users"> | null> => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.subject))
      .unique();
  },
});

export const createUser = internalMutation({
  args: {
    subject: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    // Old: polarCustomerId: v.string(), supplied by a Polar API call that
    // addUser made before this mutation. Dodo needs no pre-created customer,
    // so the id is learned from the first subscription webhook instead.
  },
  handler: async (ctx, args): Promise<Doc<"users">> => {
    const userId = await ctx.db.insert("users", {
      clerkId: args.subject,
      email: args.email ?? "",
      name: args.name,
      imageUrl: args.imageUrl,
      category: "normal",
    });
    const created = (await ctx.db.get(userId))!;
    await countCreated(ctx, userBuckets(created));
    return created;
  },
});

export const updateUserProfile = internalMutation({
  args: {
    subject: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Doc<"users">> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.subject))
      .unique();

    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      email: args.email ?? user.email,
      name: args.name ?? user.name,
      imageUrl: args.imageUrl ?? user.imageUrl,
    });

    return (await ctx.db.get(user._id))!;
  },
});

// The client needs to know whether this call created the user or just refreshed
// an existing profile: that is the authoritative "trial started" signal, and it
// gates the Google Ads signup conversion. `isNew` is true on exactly one call
// per user, the first one ever.
export const addUser = action({
  args: {},
  // Old return type, before the isNew flag:
  // handler: async (ctx): Promise<Doc<"users"> | null | undefined> => {
  handler: async (ctx): Promise<{ user: Doc<"users">; isNew: boolean }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    // Check if user already exists
    const existingUser = await ctx.runQuery(internal.users.getUser, {
      subject: identity.subject,
    });

    if (existingUser) {
      // Existing user - update profile fields only
      // Old: returned the doc directly
      // return await ctx.runMutation(internal.users.updateUserProfile, {
      const user = await ctx.runMutation(internal.users.updateUserProfile, {
        subject: identity.subject,
        email: identity.email,
        name: identity.name,
        imageUrl: identity.pictureUrl,
      });
      return { user, isNew: false };
    }

    // New user. Nothing is called out to the payment provider here any more.
    //
    // Old: this POSTed to Polar /v1/customers first and threw if that failed,
    // so a Polar outage meant no Convex user row was created at all and the
    // person could not use the product until their next visit retried. Dodo
    // accepts an inline customer at checkout and returns a customer id, so the
    // id is recorded by the first subscription webhook instead and signup no
    // longer depends on the payment provider being up.
    const user = await ctx.runMutation(internal.users.createUser, {
      subject: identity.subject,
      email: identity.email,
      name: identity.name,
      imageUrl: identity.pictureUrl,
    });
    return { user, isNew: true };
  },
});

export const updatePreferences = mutation({
  args: {
    prefTheme: v.optional(v.string()),
    prefDensity: v.optional(v.string()),
    prefWallpaper: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const patch: Record<string, string | undefined> = {};
    if (args.prefTheme !== undefined) patch.prefTheme = args.prefTheme;
    if (args.prefDensity !== undefined) patch.prefDensity = args.prefDensity;
    if (args.prefWallpaper !== undefined) patch.prefWallpaper = args.prefWallpaper;

    await ctx.db.patch(user._id, patch);
  },
});

/**
 * Stamps the Google Ads trial-signup conversion as reported for the calling
 * user. Idempotent: the first stamp wins, so a duplicate call from a second tab
 * or a remount cannot move the timestamp.
 *
 * The client calls this only after gtag has accepted the event. Until then the
 * field stays absent and the conversion is still owed, which is what makes a
 * lost fire recoverable on the user's next visit.
 */
export const markSignupConversionReported = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");
    if (user.signupConversionReportedAt !== undefined) return;

    await ctx.db.patch(user._id, { signupConversionReportedAt: Date.now() });
  },
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
  },
});
