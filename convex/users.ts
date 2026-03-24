import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";

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
    });
    return (await ctx.db.get(userId))!;
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

export const addUser = action({
  args: {},
  handler: async (ctx): Promise<Doc<"users"> | null | undefined> => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) throw new Error("Not authenticated");

    // Check if user already exists
    const existingUser = await ctx.runQuery(internal.users.getUser, {
      subject: identity.subject,
    });

    if (existingUser) {
      // Existing user - update profile fields only (no Polar API call)
      return await ctx.runMutation(internal.users.updateUserProfile, {
        subject: identity.subject,
        email: identity.email,
        name: identity.name,
        imageUrl: identity.pictureUrl,
      });
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

    return await ctx.runMutation(internal.users.createUser, {
      subject: identity.subject,
      email: identity.email,
      name: identity.name,
      imageUrl: identity.pictureUrl,
      polarCustomerId: polarCustomer.id,
    });
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
