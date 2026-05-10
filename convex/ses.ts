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
import { PutObjectCommand, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { simpleParser } from "mailparser";
import {
  getPlatformAwsClients,
  getAwsClientsForAccount,
  type AwsClientBundle,
} from "./lib/awsClients";
import type { Doc } from "./_generated/dataModel";

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

    const filename = oldS3Key.split("/").pop() || oldS3Key;
    const newS3Key = `${domain}/${localPart}/incoming/${filename}`;

    if (oldS3Key === newS3Key) return;

    const aws = await clientsForS3Key(ctx, oldS3Key);
    const bucket = aws.s3Bucket;

    try {
      await aws.s3.send(
        new CopyObjectCommand({
          Bucket: bucket,
          CopySource: encodeURI(`${bucket}/${oldS3Key}`),
          Key: newS3Key,
        })
      );
      await aws.s3.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: oldS3Key,
        })
      );
      // Update the email record with the new S3 key
      await ctx.runMutation(internal.emails.updateS3Key, {
        emailId,
        s3Key: newS3Key,
      });
    } catch (error) {
      console.error("Failed to move S3 object:", error);
    }
  },
});
