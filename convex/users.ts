import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { isAdmin, requireAdmin } from "./lib/admin";
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
    polarCustomerId: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"users">> => {
    const userId = await ctx.db.insert("users", {
      clerkId: args.subject,
      email: args.email ?? "",
      name: args.name,
      imageUrl: args.imageUrl,
      polarCustomerId: args.polarCustomerId,
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
      // Existing user - update profile fields only (no Polar API call)
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

    // New user - create a Polar customer first
    const polarResponse = await fetch(`${process.env.POLAR_BASE_URL}/v1/customers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: identity.email,
        name: identity.name || "Anonymous",
        external_id: identity.subject,
      }),
    });

    if (!polarResponse.ok) {
      const errorText = await polarResponse.text();
      throw new Error(`Failed to create Polar customer: ${errorText}`);
    }

    const polarCustomer = await polarResponse.json();

    // Old: returned the doc directly
    // return await ctx.runMutation(internal.users.createUser, {
    const user = await ctx.runMutation(internal.users.createUser, {
      subject: identity.subject,
      email: identity.email,
      name: identity.name,
      imageUrl: identity.pictureUrl,
      polarCustomerId: polarCustomer.id,
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

// ── Admin: user directory ──
//
// Backs /admin/users and the "open this user's dashboard" flow. Nothing here
// mutates: an admin reads what the user reads, and the user's own session is
// untouched.

/** How many rows the directory shows when no search term is typed. Bounded so
 *  the query stays a small range read of the by_creation_time index rather
 *  than a collect of the whole users table. */
const USER_DIRECTORY_PAGE_SIZE = 50;
/** Cap on search results, for the same reason. */
const USER_SEARCH_LIMIT = 25;

type AdminUserRow = {
  id: Id<"users">;
  email: string;
  name?: string;
  imageUrl?: string;
  category: "beta" | "normal" | "admin";
  createdAt: number;
  contactCount: number;
  recipientCount: number;
};

function toAdminUserRow(user: Doc<"users">): AdminUserRow {
  return {
    id: user._id,
    email: user.email,
    name: user.name,
    imageUrl: user.imageUrl,
    category: user.category ?? "normal",
    createdAt: user._creationTime,
    contactCount: user.contactCount ?? 0,
    recipientCount: user.recipientCount ?? 0,
  };
}

/**
 * The newest accounts, or the accounts matching a search term. Admin only.
 *
 * A blank search returns the most recent signups, which is the list an admin
 * answering a support mail usually wants. A term goes through the email search
 * index, so finding a six month old account does not mean reading every row
 * created since.
 */
export const listAllForAdmin = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, { search }): Promise<AdminUserRow[]> => {
    await requireAdmin(ctx);

    const term = (search ?? "").trim();

    if (term.length === 0) {
      const recent = await ctx.db
        .query("users")
        .withIndex("by_creation_time")
        .order("desc")
        .take(USER_DIRECTORY_PAGE_SIZE);
      return recent.map(toAdminUserRow);
    }

    const matches = await ctx.db
      .query("users")
      .withSearchIndex("search_email", (q) => q.search("email", term))
      .take(USER_SEARCH_LIMIT);

    return matches.map(toAdminUserRow);
  },
});

/**
 * One user's profile, for the header of the admin's read only view of their
 * dashboard. Admin only.
 *
 * Returns null rather than throwing for a non-admin or a missing id: the page
 * that reads this takes the id straight off the URL, so a bad or stale id must
 * render an empty state rather than crash the route.
 */
export const getForAdmin = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<AdminUserRow | null> => {
    if (!(await isAdmin(ctx))) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    return toAdminUserRow(user);
  },
});
