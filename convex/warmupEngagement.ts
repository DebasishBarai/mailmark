"use node";

import { DOMParser } from "@xmldom/xmldom";
if (typeof globalThis.DOMParser === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).DOMParser = DOMParser;
}

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { generateWarmupReply } from "./warmupContent";

export const runEngagementRound = internalAction({
  args: {},
  handler: async (ctx) => {
    const pendingEmails = await ctx.runQuery(
      internal.warmupPool.getRecentOutboundForEngagement,
      {}
    );

    if (pendingEmails.length === 0) return;

    let placements = 0;
    let opens = 0;
    let importants = 0;
    let replies = 0;

    for (const email of pendingEmails) {
      try {
        // Step 1: Check placement via Gmail API
        const result = await ctx.runAction(internal.warmupGmail.checkPlacement, {
          accountId: email.platformAccountId,
          messageId: email.messageId,
        });

        if (result.placement === "unknown") continue;

        await ctx.runMutation(internal.warmupPool.updateWarmupEmailPlacement, {
          warmupEmailId: email._id,
          placement: result.placement,
        });
        placements++;

        // Step 2: If spam, rescue first
        if (result.placement === "spam") {
          await ctx.runAction(internal.warmupGmail.rescueFromSpam, {
            accountId: email.platformAccountId,
            messageId: email.messageId,
          });
          await ctx.runMutation(internal.warmupPool.markWarmupEmailRescued, {
            warmupEmailId: email._id,
          });
        }

        // Step 3: Open simulation (85% of emails)
        if (Math.random() < 0.85) {
          const convexSiteUrl = process.env.CONVEX_SITE_URL ?? "";
          const trackingMsgId = email.messageId
            .replace(/^</, "")
            .replace(/@.*$/, "");
          const pixelUrl = `${convexSiteUrl}/track/open/${trackingMsgId}.gif`;

          try {
            await fetch(pixelUrl);
          } catch {
            // Tracking pixel fetch is best-effort
          }

          await ctx.runMutation(internal.warmupPool.markWarmupEmailOpened, {
            warmupEmailId: email._id,
          });
          opens++;

          // Step 4: Mark as important (45% of opened emails)
          if (Math.random() < 0.45) {
            await ctx.runAction(internal.warmupGmail.markImportant, {
              accountId: email.platformAccountId,
              messageId: email.messageId,
            });
            await ctx.runMutation(internal.warmupPool.markWarmupEmailImportant, {
              warmupEmailId: email._id,
            });
            importants++;
          }

          // Step 5: Reply simulation (25% of opened emails)
          if (Math.random() < 0.25) {
            const mailbox = await ctx.runQuery(
              internal.emails.getMailboxById,
              { mailboxId: (await ctx.runQuery(internal.warmupPool.getWarmupMailboxById, { warmupMailboxId: email.warmupMailboxId }))?.mailboxId! }
            );

            if (mailbox) {
              const accountInfo = await ctx.runQuery(
                internal.platformWarmupAccounts.getAccountById,
                { accountId: email.platformAccountId }
              );

              if (accountInfo) {
                const senderName = accountInfo.email.split("@")[0];
                const recipientName = mailbox.displayName || mailbox.address;
                const replyContent = generateWarmupReply(
                  email.subject,
                  senderName,
                  recipientName
                );

                const replyMessageId = await ctx.runAction(
                  internal.warmupGmail.replyViaGmail,
                  {
                    accountId: email.platformAccountId,
                    originalMessageId: email.messageId,
                    to: email.fromAddress,
                    subject: replyContent.subject,
                    html: replyContent.html,
                    warmupEmailId: email.warmupMailboxId.toString(),
                  }
                );

                await ctx.runMutation(internal.warmupPool.markWarmupEmailReplied, {
                  warmupEmailId: email._id,
                  repliedMessageId: replyMessageId,
                });
                replies++;
              }
            }
          }
        }
      } catch (error) {
        console.error(
          `Engagement failed for warmup email ${email._id}:`,
          error
        );
      }
    }

    console.log(
      `Engagement round: ${placements} placements checked, ${opens} opens, ${importants} marked important, ${replies} replies`
    );
  },
});
