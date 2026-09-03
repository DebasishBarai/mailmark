"use node";

import { DOMParser } from "@xmldom/xmldom";
if (typeof globalThis.DOMParser === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).DOMParser = DOMParser;
}

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { generateWarmupEmail } from "./warmupContent";
import { SendEmailCommand } from "@aws-sdk/client-sesv2";
import { getPlatformAwsClients, getAwsClientsForAccount } from "./lib/awsClients";
import { mapWithConcurrency } from "./lib/concurrency";
import type { Doc } from "./_generated/dataModel";

// Mailboxes worked on at once. The round used to walk them one at a time with
// an SES call per email inside, which only gets slower as the pool grows.
const MAILBOX_CONCURRENCY = 5;

// The warmup day rolls over at 06:30 UTC, when the advance cron resets the
// daily counters.
const DAY_ROLLOVER_MINUTES = 6 * 60 + 30;

// Chance a round sits out entirely. Pacing alone would put a mailbox on a
// metronome; real senders have gaps. The allowance below is cumulative, so a
// skipped round is made up by the next one rather than lost.
const ROUND_SKIP_CHANCE = 0.2;

// How far through the warmup day we are, 0 at the rollover and approaching 1
// just before the next one.
function dayProgress(now: number): number {
  const at = new Date(now);
  const minutesUTC = at.getUTCHours() * 60 + at.getUTCMinutes();
  const elapsed = (minutesUTC - DAY_ROLLOVER_MINUTES + 1440) % 1440;
  return elapsed / 1440;
}

// How many more emails this direction may send right now.
//
// Rounds fire every 30 minutes and used to send 2-3 each until the daily limit
// ran out, so a mailbox spent its whole day in the first four hours after the
// counter reset and then went silent. Real mailboxes do not send in one block.
// Holding sends to the share of the day that has elapsed spreads the same
// volume across all of it.
function pacedAllowance(dailyLimit: number, sentSoFar: number, now: number): number {
  const allowedByNow = Math.ceil(dailyLimit * dayProgress(now));
  return Math.max(0, allowedByNow - sentSoFar);
}

async function getAwsClientsForMailbox(
  ctx: { runQuery: (ref: any, args: any) => Promise<any> },
  mailboxId: any
) {
  const mailbox = await ctx.runQuery(internal.emails.getMailboxWithDomain, { mailboxId });
  if (!mailbox) throw new Error("Mailbox not found");
  if (mailbox.awsAccount) {
    return { aws: await getAwsClientsForAccount(mailbox.awsAccount), mailbox };
  }
  return { aws: getPlatformAwsClients(), mailbox };
}

// One mailbox's turn in a round. Split out of the loop so mailboxes can be
// worked on concurrently, and so the AWS clients resolve once per mailbox
// instead of once per recipient: with BYO-AWS that lookup is an AssumeRole.
async function runRoundForMailbox(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  wmb: Doc<"warmupMailboxes">,
  availableAccounts: Doc<"platformWarmupAccounts">[]
): Promise<{ outbound: number; inbound: number }> {
  let outbound = 0;
  let inbound = 0;

  if (Math.random() < ROUND_SKIP_CHANCE) return { outbound, inbound };

  const now = Date.now();

  const outboundCount = Math.min(
    Math.floor(Math.random() * 2) + 2, // 2-3 emails per round
    wmb.dailyLimit - wmb.sentToday,
    availableAccounts.length,
    pacedAllowance(wmb.dailyLimit, wmb.sentToday, now)
  );
  const inboundCount = Math.min(
    Math.floor(Math.random() * 2) + 1, // 1-2 emails per round
    wmb.dailyLimit - wmb.receivedToday,
    availableAccounts.length,
    pacedAllowance(wmb.dailyLimit, wmb.receivedToday, now)
  );

  if (outboundCount <= 0 && inboundCount <= 0) return { outbound, inbound };

  // Resolved once for both directions, and only once we know there is
  // something to send.
  let aws;
  let mailbox;
  try {
    ({ aws, mailbox } = await getAwsClientsForMailbox(ctx, wmb.mailboxId));
  } catch (error) {
    console.error(`Warmup round: cannot resolve mailbox ${wmb.mailboxId}:`, error);
    return { outbound, inbound };
  }

  const pickAccounts = (count: number) =>
    [...availableAccounts].sort(() => Math.random() - 0.5).slice(0, count);

  // --- Outbound: user mailbox -> platform Gmail accounts ---
  for (const account of pickAccounts(outboundCount)) {
    try {
      const senderName = mailbox.displayName || mailbox.address;
      const recipientName = account.email.split("@")[0];
      const content = generateWarmupEmail(senderName, recipientName);

      const messageId = `warmup-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const convexSiteUrl = process.env.CONVEX_SITE_URL ?? "";
      const trackingPixel = `<img src="${convexSiteUrl}/track/open/${messageId}.gif" width="1" height="1" style="display:none" alt="" />`;

      const fromAddress = mailbox.displayName
        ? `${mailbox.displayName} <${mailbox.fullAddress}>`
        : mailbox.fullAddress;

      const rawEmail = [
        `From: ${fromAddress}`,
        `To: ${account.email}`,
        `Subject: ${content.subject}`,
        `Date: ${new Date().toUTCString()}`,
        `Message-ID: <${messageId}@${mailbox.domain}>`,
        `X-Warmup-Id: ${wmb._id}`,
        // SES overwrites Message-ID on raw sends, so the id above never
        // reaches Gmail and cannot be searched for. SES leaves custom X-
        // headers alone, so this one is how the engagement round finds the
        // message again. See findMessageSequence in warmupGmail.
        `X-Warmup-Message-Id: ${messageId}`,
        `Content-Type: text/html; charset=UTF-8`,
        "",
        content.html + trackingPixel,
      ].join("\r\n");

      // Keep the SES-assigned id: bounce and complaint notifications arrive
      // keyed on it, and nothing else ties one back to this row.
      const sesResponse = await aws.sesv2.send(
        new SendEmailCommand({
          FromEmailAddress: fromAddress,
          Destination: { ToAddresses: [account.email] },
          ConfigurationSetName: "devmail-sending",
          Content: { Raw: { Data: new TextEncoder().encode(rawEmail) } },
        })
      );

      await ctx.runMutation(internal.warmupPool.createWarmupEmailRecord, {
        warmupMailboxId: wmb._id,
        platformAccountId: account._id,
        direction: "outbound",
        fromAddress: mailbox.fullAddress,
        toAddress: account.email,
        messageId: `<${messageId}@${mailbox.domain}>`,
        subject: content.subject,
        sesMessageId: sesResponse.MessageId,
      });

      await ctx.runMutation(internal.warmupPool.incrementSentToday, {
        warmupMailboxId: wmb._id,
      });
      await ctx.runMutation(
        internal.platformWarmupAccounts.incrementDailyReceivedCount,
        { accountId: account._id }
      );

      await ctx.runMutation(internal.warmupPool.recordSendSuccess, {
        warmupMailboxId: wmb._id,
      });

      outbound++;
    } catch (error) {
      console.error(
        `Warmup outbound failed for mailbox ${wmb.mailboxId} -> ${account.email}:`,
        error
      );
      // A mailbox whose sends all fail (SES still in sandbox, sending
      // disabled, identity unusable) used to look exactly like one warming
      // perfectly: active, day climbing, health 100, nothing sent. Record it
      // so the customer and the dashboard can see it.
      await ctx.runMutation(internal.warmupPool.recordSendFailure, {
        warmupMailboxId: wmb._id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // --- Inbound: platform Gmail accounts -> user mailbox ---
  for (const account of pickAccounts(inboundCount)) {
    try {
      const senderName = account.email.split("@")[0];
      const recipientName = mailbox.displayName || mailbox.address;
      const content = generateWarmupEmail(senderName, recipientName);

      const gmailMessageId = await ctx.runAction(internal.warmupGmail.sendViaGmail, {
        accountId: account._id,
        to: mailbox.fullAddress,
        subject: content.subject,
        html: content.html,
        warmupEmailId: wmb._id.toString(),
      });

      await ctx.runMutation(internal.warmupPool.createWarmupEmailRecord, {
        warmupMailboxId: wmb._id,
        platformAccountId: account._id,
        direction: "inbound",
        fromAddress: account.email,
        toAddress: mailbox.fullAddress,
        messageId: gmailMessageId,
        subject: content.subject,
      });

      await ctx.runMutation(internal.warmupPool.incrementReceivedToday, {
        warmupMailboxId: wmb._id,
      });
      await ctx.runMutation(
        internal.platformWarmupAccounts.incrementDailySentCount,
        { accountId: account._id }
      );

      inbound++;
    } catch (error) {
      console.error(
        `Warmup inbound failed for ${account.email} -> mailbox ${wmb.mailboxId}:`,
        error
      );
    }
  }

  return { outbound, inbound };
}

export const runWarmupRound = internalAction({
  args: {},
  handler: async (ctx) => {
    const activeMailboxes = await ctx.runQuery(
      internal.warmupPool.listActiveWarmupMailboxes,
      {}
    );

    // The kill switch, checked once for the whole round.
    //
    // Warmup is exempt from recipient verification (its recipients are
    // platform-controlled mailboxes we own, so paying a verifier for them
    // would be waste) but not from the operator halt. It has its own flag
    // rather than following sendingPaused, because stopping the queue while a
    // backfill runs should not also stop a domain's reputation ramp, which
    // takes weeks to rebuild. See the sendingControls schema comment.
    const controls = await ctx.runQuery(
      internal.sendingControls.getStateInternal,
      {}
    );
    if (controls.warmupPaused) {
      console.log("[warmup] warmupPaused is set, skipping round");
      return;
    }

    const availableAccounts = await ctx.runQuery(
      internal.platformWarmupAccounts.getAvailableAccounts,
      {}
    );

    if (availableAccounts.length === 0) {
      // Every warming mailbox on the platform is stalled when this happens, so
      // it belongs in the error log rather than among the routine chatter, and
      // on the customer's dashboard rather than only in our logs.
      console.error(
        `Warmup round: no platform accounts available, ${activeMailboxes.length} mailbox(es) idle`
      );
      await ctx.runMutation(internal.warmupPool.recordPoolOutage, {
        reason:
          "Warmup is paused on our side: no warmup partner account is currently available. Your schedule is held where it is and resumes automatically, without spending days of your run.",
      });
      return;
    }

    const results = await mapWithConcurrency(
      activeMailboxes as Doc<"warmupMailboxes">[],
      MAILBOX_CONCURRENCY,
      (wmb) => runRoundForMailbox(ctx, wmb, availableAccounts)
    );

    const totalOutbound = results.reduce((sum, r) => sum + r.outbound, 0);
    const totalInbound = results.reduce((sum, r) => sum + r.inbound, 0);

    console.log(
      `Warmup round complete: ${totalOutbound} outbound, ${totalInbound} inbound`
    );
  },
});

export const advanceWarmupDay = internalAction({
  args: {},
  handler: async (ctx) => {
    const activeMailboxes = await ctx.runQuery(
      internal.warmupPool.listActiveWarmupMailboxes,
      {}
    );

    for (const wmb of activeMailboxes) {
      await ctx.runMutation(internal.warmupPool.advanceDay, {
        warmupMailboxId: wmb._id,
      });
      await ctx.runMutation(internal.warmupPool.recalculateHealthScore, {
        warmupMailboxId: wmb._id,
      });
    }

    await ctx.runMutation(
      internal.platformWarmupAccounts.resetAllDailyCounts,
      {}
    );

    console.log(`Advanced warmup day for ${activeMailboxes.length} mailboxes`);
  },
});
