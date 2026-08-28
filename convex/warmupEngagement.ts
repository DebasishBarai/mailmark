"use node";

import { DOMParser } from "@xmldom/xmldom";
if (typeof globalThis.DOMParser === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).DOMParser = DOMParser;
}

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { generateWarmupReply } from "./warmupContent";
import { mapWithConcurrency } from "./lib/concurrency";

// Emails engaged with at once. Each one opens its own IMAP session, so this is
// the difference between a round that finishes and a round that runs into the
// action time limit. Well under Gmail's simultaneous connection ceiling.
const ENGAGEMENT_CONCURRENCY = 5;

type EngagementCounts = {
  placements: number;
  opens: number;
  importants: number;
  replies: number;
};

const NO_ENGAGEMENT: EngagementCounts = {
  placements: 0,
  opens: 0,
  importants: 0,
  replies: 0,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function engageWithEmail(ctx: any, email: any): Promise<EngagementCounts> {
  const counts = { ...NO_ENGAGEMENT };

  // The engine writes X-Warmup-Message-Id with this token, which is the part
  // of our own message id before the domain. SES rewrites Message-ID but
  // leaves custom headers alone, so this is the key that actually finds the
  // message in Gmail.
  const warmupToken = String(email.messageId)
    .replace(/^</, "")
    .replace(/@.*$/, "");

  const lookup = {
    messageId: email.messageId,
    sesMessageId: email.sesMessageId ?? undefined,
    warmupToken: warmupToken || undefined,
  };

  // Step 1: Check placement via Gmail API
  const result = await ctx.runAction(internal.warmupGmail.checkPlacement, {
    accountId: email.platformAccountId,
    ...lookup,
  });

  if (result.placement === "unknown") return counts;

  await ctx.runMutation(internal.warmupPool.updateWarmupEmailPlacement, {
    warmupEmailId: email._id,
    placement: result.placement,
  });
  counts.placements++;

  // Step 2: If spam, rescue first
  if (result.placement === "spam") {
    await ctx.runAction(internal.warmupGmail.rescueFromSpam, {
      accountId: email.platformAccountId,
      ...lookup,
    });
    await ctx.runMutation(internal.warmupPool.markWarmupEmailRescued, {
      warmupEmailId: email._id,
    });
  }

  // Step 3: Open simulation (85% of emails)
  if (Math.random() >= 0.85) return counts;

  // The tracking pixel used to be fetched here. It resolves against the emails
  // table, and warmup sends have no row there, so it only ever marked nothing
  // as opened. markWarmupEmailOpened below is what actually records the open.
  //
  // const pixelUrl = `${convexSiteUrl}/track/open/${trackingMsgId}.gif`;
  // try { await fetch(pixelUrl); } catch { /* best effort */ }

  await ctx.runMutation(internal.warmupPool.markWarmupEmailOpened, {
    warmupEmailId: email._id,
  });
  counts.opens++;

  // Step 4: Mark as important (45% of opened emails)
  if (Math.random() < 0.45) {
    await ctx.runAction(internal.warmupGmail.markImportant, {
      accountId: email.platformAccountId,
      ...lookup,
    });
    await ctx.runMutation(internal.warmupPool.markWarmupEmailImportant, {
      warmupEmailId: email._id,
    });
    counts.importants++;
  }

  // Step 5: Reply simulation (25% of opened emails)
  if (Math.random() >= 0.25) return counts;

  const warmup = await ctx.runQuery(internal.warmupPool.getWarmupMailboxById, {
    warmupMailboxId: email.warmupMailboxId,
  });
  if (!warmup) return counts;

  const mailbox = await ctx.runQuery(internal.emails.getMailboxById, {
    mailboxId: warmup.mailboxId,
  });
  if (!mailbox) return counts;

  const accountInfo = await ctx.runQuery(
    internal.platformWarmupAccounts.getAccountById,
    { accountId: email.platformAccountId }
  );
  if (!accountInfo) return counts;

  const senderName = accountInfo.email.split("@")[0];
  const recipientName = mailbox.displayName || mailbox.address;
  const replyContent = generateWarmupReply(email.subject, senderName, recipientName);

  const replyMessageId = await ctx.runAction(internal.warmupGmail.replyViaGmail, {
    accountId: email.platformAccountId,
    originalMessageId: email.messageId,
    to: email.fromAddress,
    subject: replyContent.subject,
    html: replyContent.html,
    warmupEmailId: email.warmupMailboxId.toString(),
  });

  await ctx.runMutation(internal.warmupPool.markWarmupEmailReplied, {
    warmupEmailId: email._id,
    repliedMessageId: replyMessageId,
  });

  // A reply is a warmup email in its own right, arriving in the customer's
  // mailbox from a platform account. It used to be sent and then forgotten:
  // no record of it, and it counted against neither the mailbox's received
  // total nor the sending account's daily quota.
  await ctx.runMutation(internal.warmupPool.createWarmupEmailRecord, {
    warmupMailboxId: email.warmupMailboxId,
    platformAccountId: email.platformAccountId,
    direction: "inbound",
    fromAddress: accountInfo.email,
    toAddress: mailbox.fullAddress,
    messageId: replyMessageId,
    subject: replyContent.subject,
  });
  await ctx.runMutation(internal.warmupPool.incrementReceivedToday, {
    warmupMailboxId: email.warmupMailboxId,
  });
  await ctx.runMutation(
    internal.platformWarmupAccounts.incrementDailySentCount,
    { accountId: email.platformAccountId }
  );

  counts.replies++;
  return counts;
}

export const runEngagementRound = internalAction({
  args: {},
  handler: async (ctx) => {
    const pendingEmails = await ctx.runQuery(
      internal.warmupPool.getRecentOutboundForEngagement,
      {}
    );

    if (pendingEmails.length === 0) return;

    const results = await mapWithConcurrency(
      pendingEmails,
      ENGAGEMENT_CONCURRENCY,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (email: any) => {
        try {
          return await engageWithEmail(ctx, email);
        } catch (error) {
          console.error(`Engagement failed for warmup email ${email._id}:`, error);
          return NO_ENGAGEMENT;
        }
      }
    );

    const total = results.reduce(
      (sum, r) => ({
        placements: sum.placements + r.placements,
        opens: sum.opens + r.opens,
        importants: sum.importants + r.importants,
        replies: sum.replies + r.replies,
      }),
      { ...NO_ENGAGEMENT }
    );

    console.log(
      `Engagement round: ${total.placements} placements checked, ${total.opens} opens, ${total.importants} marked important, ${total.replies} replies`
    );
  },
});
