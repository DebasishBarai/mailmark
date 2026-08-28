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
import type { Doc } from "./_generated/dataModel";

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

export const runWarmupRound = internalAction({
  args: {},
  handler: async (ctx) => {
    const activeMailboxes = await ctx.runQuery(
      internal.warmupPool.listActiveWarmupMailboxes,
      {}
    );

    const availableAccounts = await ctx.runQuery(
      internal.platformWarmupAccounts.getAvailableAccounts,
      {}
    );

    if (availableAccounts.length === 0) {
      console.log("Warmup round: no platform accounts available");
      return;
    }

    let totalOutbound = 0;
    let totalInbound = 0;

    for (const wmb of activeMailboxes) {
      // --- Outbound: user mailbox -> platform Gmail accounts ---
      if (wmb.sentToday < wmb.dailyLimit) {
        const outboundCount = Math.min(
          Math.floor(Math.random() * 2) + 2, // 2-3 emails per round
          wmb.dailyLimit - wmb.sentToday,
          availableAccounts.length
        );

        const shuffled = [...availableAccounts].sort(() => Math.random() - 0.5);
        const selectedAccounts = shuffled.slice(0, outboundCount);

        for (const account of selectedAccounts) {
          try {
            const { aws, mailbox } = await getAwsClientsForMailbox(ctx, wmb.mailboxId);

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
              `Content-Type: text/html; charset=UTF-8`,
              "",
              content.html + trackingPixel,
            ].join("\r\n");

            // Keep the SES-assigned id: bounce and complaint notifications
            // arrive keyed on it, and nothing else ties one back to this row.
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

            totalOutbound++;
          } catch (error) {
            console.error(
              `Warmup outbound failed for mailbox ${wmb.mailboxId} -> ${account.email}:`,
              error
            );
          }
        }
      }

      // --- Inbound: platform Gmail accounts -> user mailbox ---
      if (wmb.receivedToday < wmb.dailyLimit) {
        const inboundCount = Math.min(
          Math.floor(Math.random() * 1) + 1, // 1-2 emails per round
          wmb.dailyLimit - wmb.receivedToday,
          availableAccounts.length
        );

        const shuffled = [...availableAccounts].sort(() => Math.random() - 0.5);
        const selectedAccounts = shuffled.slice(0, inboundCount);

        for (const account of selectedAccounts) {
          try {
            const mailbox = await ctx.runQuery(
              internal.emails.getMailboxById,
              { mailboxId: wmb.mailboxId }
            );
            if (!mailbox) continue;

            const senderName = account.email.split("@")[0];
            const recipientName = mailbox.displayName || mailbox.address;
            const content = generateWarmupEmail(senderName, recipientName);

            const gmailMessageId = await ctx.runAction(
              internal.warmupGmail.sendViaGmail,
              {
                accountId: account._id,
                to: mailbox.fullAddress,
                subject: content.subject,
                html: content.html,
                warmupEmailId: wmb._id.toString(),
              }
            );

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

            totalInbound++;
          } catch (error) {
            console.error(
              `Warmup inbound failed for ${account.email} -> mailbox ${wmb.mailboxId}:`,
              error
            );
          }
        }
      }
    }

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
