import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

/**
 * The signed-in user's row, or null when the request carries no identity or
 * the identity has no users row yet.
 *
 * Every admin-only query in this codebase used to open with its own copy of
 * this lookup (convex/domains.ts, convex/platformWarmupAccounts.ts,
 * convex/jobApplications.ts, convex/sendingControls.ts). New code should call
 * these two instead so there is one place that decides what "admin" means.
 */
export async function currentUserDoc(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

/** True when the caller is signed in and carries the admin category. */
export async function isAdmin(ctx: QueryCtx): Promise<boolean> {
  const user = await currentUserDoc(ctx);
  return user?.category === "admin";
}

/**
 * The calling admin's row, or a throw.
 *
 * Throwing rather than returning null is deliberate for queries whose whole
 * result is privileged: a non-admin who reaches one has typed a URL they were
 * redirected away from, and a thrown query is the honest answer. Queries that
 * are read off a URL parameter any signed-in user could guess return null
 * instead, so the page renders an empty state rather than crashing.
 */
export async function requireAdmin(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await currentUserDoc(ctx);
  if (!user || user.category !== "admin") {
    throw new Error("Admin access required");
  }
  return user;
}
