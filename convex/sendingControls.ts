import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { PolicyOverrides } from "./lib/sendPolicy";
import {
  DEFAULT_CATCH_ALL_POLICY,
  DEFAULT_ON_VERIFIER_UNAVAILABLE,
  DEFAULT_UNKNOWN_POLICY,
  VERIFICATION_TTL_DAYS,
} from "./lib/sendPolicy";

/**
 * The kill switch, and the runtime half of the send policy.
 *
 * One row, name = "global". Absent means nothing is paused and every policy
 * falls back to the code default, so the switch works on a database that has
 * never had the row written.
 */

const ROW_NAME = "global";

export async function readControls(ctx: QueryCtx | MutationCtx) {
  return await ctx.db
    .query("sendingControls")
    .withIndex("by_name", (q) => q.eq("name", ROW_NAME))
    .unique();
}

/** Everything the gate needs in one read: paused state plus policy overrides. */
export async function readSendingState(ctx: QueryCtx | MutationCtx): Promise<{
  sendingPaused: boolean;
  pausedReason?: string;
  warmupPaused: boolean;
  overrides: PolicyOverrides;
}> {
  const row = await readControls(ctx);
  return {
    sendingPaused: row?.sendingPaused ?? false,
    pausedReason: row?.pausedReason,
    warmupPaused: row?.warmupPaused ?? false,
    overrides: {
      catchAllPolicy: row?.catchAllPolicy,
      unknownPolicy: row?.unknownPolicy,
      onVerifierUnavailable: row?.onVerifierUnavailable,
      verificationTtlDays: row?.verificationTtlDays,
    },
  };
}

export const getStateInternal = internalQuery({
  args: {},
  handler: async (ctx) => await readSendingState(ctx),
});

/** Dashboard view: current switch position and the policy in force. */
export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const row = await readControls(ctx);
    return {
      sendingPaused: row?.sendingPaused ?? false,
      pausedReason: row?.pausedReason ?? null,
      pausedAt: row?.pausedAt ?? null,
      pausedBy: row?.pausedBy ?? null,
      warmupPaused: row?.warmupPaused ?? false,
      // Both the value in force and whether it is an override, so an operator
      // can see at a glance what has been changed away from the default.
      catchAllPolicy: row?.catchAllPolicy ?? DEFAULT_CATCH_ALL_POLICY,
      catchAllOverridden: row?.catchAllPolicy != null,
      unknownPolicy: row?.unknownPolicy ?? DEFAULT_UNKNOWN_POLICY,
      unknownOverridden: row?.unknownPolicy != null,
      onVerifierUnavailable:
        row?.onVerifierUnavailable ?? DEFAULT_ON_VERIFIER_UNAVAILABLE,
      verificationTtlDays: row?.verificationTtlDays ?? VERIFICATION_TTL_DAYS,
    };
  },
});

async function upsert(
  ctx: MutationCtx,
  fields: Partial<{
    sendingPaused: boolean;
    pausedReason: string | undefined;
    pausedAt: number | undefined;
    pausedBy: string | undefined;
    warmupPaused: boolean;
    catchAllPolicy: "allow" | "block";
    unknownPolicy: "allow" | "block";
    onVerifierUnavailable: "hold" | "send";
    verificationTtlDays: number;
  }>
) {
  const row = await readControls(ctx);
  if (row) {
    await ctx.db.patch(row._id, fields);
    return row._id;
  }
  return await ctx.db.insert("sendingControls", {
    name: ROW_NAME,
    sendingPaused: false,
    ...fields,
  });
}

/**
 * The kill switch.
 *
 * Halting is immediate for anything that has not yet called SES: the gate
 * reads this row on every send. Messages already in flight inside a running
 * action are not recalled, but nothing new is dispatched.
 *
 * Scheduled mail is held, not cancelled. Its Convex job re-arms itself while
 * the switch is on, so lifting it resumes the queue where it stopped rather
 * than requiring the outbox to be rebuilt.
 */
export const setSendingPaused = mutation({
  args: {
    paused: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { paused, reason }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user || user.category !== "admin") {
      throw new Error("Not authorized");
    }

    await upsert(ctx, {
      sendingPaused: paused,
      pausedReason: paused ? (reason ?? "Paused by operator") : undefined,
      pausedAt: paused ? Date.now() : undefined,
      pausedBy: paused ? identity.subject : undefined,
    });

    return { sendingPaused: paused };
  },
});

/** Warmup halts separately: see the schema comment on sendingControls. */
export const setWarmupPaused = mutation({
  args: { paused: v.boolean() },
  handler: async (ctx, { paused }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user || user.category !== "admin") throw new Error("Not authorized");

    await upsert(ctx, { warmupPaused: paused });
    return { warmupPaused: paused };
  },
});

/**
 * Change the verification policy without a deploy.
 *
 * This is the lever described in lib/sendPolicy.ts: flipping catchAllPolicy to
 * "block" is the fastest way to cut the bounce rate if it starts approaching
 * the 5% at which AWS suspends the account.
 */
export const setPolicy = mutation({
  args: {
    catchAllPolicy: v.optional(v.union(v.literal("allow"), v.literal("block"))),
    unknownPolicy: v.optional(v.union(v.literal("allow"), v.literal("block"))),
    onVerifierUnavailable: v.optional(
      v.union(v.literal("hold"), v.literal("send"))
    ),
    verificationTtlDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user || user.category !== "admin") throw new Error("Not authorized");

    if (args.verificationTtlDays !== undefined && args.verificationTtlDays < 1) {
      throw new Error("verificationTtlDays must be at least 1");
    }

    const fields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined) fields[key] = value;
    }
    await upsert(ctx, fields);
    return { ok: true };
  },
});

/** Used by the backfill to halt the queue for the duration of the run. */
export const setSendingPausedInternal = internalMutation({
  args: { paused: v.boolean(), reason: v.optional(v.string()) },
  handler: async (ctx, { paused, reason }) => {
    await upsert(ctx, {
      sendingPaused: paused,
      pausedReason: paused ? (reason ?? "Paused automatically") : undefined,
      pausedAt: paused ? Date.now() : undefined,
    });
  },
});
