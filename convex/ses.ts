"use node";

import { DOMParser } from "@xmldom/xmldom";
// Convex's bundler loads the browser build of the AWS SDK XML parser,
// which expects DOMParser to be a global. Polyfill it for Node.js.
if (typeof globalThis.DOMParser === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).DOMParser = DOMParser;
}

import { v } from "convex/values";
import { action, internalAction, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { PLAN_LIMITS } from "./quotas";
import { Id } from "./_generated/dataModel";
import { SendEmailCommand } from "@aws-sdk/client-sesv2";
import { PutObjectCommand, GetObjectCommand, HeadObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { simpleParser } from "mailparser";
import type { AddressObject } from "mailparser";
import {
  getPlatformAwsClients,
  getAwsClientsForAccount,
  type AwsClientBundle,
} from "./lib/awsClients";
import type { Doc } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";

// Resolve the client bundle for a mailbox — platform by default, BYO when
// the mailbox's domain has an awsAccount attached (and verified).
async function clientsForMailboxResult(
  mailbox: { awsAccount?: Doc<"awsAccounts"> | null }
): Promise<AwsClientBundle> {
  if (mailbox.awsAccount) {
    return await getAwsClientsForAccount(mailbox.awsAccount);
  }
  return getPlatformAwsClients();
}

// Generate unsubscribe headers and footer for RFC 8058 compliance
// (Gmail/Yahoo 2024 one-click unsubscribe requirement)
function buildUnsubscribeHeaders(unsubUrl: string, unsubPostUrl: string): string[] {
  return [
    `List-Unsubscribe: <${unsubUrl}>, <${unsubPostUrl}>`,
    `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
  ];
}

function buildUnsubscribeFooter(unsubUrl: string): string {
  return `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;font-family:sans-serif">If you no longer wish to receive these emails, <a href="${unsubUrl}" style="color:#7c3aed;text-decoration:underline">unsubscribe here</a>.</div>`;
}

function rewriteLinksForClickTracking(html: string, siteUrl: string, messageId: string): string {
  let linkIndex = 0;
  return html.replace(
    /<a\s([^>]*?)href\s*=\s*"([^"]+)"([^>]*?)>/gi,
    (match, before, url, after) => {
      if (
        url.startsWith("mailto:") ||
        url.includes("/unsubscribe/") ||
        url.startsWith("#")
      ) {
        return match;
      }
      const trackUrl = `${siteUrl}/track/click/${messageId}/${linkIndex}?url=${encodeURIComponent(url)}`;
      linkIndex++;
      return `<a ${before}href="${trackUrl}"${after}>`;
    }
  );
}

function buildRawMimeEmail(
  from: string,
  to: string[],
  subject: string,
  messageId: string,
  domain: string,
  body: string,
  attachments: Array<{ filename: string; contentType: string; data: string }>,
  cc?: string[],
  bcc?: string[],
  unsubHeaders?: string[]
): string {
  const boundary = `----=_Part_${messageId}`;
  const lines: string[] = [
    `MIME-Version: 1.0`,
    `From: ${from}`,
    `To: ${to.join(", ")}`,
    ...(cc && cc.length > 0 ? [`Cc: ${cc.join(", ")}`] : []),
    ...(bcc && bcc.length > 0 ? [`Bcc: ${bcc.join(", ")}`] : []),
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${messageId}@${domain}>`,
    ...(unsubHeaders ?? []),
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    body,
  ];
  for (const att of attachments) {
    const wrapped = att.data.match(/.{1,76}/g)?.join("\r\n") ?? att.data;
    lines.push(
      `--${boundary}`,
      `Content-Type: ${att.contentType}; name="${att.filename}"`,
      `Content-Disposition: attachment; filename="${att.filename}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      wrapped
    );
  }
  lines.push(`--${boundary}--`);
  return lines.join("\r\n");
}

export const sendEmail = action({
  args: {
    mailboxId: v.id("mailboxes"),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    bcc: v.optional(v.array(v.string())),
    subject: v.string(),
    body: v.string(),
    attachments: v.optional(v.array(v.object({
      filename: v.string(),
      contentType: v.string(),
      data: v.string(), // base64-encoded
    }))),
    folder: v.optional(v.string()),
    batchId: v.optional(v.string()),
  },
  handler: async (ctx, { mailboxId, to, cc, bcc, subject, body, attachments, folder, batchId }) => {
    const emailFolder = folder ?? "sent";
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get mailbox and domain info
    const mailbox = await ctx.runQuery(internal.emails.getMailboxWithDomain, {
      mailboxId,
    });

    if (!mailbox) throw new Error("Mailbox not found");

    // Verify recipient emails before sending
    const allRecipients = [...to, ...(cc ?? []), ...(bcc ?? [])];
    const verification = await ctx.runAction(
      internal.emailVerification.verifyRecipientsBeforeSend,
      { emails: allRecipients }
    );
    if (!verification.allValid) {
      throw new Error(
        `Invalid recipient(s): ${verification.invalid.join(", ")}. Please remove or correct them before sending.`
      );
    }

    // Filter out unsubscribed recipients (campaign emails)
    if (batchId) {
      const unsubscribed = await ctx.runQuery(
        internal.unsubscribe.checkUnsubscribedRecipients,
        { domainId: mailbox.domainId, emails: to }
      );
      if (unsubscribed.length > 0) {
        const filtered = to.filter((e) => !unsubscribed.includes(e));
        if (filtered.length === 0) {
          return { success: true, messageId: "skipped-all-unsubscribed" };
        }
        to = filtered;
      }
    }

    // Email quota check
    const emailLimits = await ctx.runQuery(internal.quotas.getUserLimits, {
      userId: mailbox.userId,
    });
    const sentThisMonth = await ctx.runQuery(internal.quotas.countSentEmailsThisMonth, {
      userId: mailbox.userId,
    });
    if (sentThisMonth >= emailLimits.emailsPerMonth) {
      throw new Error(
        `Monthly email limit reached (${emailLimits.emailsPerMonth.toLocaleString()} emails). Please upgrade your plan.`
      );
    }

    // Warming schedule enforcement
    const warmingSchedule = await ctx.runQuery(
      internal.warmingSchedules.getActiveByDomainId,
      { domainId: mailbox.domainId }
    );
    if (warmingSchedule && warmingSchedule.sentToday >= warmingSchedule.dailyLimit) {
      throw new Error(
        `Warming limit reached for today (${warmingSchedule.dailyLimit} emails on day ${warmingSchedule.currentDay} of ${warmingSchedule.totalDays}). Sending will resume tomorrow.`
      );
    }

    const fromAddress = mailbox.displayName
      ? `${mailbox.displayName} <${mailbox.fullAddress}>`
      : mailbox.fullAddress;

    const aws = await clientsForMailboxResult(mailbox);
    const ses = aws.sesv2;
    const messageId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const hasAttachments = (attachments ?? []).length > 0;

    // Inject tracking pixel for open tracking (only for sent emails, not drafts/campaigns)
    const convexSiteUrl = process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
    const trackingPixel = emailFolder === "sent"
      ? `<img src="${convexSiteUrl}/track/open/${messageId}.gif" width="1" height="1" style="display:none" alt="" />`
      : "";

    // Build unsubscribe headers and footer for campaign emails (RFC 8058 / Gmail & Yahoo 2024 compliance)
    const isCampaign = !!batchId;
    const appUrl = process.env.APP_URL ?? "";
    const recipientEmail = to[0] ?? "";
    const unsubToken = `${messageId}-${Buffer.from(recipientEmail).toString("base64url")}`;
    const unsubUrl = `${convexSiteUrl}/unsubscribe/${unsubToken}?email=${encodeURIComponent(recipientEmail)}&domain=${encodeURIComponent(mailbox.domain)}`;
    const unsubPostUrl = `${convexSiteUrl}/unsubscribe/${unsubToken}`;
    const unsubHeaders = isCampaign ? buildUnsubscribeHeaders(unsubUrl, unsubPostUrl) : [];
    const unsubFooter = isCampaign ? buildUnsubscribeFooter(unsubUrl) : "";
    const bodyWithClickTracking = emailFolder === "sent"
      ? rewriteLinksForClickTracking(body + unsubFooter, convexSiteUrl, messageId)
      : body + unsubFooter;
    const bodyWithTracking = bodyWithClickTracking + trackingPixel;

    // Build raw MIME email for both paths - SES rejects Message-ID as a
    // custom header in Simple content, so always send via Content.Raw.
    const rawEmail = hasAttachments
      ? buildRawMimeEmail(fromAddress, to, subject, messageId, mailbox.domain, bodyWithTracking, attachments!, cc, bcc, unsubHeaders)
      : [
          `From: ${fromAddress}`,
          `To: ${to.join(", ")}`,
          ...(cc && cc.length > 0 ? [`Cc: ${cc.join(", ")}`] : []),
          ...(bcc && bcc.length > 0 ? [`Bcc: ${bcc.join(", ")}`] : []),
          `Subject: ${subject}`,
          `Date: ${new Date().toUTCString()}`,
          `Message-ID: <${messageId}@${mailbox.domain}>`,
          ...unsubHeaders,
          `Content-Type: text/html; charset=UTF-8`,
          "",
          bodyWithTracking,
        ].join("\r\n");

    const sesResponse = await ses.send(
      new SendEmailCommand({
        FromEmailAddress: fromAddress,
        Destination: {
          ToAddresses: to,
          CcAddresses: cc && cc.length > 0 ? cc : undefined,
          BccAddresses: bcc && bcc.length > 0 ? bcc : undefined,
        },
        ConfigurationSetName: "devmail-sending",
        Content: { Raw: { Data: new TextEncoder().encode(rawEmail) } },
      })
    );
    const sesMessageId = sesResponse.MessageId;

    if (warmingSchedule) {
      await ctx.runMutation(internal.warmingSchedules.incrementSentToday, {
        scheduleId: warmingSchedule._id,
      });
    }

    // Save raw email to S3
    const s3Key = `${mailbox.domain}/${mailbox.address}/${emailFolder}/${messageId}.eml`;
    await aws.s3.send(
      new PutObjectCommand({
        Bucket: aws.s3Bucket,
        Key: s3Key,
        Body: rawEmail,
        ContentType: "message/rfc822",
      })
    );

    // Save metadata to Convex
    const snippet = body.replace(/<[^>]*>/g, "").slice(0, 100);
    await ctx.runMutation(internal.emails.insertSent, {
      mailboxId,
      messageId,
      sesMessageId,
      from: fromAddress,
      to,
      cc: cc && cc.length > 0 ? cc : undefined,
      bcc: bcc && bcc.length > 0 ? bcc : undefined,
      subject,
      snippet,
      date: Date.now(),
      s3Key,
      hasAttachments,
      folder: emailFolder,
      batchId,
    });

    return { success: true, messageId };
  },
});

// Resolve the correct client bundle from an s3Key (format: `{domain}/...`).
async function clientsForS3Key(
  ctx: { runQuery: (fn: any, args: any) => Promise<any> },
  s3Key: string
): Promise<AwsClientBundle> {
  const domainName = s3Key.split("/")[0];
  if (!domainName) return getPlatformAwsClients();
  const awsAccount = await ctx.runQuery(
    internal.domains.getAwsAccountByDomainName,
    { domain: domainName }
  );
  return awsAccount ? await getAwsClientsForAccount(awsAccount) : getPlatformAwsClients();
}

export const fetchEmailBody = action({
  args: { s3Key: v.string() },
  handler: async (ctx, { s3Key }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const aws = await clientsForS3Key(ctx, s3Key);
    const response = await aws.s3.send(
      new GetObjectCommand({
        Bucket: aws.s3Bucket,
        Key: s3Key,
      })
    );

    const rawEmail = await response.Body?.transformToString("utf-8");
    if (!rawEmail) throw new Error("Email not found in S3");

    // Parse MIME email to extract HTML or text body and attachment metadata
    const parsed = await simpleParser(rawEmail);
    const body = (parsed.html as string | false | undefined) || parsed.textAsHtml || parsed.text || rawEmail;
    const attachments = (parsed.attachments ?? []).map((att) => ({
      filename: att.filename ?? "attachment",
      contentType: att.contentType ?? "application/octet-stream",
      size: att.size ?? 0,
    }));
    return { body, attachments };
  },
});

export const getAttachment = action({
  args: {
    s3Key: v.string(),
    attachmentIndex: v.number(),
  },
  handler: async (ctx, { s3Key, attachmentIndex }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const aws = await clientsForS3Key(ctx, s3Key);
    const response = await aws.s3.send(
      new GetObjectCommand({
        Bucket: aws.s3Bucket,
        Key: s3Key,
      })
    );

    const rawEmail = await response.Body?.transformToString("utf-8");
    if (!rawEmail) throw new Error("Email not found in S3");

    const parsed = await simpleParser(rawEmail);
    const att = parsed.attachments?.[attachmentIndex];
    if (!att) throw new Error("Attachment not found");

    return {
      filename: att.filename ?? "attachment",
      contentType: att.contentType ?? "application/octet-stream",
      data: att.content.toString("base64"),
    };
  },
});

// Schedule an email to be sent at a future time.
// Builds the raw MIME, saves it to S3 in the outbox folder, creates an email
// record in "outbox", and registers a Convex scheduled function to send it.
export const scheduleEmail = action({
  args: {
    mailboxId: v.id("mailboxes"),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    bcc: v.optional(v.array(v.string())),
    subject: v.string(),
    body: v.string(),
    attachments: v.optional(v.array(v.object({
      filename: v.string(),
      contentType: v.string(),
      data: v.string(),
    }))),
    scheduledAt: v.number(), // unix ms timestamp
    batchId: v.optional(v.string()),
  },
  handler: async (ctx, { mailboxId, to, cc, bcc, subject, body, attachments, scheduledAt, batchId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    if (scheduledAt <= Date.now()) throw new Error("Scheduled time must be in the future");

    const mailbox = await ctx.runQuery(internal.emails.getMailboxWithDomain, { mailboxId });
    if (!mailbox) throw new Error("Mailbox not found");

    // Verify recipient emails before scheduling
    const schedAllRecipients = [...to, ...(cc ?? []), ...(bcc ?? [])];
    const schedVerification = await ctx.runAction(
      internal.emailVerification.verifyRecipientsBeforeSend,
      { emails: schedAllRecipients }
    );
    if (!schedVerification.allValid) {
      throw new Error(
        `Invalid recipient(s): ${schedVerification.invalid.join(", ")}. Please remove or correct them before sending.`
      );
    }

    // Email quota check
    const schedLimits = await ctx.runQuery(internal.quotas.getUserLimits, {
      userId: mailbox.userId,
    });
    const schedSentThisMonth = await ctx.runQuery(internal.quotas.countSentEmailsThisMonth, {
      userId: mailbox.userId,
    });
    if (schedSentThisMonth >= schedLimits.emailsPerMonth) {
      throw new Error(
        `Monthly email limit reached (${schedLimits.emailsPerMonth.toLocaleString()} emails). Please upgrade your plan.`
      );
    }

    const fromAddress = mailbox.displayName
      ? `${mailbox.displayName} <${mailbox.fullAddress}>`
      : mailbox.fullAddress;

    const messageId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const hasAttachments = (attachments ?? []).length > 0;

    // Inject click tracking and open tracking pixel
    const convexSiteUrl = process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
    const trackingPixel = `<img src="${convexSiteUrl}/track/open/${messageId}.gif" width="1" height="1" style="display:none" alt="" />`;
    const bodyWithTracking = rewriteLinksForClickTracking(body, convexSiteUrl, messageId) + trackingPixel;

    const rawEmail = hasAttachments
      ? buildRawMimeEmail(fromAddress, to, subject, messageId, mailbox.domain, bodyWithTracking, attachments!, cc, bcc)
      : [
          `From: ${fromAddress}`,
          `To: ${to.join(", ")}`,
          ...(cc && cc.length > 0 ? [`Cc: ${cc.join(", ")}`] : []),
          ...(bcc && bcc.length > 0 ? [`Bcc: ${bcc.join(", ")}`] : []),
          `Subject: ${subject}`,
          `Date: ${new Date(scheduledAt).toUTCString()}`,
          `Message-ID: <${messageId}@${mailbox.domain}>`,
          `Content-Type: text/html; charset=UTF-8`,
          "",
          bodyWithTracking,
        ].join("\r\n");

    // Save raw email to S3 under the outbox path
    const s3Key = `${mailbox.domain}/${mailbox.address}/outbox/${messageId}.eml`;
    const aws = await clientsForMailboxResult(mailbox);
    await aws.s3.send(
      new PutObjectCommand({
        Bucket: aws.s3Bucket,
        Key: s3Key,
        Body: rawEmail,
        ContentType: "message/rfc822",
      })
    );

    // Schedule the actual send
    const jobId = await ctx.scheduler.runAt(
      scheduledAt,
      internal.ses.sendScheduledEmail,
      { s3Key, messageId, mailboxId, to, cc, bcc, fromAddress, batchId }
    );

    const snippet = body.replace(/<[^>]*>/g, "").slice(0, 100);
    await ctx.runMutation(internal.emails.insertScheduled, {
      mailboxId,
      messageId,
      from: fromAddress,
      to,
      cc: cc && cc.length > 0 ? cc : undefined,
      bcc: bcc && bcc.length > 0 ? bcc : undefined,
      subject,
      snippet,
      date: scheduledAt,
      s3Key,
      hasAttachments,
      scheduledAt,
      scheduledJobId: jobId as string,
      batchId,
    });

    return { success: true, messageId };
  },
});

// Internal action invoked by the Convex scheduler at the scheduled send time.
export const sendScheduledEmail = internalAction({
  args: {
    s3Key: v.string(),
    messageId: v.string(),
    mailboxId: v.id("mailboxes"),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    bcc: v.optional(v.array(v.string())),
    fromAddress: v.string(),
    batchId: v.optional(v.string()),
  },
  handler: async (ctx, { s3Key, messageId, mailboxId, to, cc, bcc, fromAddress, batchId }) => {
    // Look up the outbox email record to verify it still exists
    const emails = await ctx.runQuery(internal.emails.getMailboxWithDomain, { mailboxId });
    if (!emails) {
      console.log("[sendScheduledEmail] mailbox not found, skipping", mailboxId);
      return;
    }

    // Warming schedule enforcement
    const warmingSchedule = await ctx.runQuery(
      internal.warmingSchedules.getActiveByDomainId,
      { domainId: emails.domainId }
    );
    if (warmingSchedule && warmingSchedule.sentToday >= warmingSchedule.dailyLimit) {
      console.log(
        `[sendScheduledEmail] warming limit reached for domain ${emails.domain}, skipping messageId=${messageId}`
      );
      return;
    }

    // Read the pre-built raw MIME from S3
    const aws = await clientsForMailboxResult(emails);
    const response = await aws.s3.send(
      new GetObjectCommand({ Bucket: aws.s3Bucket, Key: s3Key })
    );
    const rawEmail = await response.Body?.transformToString("utf-8");
    if (!rawEmail) {
      console.error("[sendScheduledEmail] S3 object not found:", s3Key);
      return;
    }

    // Send via SES
    const ses = aws.sesv2;
    const sesResponse = await ses.send(
      new SendEmailCommand({
        FromEmailAddress: fromAddress,
        Destination: {
          ToAddresses: to,
          CcAddresses: cc && cc.length > 0 ? cc : undefined,
          BccAddresses: bcc && bcc.length > 0 ? bcc : undefined,
        },
        ConfigurationSetName: "devmail-sending",
        Content: { Raw: { Data: new TextEncoder().encode(rawEmail) } },
      })
    );

    if (warmingSchedule) {
      await ctx.runMutation(internal.warmingSchedules.incrementSentToday, {
        scheduleId: warmingSchedule._id,
      });
    }

    // Find the outbox email record by messageId and move it to sent
    await ctx.runMutation(internal.emails.markScheduledEmailAsSentByMessageId, {
      messageId,
      sesMessageId: sesResponse.MessageId,
    });
  },
});

// Schedule an email to be sent at a future time via API key (no Clerk auth)
export const scheduleEmailViaApi = internalAction({
  args: {
    mailboxId: v.id("mailboxes"),
    to: v.array(v.string()),
    subject: v.string(),
    html: v.string(),
    scheduledAt: v.number(),
    batchId: v.optional(v.string()),
  },
  handler: async (ctx, { mailboxId, to, subject, html, scheduledAt, batchId }) => {
    if (scheduledAt <= Date.now()) throw new Error("scheduledAt must be in the future");

    const mailbox = await ctx.runQuery(internal.emails.getMailboxWithDomain, { mailboxId });
    if (!mailbox) throw new Error("Mailbox not found");

    // Verify recipient emails before scheduling
    const schedApiVerification = await ctx.runAction(
      internal.emailVerification.verifyRecipientsBeforeSend,
      { emails: to }
    );
    if (!schedApiVerification.allValid) {
      throw new Error(
        `Invalid recipient(s): ${schedApiVerification.invalid.join(", ")}. Please remove or correct them before sending.`
      );
    }

    // Email quota check
    const schedApiLimits = await ctx.runQuery(internal.quotas.getUserLimits, {
      userId: mailbox.userId,
    });
    const schedApiSentThisMonth = await ctx.runQuery(internal.quotas.countSentEmailsThisMonth, {
      userId: mailbox.userId,
    });
    if (schedApiSentThisMonth >= schedApiLimits.emailsPerMonth) {
      throw new Error(
        `Monthly email limit reached (${schedApiLimits.emailsPerMonth.toLocaleString()} emails). Please upgrade your plan.`
      );
    }

    const fromAddress = mailbox.displayName
      ? `${mailbox.displayName} <${mailbox.fullAddress}>`
      : mailbox.fullAddress;

    const messageId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const convexSiteUrl = process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
    const trackingPixel = `<img src="${convexSiteUrl}/track/open/${messageId}.gif" width="1" height="1" style="display:none" alt="" />`;

    // Unsubscribe headers + footer for campaign emails
    const sIsCampaign = !!batchId;
    const sRecipient = to[0] ?? "";
    const sUnsubToken = `${messageId}-${Buffer.from(sRecipient).toString("base64url")}`;
    const sUnsubUrl = `${convexSiteUrl}/unsubscribe/${sUnsubToken}?email=${encodeURIComponent(sRecipient)}&domain=${encodeURIComponent(mailbox.domain)}`;
    const sUnsubPostUrl = `${convexSiteUrl}/unsubscribe/${sUnsubToken}`;
    const sUnsubHeaders = sIsCampaign ? buildUnsubscribeHeaders(sUnsubUrl, sUnsubPostUrl) : [];
    const sUnsubFooter = sIsCampaign ? buildUnsubscribeFooter(sUnsubUrl) : "";
    const bodyWithTracking = rewriteLinksForClickTracking(html + sUnsubFooter, convexSiteUrl, messageId) + trackingPixel;

    const rawEmail = [
      `From: ${fromAddress}`,
      `To: ${to.join(", ")}`,
      `Subject: ${subject}`,
      `Date: ${new Date(scheduledAt).toUTCString()}`,
      `Message-ID: <${messageId}@${mailbox.domain}>`,
      ...sUnsubHeaders,
      `Content-Type: text/html; charset=UTF-8`,
      "",
      bodyWithTracking,
    ].join("\r\n");

    const s3Key = `${mailbox.domain}/${mailbox.address}/outbox/${messageId}.eml`;
    const awsApi = await clientsForMailboxResult(mailbox);
    await awsApi.s3.send(
      new PutObjectCommand({
        Bucket: awsApi.s3Bucket,
        Key: s3Key,
        Body: rawEmail,
        ContentType: "message/rfc822",
      })
    );

    const jobId = await ctx.scheduler.runAt(
      scheduledAt,
      internal.ses.sendScheduledEmail,
      { s3Key, messageId, mailboxId, to, fromAddress, batchId }
    );

    const snippet = html.replace(/<[^>]*>/g, "").slice(0, 100);
    await ctx.runMutation(internal.emails.insertScheduled, {
      mailboxId,
      messageId,
      from: fromAddress,
      to,
      subject,
      snippet,
      date: scheduledAt,
      s3Key,
      hasAttachments: false,
      scheduledAt,
      scheduledJobId: jobId as string,
      batchId,
    });

    return { messageId };
  },
});

// Called from the /v1/send HTTP route - no Clerk auth, validated via API key
export const sendEmailViaApi = internalAction({
  args: {
    mailboxId: v.id("mailboxes"),
    to: v.array(v.string()),
    subject: v.string(),
    html: v.string(),
    batchId: v.optional(v.string()),
  },
  handler: async (ctx, { mailboxId, to, subject, html, batchId }) => {
    const mailbox = await ctx.runQuery(internal.emails.getMailboxWithDomain, { mailboxId });
    if (!mailbox) throw new Error("Mailbox not found");

    // Verify recipient emails before sending
    const apiVerification = await ctx.runAction(
      internal.emailVerification.verifyRecipientsBeforeSend,
      { emails: to }
    );
    if (!apiVerification.allValid) {
      throw new Error(
        `Invalid recipient(s): ${apiVerification.invalid.join(", ")}. Please remove or correct them before sending.`
      );
    }

    // Filter out unsubscribed recipients (campaign emails)
    if (batchId) {
      const apiUnsubs = await ctx.runQuery(
        internal.unsubscribe.checkUnsubscribedRecipients,
        { domainId: mailbox.domainId, emails: to }
      );
      if (apiUnsubs.length > 0) {
        to = to.filter((e) => !apiUnsubs.includes(e));
        if (to.length === 0) return { messageId: "skipped-all-unsubscribed" };
      }
    }

    // Email quota check
    const apiLimits = await ctx.runQuery(internal.quotas.getUserLimits, {
      userId: mailbox.userId,
    });
    const apiSentThisMonth = await ctx.runQuery(internal.quotas.countSentEmailsThisMonth, {
      userId: mailbox.userId,
    });
    if (apiSentThisMonth >= apiLimits.emailsPerMonth) {
      throw new Error(
        `Monthly email limit reached (${apiLimits.emailsPerMonth.toLocaleString()} emails). Please upgrade your plan.`
      );
    }

    // Warming schedule enforcement
    const warmingSchedule = await ctx.runQuery(
      internal.warmingSchedules.getActiveByDomainId,
      { domainId: mailbox.domainId }
    );
    if (warmingSchedule && warmingSchedule.sentToday >= warmingSchedule.dailyLimit) {
      throw new Error(
        `Warming limit reached for today (${warmingSchedule.dailyLimit} emails on day ${warmingSchedule.currentDay} of ${warmingSchedule.totalDays}). Sending will resume tomorrow.`
      );
    }

    const fromAddress = mailbox.displayName
      ? `${mailbox.displayName} <${mailbox.fullAddress}>`
      : mailbox.fullAddress;

    const awsViaApi = await clientsForMailboxResult(mailbox);
    const ses = awsViaApi.sesv2;
    const messageId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const convexSiteUrl = process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
    const trackingPixel = `<img src="${convexSiteUrl}/track/open/${messageId}.gif" width="1" height="1" style="display:none" alt="" />`;

    // Unsubscribe headers + footer for campaign emails
    const apiIsCampaign = !!batchId;
    const apiRecipient = to[0] ?? "";
    const apiUnsubToken = `${messageId}-${Buffer.from(apiRecipient).toString("base64url")}`;
    const apiUnsubUrl = `${convexSiteUrl}/unsubscribe/${apiUnsubToken}?email=${encodeURIComponent(apiRecipient)}&domain=${encodeURIComponent(mailbox.domain)}`;
    const apiUnsubPostUrl = `${convexSiteUrl}/unsubscribe/${apiUnsubToken}`;
    const apiUnsubHeaders = apiIsCampaign ? buildUnsubscribeHeaders(apiUnsubUrl, apiUnsubPostUrl) : [];
    const apiUnsubFooter = apiIsCampaign ? buildUnsubscribeFooter(apiUnsubUrl) : "";
    const bodyWithTracking = rewriteLinksForClickTracking(html + apiUnsubFooter, convexSiteUrl, messageId) + trackingPixel;

    const rawEmail = [
      `From: ${fromAddress}`,
      `To: ${to.join(", ")}`,
      `Subject: ${subject}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${messageId}@${mailbox.domain}>`,
      ...apiUnsubHeaders,
      `Content-Type: text/html; charset=UTF-8`,
      "",
      bodyWithTracking,
    ].join("\r\n");

    const sesResponse = await ses.send(
      new SendEmailCommand({
        FromEmailAddress: fromAddress,
        Destination: { ToAddresses: to },
        ConfigurationSetName: "devmail-sending",
        Content: { Raw: { Data: new TextEncoder().encode(rawEmail) } },
      })
    );

    if (warmingSchedule) {
      await ctx.runMutation(internal.warmingSchedules.incrementSentToday, {
        scheduleId: warmingSchedule._id,
      });
    }

    const s3Key = `${mailbox.domain}/${mailbox.address}/sent/${messageId}.eml`;
    await awsViaApi.s3.send(
      new PutObjectCommand({
        Bucket: awsViaApi.s3Bucket,
        Key: s3Key,
        Body: rawEmail,
        ContentType: "message/rfc822",
      })
    );

    const snippet = html.replace(/<[^>]*>/g, "").slice(0, 100);
    await ctx.runMutation(internal.emails.insertSent, {
      mailboxId,
      messageId,
      sesMessageId: sesResponse.MessageId,
      from: fromAddress,
      to,
      subject,
      snippet,
      date: Date.now(),
      s3Key,
      hasAttachments: false,
      folder: "sent",
      batchId,
    });

    return { messageId };
  },
});

// Collect the addresses out of a parsed From/To/Cc header.
function parsedAddresses(
  field: AddressObject | AddressObject[] | undefined
): string[] {
  if (!field) return [];
  const objects = Array.isArray(field) ? field : [field];
  const addresses: string[] = [];
  for (const obj of objects) {
    for (const entry of obj.value ?? []) {
      if (!entry.address) continue;
      const address = entry.address.toLowerCase();
      if (!addresses.includes(address)) addresses.push(address);
    }
  }
  return addresses;
}

// Correct an ingested email's recipients from the raw message in S3.
//
// The Lambda reports `to` as the recipients that live on this domain, merged
// out of the To and Cc headers, so an inbound message shows the wrong To line
// (Cc'd colleagues appear as To, off-domain recipients disappear) and never
// has a Cc at all. The raw message is the authority, so read the headers back
// from it. Best effort: a failure here must not stop the S3 move below.
async function syncIngestedRecipients(
  ctx: ActionCtx,
  aws: AwsClientBundle,
  s3Key: string,
  emailId: Id<"emails">
): Promise<void> {
  try {
    const response = await aws.s3.send(
      new GetObjectCommand({ Bucket: aws.s3Bucket, Key: s3Key })
    );
    const rawEmail = await response.Body?.transformToString("utf-8");
    if (!rawEmail) return;

    const parsed = await simpleParser(rawEmail);
    const to = parsedAddresses(parsed.to);
    const cc = parsedAddresses(parsed.cc);
    if (to.length === 0 && cc.length === 0) return;

    await ctx.runMutation(internal.emails.updateIngestedRecipients, {
      emailId,
      ...(to.length > 0 ? { to } : {}),
      ...(cc.length > 0 ? { cc } : {}),
    });
  } catch (error) {
    console.error("Failed to read recipients from raw email:", error);
  }
}

// ── Repairing and de-duplicating ingested mail ──

async function s3ObjectExists(aws: AwsClientBundle, key: string): Promise<boolean> {
  try {
    await aws.s3.send(
      new HeadObjectCommand({ Bucket: aws.s3Bucket, Key: key })
    );
    return true;
  } catch {
    return false;
  }
}

// Every place an ingested message may have come to rest. The Lambda stages its
// copy under {domain}/{mailbox}/inbox/, moveIncomingEmail rewrites that to
// {domain}/{mailbox}/incoming/, and the raw SES drop sits at {domain}/incoming/
// until the Lambda deletes it. A row can name any of them depending on where
// the move got to, so try them all before calling a message lost.
function candidateS3Keys(s3Key: string, fullAddress: string): string[] {
  const [localPart, domain] = fullAddress.toLowerCase().split("@");
  if (!localPart || !domain) return [];

  const filename = s3Key.split("/").pop() || s3Key;
  const withoutExtension = filename.replace(/\.eml$/, "");

  const candidates = [
    `${domain}/${localPart}/incoming/${filename}`,
    `${domain}/${localPart}/inbox/${filename}`,
    `${domain}/incoming/${filename}`,
    `${domain}/incoming/${withoutExtension}`,
  ];

  return candidates.filter((key, i) => key !== s3Key && candidates.indexOf(key) === i);
}

// Read-only diagnostic for "Failed to load email body". Reports, for the most
// recent rows in a folder, which key the row names, whether that object is in
// S3, where else the message can be found, and the error the mailbox would hit
// when opening it. Writes nothing. Run it per mailbox from the dashboard:
//
//   internal.ses.inspectEmailS3
//   { "mailboxId": "...", "limit": 5 }
export const inspectEmailS3 = internalAction({
  args: {
    mailboxId: v.id("mailboxes"),
    folder: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { mailboxId, folder, limit }) => {
    const targetFolder = folder ?? "inbox";

    const mailbox = await ctx.runQuery(internal.emails.getMailboxById, {
      mailboxId,
    });
    if (!mailbox) throw new Error("Mailbox not found");

    const all = await ctx.runQuery(internal.emails.listForRepairInternal, {
      mailboxId,
      folder: targetFolder,
    });
    if (all.length === 0) return { mailbox: mailbox.fullAddress, rows: [] };

    const recent = [...all]
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, limit ?? 5);

    const aws = await clientsForS3Key(ctx, all[0].s3Key);

    const rows: Array<{
      subject: string;
      receivedAt: string;
      s3Key: string;
      messageId: string;
      rowsWithSameMessageId: number;
      keyExists: boolean;
      alsoFoundAt: string[];
      bodyError: string | null;
    }> = [];
    for (const email of recent) {
      const keyExists = await s3ObjectExists(aws, email.s3Key);

      const alsoFoundAt: string[] = [];
      for (const candidate of candidateS3Keys(email.s3Key, mailbox.fullAddress)) {
        if (await s3ObjectExists(aws, candidate)) alsoFoundAt.push(candidate);
      }

      // Reproduce what the mailbox does when you open the message, so a row
      // whose object is present but still fails to render is distinguishable
      // from one whose object is gone.
      let bodyError: string | null = null;
      try {
        const response = await aws.s3.send(
          new GetObjectCommand({ Bucket: aws.s3Bucket, Key: email.s3Key })
        );
        const rawEmail = await response.Body?.transformToString("utf-8");
        if (!rawEmail) bodyError = "empty object";
        else await simpleParser(rawEmail);
      } catch (error) {
        bodyError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      }

      rows.push({
        subject: email.subject,
        receivedAt: new Date(email.date).toISOString(),
        s3Key: email.s3Key,
        messageId: email.messageId,
        rowsWithSameMessageId: all.filter((e) => e.messageId === email.messageId).length,
        keyExists,
        alsoFoundAt,
        bodyError,
      });
    }

    return { mailbox: mailbox.fullAddress, folder: targetFolder, bucket: aws.s3Bucket, rows };
  },
});

// Point rows at the copy of their message that actually exists in S3.
//
// The duplicate ingests raced over moveIncomingEmail: both runs copy the raw
// mail to the same key and then delete it, so whichever run lost is left
// naming an object the winner removed, and the mailbox renders it as "Failed
// to load email body". The message itself survives under one of the other
// prefixes, so look it up and rewrite the key.
export const repairEmailS3Keys = internalAction({
  args: {
    mailboxId: v.id("mailboxes"),
    folder: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { mailboxId, folder, dryRun }) => {
    const targetFolder = folder ?? "inbox";
    const isDryRun = dryRun ?? false;

    const mailbox = await ctx.runQuery(internal.emails.getMailboxById, {
      mailboxId,
    });
    if (!mailbox) throw new Error("Mailbox not found");

    const emails = await ctx.runQuery(internal.emails.listForRepairInternal, {
      mailboxId,
      folder: targetFolder,
    });
    if (emails.length === 0) {
      return { folder: targetFolder, scanned: 0, intact: 0, repaired: [], missing: [] };
    }

    const aws = await clientsForS3Key(ctx, emails[0].s3Key);

    let intact = 0;
    const repaired: Array<{ subject: string; from: string; to: string }> = [];
    const missing: Array<{ subject: string; s3Key: string }> = [];

    for (const email of emails) {
      if (await s3ObjectExists(aws, email.s3Key)) {
        intact++;
        continue;
      }

      let found: string | null = null;
      for (const candidate of candidateS3Keys(email.s3Key, mailbox.fullAddress)) {
        if (await s3ObjectExists(aws, candidate)) {
          found = candidate;
          break;
        }
      }

      if (!found) {
        missing.push({ subject: email.subject, s3Key: email.s3Key });
        continue;
      }

      repaired.push({ subject: email.subject, from: email.s3Key, to: found });
      if (!isDryRun) {
        await ctx.runMutation(internal.emails.updateS3Key, {
          emailId: email._id,
          s3Key: found,
        });
      }
    }

    return {
      dryRun: isDryRun,
      folder: targetFolder,
      scanned: emails.length,
      intact,
      repaired,
      missing,
    };
  },
});

// Remove the duplicate rows written before insertFromWebhook started deduping
// by messageId. Run repairEmailS3Keys first, then, per mailbox:
//
//   internal.ses.purgeDuplicateIngests
//   { "mailboxId": "...", "dryRun": false }
//
// dryRun defaults to true, so the first run only reports what it would delete.
//
// Which row to keep is decided by asking S3, never by the shape of the s3Key:
// within a group sharing a messageId it keeps the oldest row whose object is
// actually readable. A group where no row's object can be found is left alone
// and reported, so a message is never reduced to a copy that cannot be opened.
export const purgeDuplicateIngests = internalAction({
  args: {
    mailboxId: v.id("mailboxes"),
    folder: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { mailboxId, folder, dryRun }) => {
    const targetFolder = folder ?? "inbox";
    const isDryRun = dryRun ?? true;

    const emails = await ctx.runQuery(internal.emails.listForRepairInternal, {
      mailboxId,
      folder: targetFolder,
    });
    if (emails.length === 0) {
      return { folder: targetFolder, scanned: 0, duplicateGroups: 0, deleted: [], skipped: [] };
    }

    const aws = await clientsForS3Key(ctx, emails[0].s3Key);

    const byMessageId = new Map<string, typeof emails>();
    for (const email of emails) {
      if (!email.messageId) continue;
      const group = byMessageId.get(email.messageId);
      if (group) group.push(email);
      else byMessageId.set(email.messageId, [email]);
    }

    const deleted: Array<{ subject: string; s3Key: string }> = [];
    const skipped: Array<{ messageId: string; subject: string; reason: string }> = [];
    let duplicateGroups = 0;

    for (const [messageId, group] of byMessageId) {
      if (group.length < 2) continue;
      duplicateGroups++;

      const readable: typeof emails = [];
      for (const email of group) {
        if (await s3ObjectExists(aws, email.s3Key)) readable.push(email);
      }

      if (readable.length === 0) {
        skipped.push({
          messageId,
          subject: group[0].subject,
          reason: "no copy of this message could be read from S3",
        });
        continue;
      }

      readable.sort((a, b) => a._creationTime - b._creationTime);
      const keep = readable[0];
      const duplicates = group.filter((e) => e._id !== keep._id);

      const read = keep.read || duplicates.some((e) => e.read);
      const starred = keep.starred || duplicates.some((e) => e.starred);

      for (const duplicate of duplicates) {
        deleted.push({ subject: duplicate.subject, s3Key: duplicate.s3Key });
        if (!isDryRun) {
          await ctx.runMutation(internal.emails.deleteInternal, {
            emailId: duplicate._id,
          });
        }
      }

      if (!isDryRun) {
        await ctx.runMutation(internal.emails.mergeDuplicateFlags, {
          emailId: keep._id,
          read,
          starred,
        });
      }
    }

    return {
      dryRun: isDryRun,
      folder: targetFolder,
      scanned: emails.length,
      duplicateGroups,
      deleted: isDryRun ? [] : deleted,
      wouldDelete: isDryRun ? deleted : [],
      skipped,
    };
  },
});

// Move incoming email from domain/incoming/ to domain/mailbox/incoming/
export const moveIncomingEmail = internalAction({
  args: {
    emailId: v.id("emails"),
    oldS3Key: v.string(),
    recipientAddress: v.string(),
  },
  handler: async (ctx, { emailId, oldS3Key, recipientAddress }) => {
    const [localPart, domain] = recipientAddress.toLowerCase().split("@");
    if (!localPart || !domain) return;

    const aws = await clientsForS3Key(ctx, oldS3Key);
    const bucket = aws.s3Bucket;

    // Read the real To/Cc off the message while it is still at oldS3Key.
    await syncIngestedRecipients(ctx, aws, oldS3Key, emailId);

    const filename = oldS3Key.split("/").pop() || oldS3Key;
    const newS3Key = `${domain}/${localPart}/incoming/${filename}`;

    if (oldS3Key === newS3Key) return;

    try {
      await aws.s3.send(
        new CopyObjectCommand({
          Bucket: bucket,
          CopySource: encodeURI(`${bucket}/${oldS3Key}`),
          Key: newS3Key,
        })
      );
      // Point the row at the new key before removing the old one. Deleting
      // first leaves a window where the row names an object that is already
      // gone, and anything that ends the action in between (an error, the
      // time limit) makes that permanent: the message then renders as
      // "Failed to load email body". Updating first means a run cut short
      // leaves the row on a key that still exists, at worst leaking the
      // staging copy.
      await ctx.runMutation(internal.emails.updateS3Key, {
        emailId,
        s3Key: newS3Key,
      });
      await aws.s3.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: oldS3Key,
        })
      );
    } catch (error) {
      console.error("Failed to move S3 object:", error);
    }
  },
});
