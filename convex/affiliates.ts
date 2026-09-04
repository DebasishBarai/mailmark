import { paginationOptsValidator } from "convex/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const COMMISSION_CENTS: Record<string, number> = {
  starter: 300,   // $3.00
  pro: 750,       // $7.50
  business: 2250, // $22.50
};

function generateCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

/** Apply for the affiliate program */
export const apply = mutation({
  args: {
    payoutEmail: v.string(),
    website: v.optional(v.string()),
    audienceDescription: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const existing = await ctx.db
      .query("affiliates")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (existing) throw new Error("You have already applied to the affiliate program");

    // Generate a unique referral code
    let code = generateCode();
    while (
      await ctx.db
        .query("affiliates")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first()
    ) {
      code = generateCode();
    }

    await ctx.db.insert("affiliates", {
      userId: user._id,
      code,
      status: "pending",
      payoutEmail: args.payoutEmail,
      website: args.website,
      audienceDescription: args.audienceDescription,
      totalEarnedCents: 0,
      totalPaidCents: 0,
    });
  },
});

/** Get the current user's affiliate record */
export const getMyAffiliate = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;

    return await ctx.db
      .query("affiliates")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
  },
});

/** Get the current user's referrals */
// Old: collect every referral the affiliate has ever had. Referrals only
// accumulate, so a successful affiliate's dashboard read grew without bound.
// Replaced by getMyReferralsPage below; the headline counts now come from the
// affiliate's own totalReferrals and activeReferrals.
//
// export const getMyReferrals = query({
//   args: {},
//   handler: async (ctx) => {
//     const identity = await ctx.auth.getUserIdentity();
//     if (!identity) return [];
////     const user = await ctx.db
//       .query("users")
//       .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
//       .unique();
//     if (!user) return [];
////     const affiliate = await ctx.db
//       .query("affiliates")
//       .withIndex("by_userId", (q) => q.eq("userId", user._id))
//       .first();
//     if (!affiliate) return [];
////     return await ctx.db
//       .query("referrals")
//       .withIndex("by_affiliateId", (q) => q.eq("affiliateId", affiliate._id))
//       .order("desc")
//       .collect();
//   },
// });
//
/** The current user's referrals, newest first, one page at a time. */
export const getMyReferralsPage = query({
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

    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!affiliate) return empty;

    return await ctx.db
      .query("referrals")
      .withIndex("by_affiliateId", (q) => q.eq("affiliateId", affiliate._id))
      .order("desc")
      .paginate(paginationOpts);
  },
});

/** Get the current user's payout history */
export const getMyPayouts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!affiliate) return [];

    return await ctx.db
      .query("affiliatePayouts")
      .withIndex("by_affiliateId", (q) => q.eq("affiliateId", affiliate._id))
      .order("desc")
      .collect();
  },
});

/**
 * Attribute a referral - called client-side after auth when the ref cookie is present.
 * Silently no-ops if the code is invalid, not approved, or already attributed.
 */
export const attributeReferral = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();

    // Silently skip: invalid code, not approved, or self-referral
    if (!affiliate || affiliate.status !== "approved") return;
    if (affiliate.userId === user._id) return;

    // Already attributed
    const existing = await ctx.db
      .query("referrals")
      .withIndex("by_referredUserId", (q) => q.eq("referredUserId", user._id))
      .first();
    if (existing) return;

    await ctx.db.insert("referrals", {
      affiliateId: affiliate._id,
      referredUserId: user._id,
      commissionCents: 0,
      status: "pending",
    });

    // A new referral starts pending, so only the total moves.
    await ctx.db.patch(affiliate._id, {
      totalReferrals: (affiliate.totalReferrals ?? 0) + 1,
    });
  },
});

// ─── Internal (called from Polar webhook) ────────────────────────────────────

export const getReferralByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("referrals")
      .withIndex("by_referredUserId", (q) => q.eq("referredUserId", args.userId))
      .first();
  },
});

/** Record commission when a referred user's subscription becomes active */
export const recordCommission = internalMutation({
  args: {
    referredUserId: v.id("users"),
    plan: v.union(v.literal("starter"), v.literal("pro"), v.literal("business")),
    polarSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const referral = await ctx.db
      .query("referrals")
      .withIndex("by_referredUserId", (q) => q.eq("referredUserId", args.referredUserId))
      .first();
    if (!referral) return;

    const commissionCents = COMMISSION_CENTS[args.plan] ?? 0;
    const wasActive = referral.status === "active";

    await ctx.db.patch(referral._id, {
      plan: args.plan,
      commissionCents,
      status: "active",
      polarSubscriptionId: args.polarSubscriptionId,
    });

    const affiliate = await ctx.db.get(referral.affiliateId);
    if (affiliate) {
      await ctx.db.patch(affiliate._id, {
        totalEarnedCents: affiliate.totalEarnedCents + commissionCents,
        activeReferrals:
          (affiliate.activeReferrals ?? 0) + (wasActive ? 0 : 1),
      });
    }
  },
});

/** Cancel commission when a referred user's subscription is canceled */
export const cancelCommission = internalMutation({
  args: { polarSubscriptionId: v.string() },
  handler: async (ctx, args) => {
    const referral = await ctx.db
      .query("referrals")
      .withIndex("by_polarSubscriptionId", (q) =>
        q.eq("polarSubscriptionId", args.polarSubscriptionId)
      )
      .first();

    if (!referral || referral.status !== "active") return;

    const affiliate = await ctx.db.get(referral.affiliateId);
    if (affiliate) {
      await ctx.db.patch(affiliate._id, {
        totalEarnedCents: Math.max(0, affiliate.totalEarnedCents - referral.commissionCents),
        activeReferrals: Math.max(0, (affiliate.activeReferrals ?? 0) - 1),
      });
    }

    await ctx.db.patch(referral._id, { status: "canceled" });
  },
});

// ── Referral count backfill ─────────────────────────────────────────────────
//
// affiliates.totalReferrals and activeReferrals are maintained incrementally by
// attributeReferral, recordCommission and cancelCommission above, so every
// affiliate row written before they existed carries nothing. This walk fills
// them in. It is safe to run again at any time: each pass recounts an affiliate
// from scratch rather than adjusting what is already there, so it also repairs
// drift from a future mutation that forgets to move a count.
//
// Paged and scheduled rather than looped, so no single transaction goes near
// the document scan cap: one page of affiliates per mutation, then one mutation
// per affiliate walking that affiliate's referrals a page at a time.

const AFFILIATE_PAGE = 200;
const REFERRAL_PAGE = 500;

/** Recount referrals for every affiliate. Run from the Convex dashboard. */
export const startAffiliateCountBackfill = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db
      .query("affiliates")
      .paginate({ cursor: cursor ?? null, numItems: AFFILIATE_PAGE });

    for (const affiliate of page.page) {
      await ctx.scheduler.runAfter(
        0,
        internal.affiliates.backfillAffiliateCounts,
        { affiliateId: affiliate._id }
      );
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.affiliates.startAffiliateCountBackfill,
        { cursor: page.continueCursor }
      );
    }
  },
});

/** Recount one affiliate's referrals and write the totals to their row. */
export const backfillAffiliateCounts = internalMutation({
  args: {
    affiliateId: v.id("affiliates"),
    cursor: v.optional(v.string()),
    total: v.optional(v.number()),
    active: v.optional(v.number()),
  },
  handler: async (ctx, { affiliateId, cursor, total, active }) => {
    const page = await ctx.db
      .query("referrals")
      .withIndex("by_affiliateId", (q) => q.eq("affiliateId", affiliateId))
      .paginate({ cursor: cursor ?? null, numItems: REFERRAL_PAGE });

    let nextTotal = total ?? 0;
    let nextActive = active ?? 0;
    for (const referral of page.page) {
      nextTotal++;
      if (referral.status === "active") nextActive++;
    }

    if (page.isDone) {
      await ctx.db.patch(affiliateId, {
        totalReferrals: nextTotal,
        activeReferrals: nextActive,
      });
      return;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.affiliates.backfillAffiliateCounts,
      {
        affiliateId,
        cursor: page.continueCursor,
        total: nextTotal,
        active: nextActive,
      }
    );
  },
});
