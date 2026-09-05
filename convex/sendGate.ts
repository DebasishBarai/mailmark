import { v } from "convex/values";
import { query, internalQuery, internalMutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { readSendingState } from "./sendingControls";
import { findSuppression } from "./suppressions";
import {
  BLOCK_REASONS,
  HOLD_REASONS,
  decideForResult,
  effectivePolicy,
  isPlausibleAddress,
  normalizeAddress,
  type VerificationResult,
} from "./lib/sendPolicy";

/**
 * The single eligibility gate. Every path that reaches SES goes through here.
 *
 * There are three such paths and they had drifted apart: compose and the API
 * path did a DNS-level check and consulted unsubscribes only when a batchId
 * happened to be set, while sendScheduledEmail — the path that will deliver
 * all 40,000+ queued messages — checked nothing at all, because verification
 * ran when the message was *scheduled*, up to three weeks earlier. Sequence
 * steps reach SES through the API path without a batchId, so they never
 * consulted unsubscribes either.
 *
 * This module is deliberately a query, not an action: evaluating a recipient
 * reads cached state only and performs no network I/O, so it can sit in front
 * of a send without adding API latency to it. Addresses whose verification is
 * missing or stale come back in `needsVerification`, and the caller decides
 * whether to hold the message while a lookup is scheduled or, on an
 * interactive path, wait for one.
 *
 * Check order matters and is fixed:
 *   1. kill switch      — an operator halt outranks everything, and so does
 *                         the per-domain reputation brake, which reports
 *                         itself through the same two fields
 *   2. suppression      — the receiving server's own verdict, per goal 1
 *   3. unsubscribe      — the recipient's own instruction, honoured across
 *                         every domain the account owns
 *   4. verification     — our prediction, the weakest of the four
 */

export type RecipientVerdict = {
  email: string;
  decision: "allow" | "block" | "hold";
  reason?: string;
  detail?: string;
};

export type GateResult = {
  sendingPaused: boolean;
  pausedReason?: string;
  allowed: string[];
  blocked: Array<{ email: string; reason: string; detail?: string }>;
  held: Array<{ email: string; reason: string }>;
  needsVerification: string[];
};

const evaluateArgs = {
  userId: v.id("users"),
  domainId: v.id("domains"),
  emails: v.array(v.string()),
  // Warmup sends to platform-controlled mailboxes: the addresses are ours, we
  // know they exist, and paying a verifier for them is waste. They still pass
  // through the gate so the kill switch and suppression apply.
  skipVerification: v.optional(v.boolean()),
};

/**
 * Decide, for each address, whether this account may send to it right now.
 *
 * Reads only: safe to call from any path, and it never triggers a paid lookup.
 */
export const evaluateRecipients = internalQuery({
  args: evaluateArgs,
  handler: async (ctx, args): Promise<GateResult> => {
    const state = await readSendingState(ctx);
    const policy = effectivePolicy(state.overrides);
    const now = Date.now();

    // The per-domain brake, set by convex/reputationGuard.ts when this
    // domain's complaint or bounce rate crosses the threshold. It reports
    // itself through the same two fields as the platform kill switch, so every
    // caller that already handles a paused send handles this one too: the
    // message is held, the outbox job re-arms, and nothing is dropped.
    const domain = await ctx.db.get(args.domainId);
    const domainPaused = domain?.sendingPausedAt != null;

    const sendingPaused = state.sendingPaused || domainPaused;
    const pausedReason = state.sendingPaused
      ? state.pausedReason
      : (domain?.sendingPausedReason ??
        (domainPaused ? "Sending from this domain is paused" : undefined));

    const result: GateResult = {
      sendingPaused,
      pausedReason,
      allowed: [],
      blocked: [],
      held: [],
      needsVerification: [],
    };

    // The kill switch stops the whole message rather than being decided per
    // recipient: there is nothing address-specific about it, and holding the
    // message whole is what lets the queue resume where it stopped.
    if (sendingPaused) {
      for (const raw of args.emails) {
        result.held.push({
          email: normalizeAddress(raw),
          reason: HOLD_REASONS.sendingPaused,
        });
      }
      return result;
    }

    // Every domain this account owns, read once rather than per recipient.
    //
    // An opt-out is checked against all of them, not just the sending domain.
    // Unsubscribes hang off a domain, so somebody who used the unsubscribe
    // link in a message from one of an account's domains stayed perfectly
    // mailable from its others, and the next campaign from a sibling domain
    // reached them anyway. From the recipient's side the unsubscribe simply
    // did not work, and the button they reach for after that is the one that
    // reports spam. Suppression has always been account-wide for the same
    // reason; this brings the recipient's own instruction in line with it.
    const accountDomainIds = (
      await ctx.db
        .query("domains")
        .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
        .collect()
    ).map((d) => d._id);
    // Defensive: an account whose domain rows have gone missing should still
    // have its opt-outs honoured on the domain it is sending from.
    if (!accountDomainIds.some((id) => id === args.domainId)) {
      accountDomainIds.push(args.domainId);
    }

    // De-duplicate first: a compose with the same address in To and Cc should
    // cost one of each lookup, not two.
    const seen = new Set<string>();

    for (const raw of args.emails) {
      const email = normalizeAddress(raw);
      if (seen.has(email)) continue;
      seen.add(email);

      if (!isPlausibleAddress(email)) {
        result.blocked.push({
          email,
          reason: BLOCK_REASONS.malformedAddress,
          detail: "Not a syntactically valid address",
        });
        continue;
      }

      // 2. Suppression. Outranks everything below, including a fresh "ok".
      const suppression = await findSuppression(ctx, args.userId, email);
      if (suppression) {
        const reason =
          suppression.reason === "complaint"
            ? BLOCK_REASONS.suppressedComplaint
            : suppression.reason === "hard_bounce"
              ? BLOCK_REASONS.suppressedHardBounce
              : suppression.reason === "invalid"
                ? BLOCK_REASONS.invalidAddress
                : suppression.reason === "disposable"
                  ? BLOCK_REASONS.disposableAddress
                  : BLOCK_REASONS.suppressedManual;
        result.blocked.push({
          email,
          reason,
          detail: suppression.diagnosticCode ?? suppression.bounceSubType,
        });
        continue;
      }

      // 3. Unsubscribe. Previously consulted only when a batchId was set,
      // which left every sequence step and every scheduled send free to mail
      // people who had opted out. Now checked across every domain the account
      // owns, per the comment on accountDomainIds above.
      //
      // Old, single domain:
      // const unsubscribed = await ctx.db
      //   .query("unsubscribes")
      //   .withIndex("by_domain_email", (q) =>
      //     q.eq("domainId", args.domainId).eq("email", email)
      //   )
      //   .first();
      let unsubscribed: Doc<"unsubscribes"> | null = null;
      for (const domainId of accountDomainIds) {
        unsubscribed = await ctx.db
          .query("unsubscribes")
          .withIndex("by_domain_email", (q) =>
            q.eq("domainId", domainId).eq("email", email)
          )
          .first();
        if (unsubscribed) break;
      }
      if (unsubscribed) {
        result.blocked.push({
          email,
          reason: BLOCK_REASONS.unsubscribed,
          detail: unsubscribed.source,
        });
        continue;
      }

      if (args.skipVerification) {
        result.allowed.push(email);
        continue;
      }

      // 4. Verification, from cache only.
      const cached = await ctx.db
        .query("emailVerifications")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();

      // A row with no `result` came from the old DNS-only path. It tells us
      // nothing about the mailbox — every address that hard bounced with
      // "mailbox does not exist" had one — so it is treated as unverified.
      const fresh =
        cached &&
        cached.result != null &&
        cached.result !== "error" &&
        (cached.expiresAt ?? cached.checkedAt + policy.verificationTtlMs) > now;

      if (!fresh) {
        // Retry the lookup either way: this is how an outage recovers on its
        // own without anybody re-queueing anything.
        result.needsVerification.push(email);

        // An "error" row means a lookup was actually attempted and the
        // verifier could not answer. That is the outage case, and it is the
        // one the onVerifierUnavailable policy exists to decide, so it is run
        // through decideForResult rather than being held unconditionally.
        //
        // Holding it unconditionally, which is what this did before, made the
        // policy's "send" setting unreachable: an operator could set it during
        // an outage and nothing would change, because an error row never got
        // as far as the policy.
        //
        // An address with no row at all is different and is always held. We
        // have not tried yet, so there is nothing to fail open about.
        if (cached && cached.result === "error") {
          const outageVerdict = decideForResult("error", policy);
          if (outageVerdict.decision === "allow") {
            result.allowed.push(email);
          } else {
            // recordResults stores the failure text in `reason`, so a hold
            // caused by a missing key can say so instead of blaming an API
            // that is actually healthy.
            const notConfigured = cached.reason === "not_configured";
            result.held.push({
              email,
              reason: notConfigured
                ? HOLD_REASONS.verifierNotConfigured
                : (outageVerdict.reason ?? HOLD_REASONS.verifierUnavailable),
            });
          }
          continue;
        }

        result.held.push({
          email,
          reason: HOLD_REASONS.awaitingVerification,
        });
        continue;
      }

      const verdict = decideForResult(
        cached!.result as VerificationResult,
        policy
      );
      if (verdict.decision === "allow") {
        result.allowed.push(email);
      } else if (verdict.decision === "block") {
        result.blocked.push({
          email,
          reason: verdict.reason!,
          detail: cached!.subResult ?? cached!.result ?? undefined,
        });
      } else {
        result.held.push({ email, reason: verdict.reason! });
      }
    }

    return result;
  },
});

/**
 * Record refusals so a blocked send stays queryable with its reason.
 *
 * Called from every path that the gate turns away. Nothing here deletes: a
 * blocked message keeps its emails row, gains deliveryStatus "blocked", and
 * gets one sendBlocks row per refused recipient.
 */
export const recordBlocks = internalMutation({
  args: {
    userId: v.id("users"),
    path: v.union(
      v.literal("compose"),
      v.literal("scheduled"),
      v.literal("api"),
      v.literal("sequence")
    ),
    blocks: v.array(
      v.object({
        email: v.string(),
        reason: v.string(),
        detail: v.optional(v.string()),
      })
    ),
    mailboxId: v.optional(v.id("mailboxes")),
    emailId: v.optional(v.id("emails")),
    messageId: v.optional(v.string()),
    batchId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const blockedAt = Date.now();
    for (const block of args.blocks) {
      await ctx.db.insert("sendBlocks", {
        userId: args.userId,
        email: normalizeAddress(block.email),
        reason: block.reason,
        detail: block.detail,
        path: args.path,
        blockedAt,
        mailboxId: args.mailboxId,
        emailId: args.emailId,
        messageId: args.messageId,
        batchId: args.batchId,
      });
    }
    return { recorded: args.blocks.length };
  },
});

// ── Dashboard reads ──

/**
 * Blocked sends for the signed-in user, newest first.
 *
 * Paginated: this table gains a row per refused recipient and is expected to
 * be large after the backfill, so it must never be collected whole.
 */
export const listBlocksForCurrentUser = query({
  args: {
    paginationOpts: v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    }),
  },
  handler: async (ctx, { paginationOpts }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { page: [], isDone: true, continueCursor: "" };

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return { page: [], isDone: true, continueCursor: "" };

    return await ctx.db
      .query("sendBlocks")
      .withIndex("by_user_blocked_at", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(paginationOpts);
  },
});
