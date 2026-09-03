import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { describeReason } from "./sendPolicy";

/**
 * The action-side wrapper around convex/sendGate.ts.
 *
 * Send paths call this rather than the gate query directly, because deciding
 * eligibility is only half the job: something has to decide what to do about
 * an address whose verification is missing, and that answer differs by path.
 *
 * An interactive path (compose, a single API send) may wait for a lookup: a
 * person is watching, it is one or two addresses, and returning "we will send
 * this eventually" is a worse answer than a two second pause.
 *
 * A bulk path (the scheduled queue, sequence steps) must never wait. It
 * schedules the lookup and holds the message, which costs the queue one retry
 * interval and costs the send path no latency at all. This is what keeps
 * verification out of the critical path for the 40,000 queued messages.
 */

export type GatePath = "compose" | "scheduled" | "api" | "sequence";

export type GateOutcome = {
  sendingPaused: boolean;
  pausedReason?: string;
  allowed: string[];
  blocked: Array<{ email: string; reason: string; detail?: string }>;
  held: Array<{ email: string; reason: string }>;
};

/**
 * A single line summarising why a send was refused, for an error message.
 *
 * Reasons are put into words here rather than passed through as codes. This
 * string is shown to whoever is composing, and it was reaching them reading
 * "tom@example.com: invalid_address".
 */
export function describeRefusal(outcome: GateOutcome): string {
  const parts: string[] = [];
  for (const block of outcome.blocked) {
    parts.push(`${block.email}: ${describeReason(block.reason)}`);
  }
  for (const hold of outcome.held) {
    parts.push(`${hold.email}: ${describeReason(hold.reason)}`);
  }
  return parts.join("; ");
}

export async function evaluateForSend(
  ctx: ActionCtx,
  args: {
    userId: Id<"users">;
    domainId: Id<"domains">;
    emails: string[];
    path: GatePath;
    mailboxId?: Id<"mailboxes">;
    emailId?: Id<"emails">;
    messageId?: string;
    batchId?: string;
    /** Warmup: platform-owned recipients, no verification needed. */
    skipVerification?: boolean;
    /** Interactive paths only. See the note above. */
    allowInlineVerification?: boolean;
  }
): Promise<GateOutcome> {
  let result = await ctx.runQuery(internal.sendGate.evaluateRecipients, {
    userId: args.userId,
    domainId: args.domainId,
    emails: args.emails,
    skipVerification: args.skipVerification,
  });

  // The kill switch holds the whole message; nothing else to decide.
  if (result.sendingPaused) {
    return {
      sendingPaused: true,
      pausedReason: result.pausedReason,
      allowed: [],
      blocked: [],
      held: result.held,
    };
  }

  if (result.needsVerification.length > 0) {
    if (args.allowInlineVerification) {
      await ctx.runAction(internal.verification.verifyAddresses, {
        emails: result.needsVerification,
        userId: args.userId,
      });
      // Re-read once. A second gap after a completed lookup means the verifier
      // returned "error" for it, and the policy's hold-or-send rule now
      // applies; re-running the lookup would just fail again.
      result = await ctx.runQuery(internal.sendGate.evaluateRecipients, {
        userId: args.userId,
        domainId: args.domainId,
        emails: args.emails,
        skipVerification: args.skipVerification,
      });
    } else {
      // Bulk path: schedule the lookup, hold the message, return immediately.
      await ctx.scheduler.runAfter(
        0,
        internal.verification.verifyAddressesAsync,
        { emails: result.needsVerification, userId: args.userId }
      );
    }
  }

  const outcome: GateOutcome = {
    sendingPaused: false,
    pausedReason: undefined,
    allowed: result.allowed,
    blocked: result.blocked,
    held: result.held,
  };

  // A refusal is recorded whether or not the rest of the message goes out, so
  // a partially blocked campaign still shows which recipients were dropped.
  if (outcome.blocked.length > 0) {
    await ctx.runMutation(internal.sendGate.recordBlocks, {
      userId: args.userId,
      path: args.path,
      blocks: outcome.blocked,
      mailboxId: args.mailboxId,
      emailId: args.emailId,
      messageId: args.messageId,
      batchId: args.batchId,
    });
  }

  return outcome;
}
