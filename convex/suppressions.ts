import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { normalizeAddress } from "./lib/sendPolicy";

/**
 * The suppression list: addresses this account must never mail again.
 *
 * A row here outranks every other check in the gate. A hard bounce or a spam
 * complaint is the receiving server's own verdict, which is stronger evidence
 * than anything a verification API predicts, so a suppressed address is
 * blocked even when a fresh "ok" verification sits in the cache.
 */

export async function findSuppression(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  email: string
) {
  const row = await ctx.db
    .query("suppressions")
    .withIndex("by_user_email", (q) =>
      q.eq("userId", userId).eq("email", normalizeAddress(email))
    )
    .first();
  // A released row is history, not an active block.
  return row && row.releasedAt === undefined ? row : null;
}

/**
 * Record a suppression. Idempotent per (user, address).
 *
 * An existing row is enriched rather than duplicated: a complaint arriving
 * after a hard bounce upgrades the reason, because a complaint is the more
 * serious signal, and later diagnostic detail is filled in if the first event
 * did not carry any.
 */
export async function suppress(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    email: string;
    reason: "hard_bounce" | "complaint" | "manual" | "invalid" | "disposable";
    bounceType?: string;
    bounceSubType?: string;
    diagnosticCode?: string;
    sesMessageId?: string;
  }
): Promise<{ created: boolean }> {
  const email = normalizeAddress(args.email);
  const existing = await ctx.db
    .query("suppressions")
    .withIndex("by_user_email", (q) =>
      q.eq("userId", args.userId).eq("email", email)
    )
    .first();

  if (existing) {
    const patch: Record<string, unknown> = {};
    // A complaint outranks a bounce: it is the signal that actually gets a
    // sending account suspended.
    if (args.reason === "complaint" && existing.reason !== "complaint") {
      patch.reason = "complaint";
    }
    if (args.bounceType && !existing.bounceType) patch.bounceType = args.bounceType;
    if (args.bounceSubType && !existing.bounceSubType) {
      patch.bounceSubType = args.bounceSubType;
    }
    if (args.diagnosticCode && !existing.diagnosticCode) {
      patch.diagnosticCode = args.diagnosticCode;
    }
    if (args.sesMessageId && !existing.sesMessageId) {
      patch.sesMessageId = args.sesMessageId;
    }
    // A fresh hard bounce or complaint re-arms an address an operator had
    // released: the evidence has recurred, so the release was wrong.
    if (
      existing.releasedAt !== undefined &&
      (args.reason === "hard_bounce" || args.reason === "complaint")
    ) {
      patch.releasedAt = undefined;
      patch.releasedReason = undefined;
      patch.createdAt = Date.now();
    }
    if (Object.keys(patch).length > 0) await ctx.db.patch(existing._id, patch);
    return { created: false };
  }

  await ctx.db.insert("suppressions", {
    userId: args.userId,
    email,
    reason: args.reason,
    createdAt: Date.now(),
    bounceType: args.bounceType,
    bounceSubType: args.bounceSubType,
    diagnosticCode: args.diagnosticCode,
    sesMessageId: args.sesMessageId,
  });
  return { created: true };
}

export const suppressInternal = internalMutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    reason: v.union(
      v.literal("hard_bounce"),
      v.literal("complaint"),
      v.literal("manual"),
      v.literal("invalid"),
      v.literal("disposable")
    ),
    bounceType: v.optional(v.string()),
    bounceSubType: v.optional(v.string()),
    diagnosticCode: v.optional(v.string()),
    sesMessageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => await suppress(ctx, args),
});

export const isSuppressedInternal = internalQuery({
  args: { userId: v.id("users"), email: v.string() },
  handler: async (ctx, { userId, email }) => {
    const row = await findSuppression(ctx, userId, email);
    return row ? { reason: row.reason, diagnosticCode: row.diagnosticCode } : null;
  },
});

// ── Dashboard ──

async function currentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
}

/**
 * Page through this account's suppression list, newest first.
 *
 * Paginated rather than collected: an account that has been sending for a
 * while accumulates one row per dead address, and the whole point of the
 * 32,000 document cap is that a list like this must never be read whole.
 */
export const listForCurrentUser = query({
  args: {
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, { paginationOpts }) => {
    const user = await currentUser(ctx);
    if (!user) return { page: [], isDone: true, continueCursor: "" };

    return await ctx.db
      .query("suppressions")
      .withIndex("by_user_created", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(paginationOpts);
  },
});

/** Ask whether one address is currently suppressed for the signed-in user. */
export const checkForCurrentUser = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await currentUser(ctx);
    if (!user) return null;
    const row = await findSuppression(ctx, user._id, email);
    if (!row) return null;
    return {
      reason: row.reason,
      createdAt: row.createdAt,
      bounceSubType: row.bounceSubType ?? null,
      diagnosticCode: row.diagnosticCode ?? null,
    };
  },
});

/**
 * Lift a suppression.
 *
 * The row is marked released rather than deleted, so why the address was
 * blocked and who un-blocked it survives, and so a later bounce can tell that
 * this address has been through here before.
 */
export const release = mutation({
  args: { email: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, { email, reason }) => {
    const user = await currentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const row = await ctx.db
      .query("suppressions")
      .withIndex("by_user_email", (q) =>
        q.eq("userId", user._id).eq("email", normalizeAddress(email))
      )
      .first();
    if (!row) throw new Error("Address is not suppressed");

    await ctx.db.patch(row._id, {
      releasedAt: Date.now(),
      releasedReason: reason ?? "Released by user",
    });
    return { ok: true };
  },
});

/** Manually suppress an address, e.g. after an off-channel opt-out request. */
export const addManual = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const user = await currentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    return await suppress(ctx, {
      userId: user._id,
      email,
      reason: "manual",
    });
  },
});
