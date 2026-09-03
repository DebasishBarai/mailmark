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
import { PutObjectCommand, GetObjectCommand, HeadObjectCommand, CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import type { ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";
import { simpleParser } from "mailparser";
import type { AddressObject } from "mailparser";
import {
  getPlatformAwsClients,
  getAwsClientsForAccount,
  type AwsClientBundle,
} from "./lib/awsClients";
import { evaluateForSend, describeRefusal } from "./lib/gate";
import { HOLD_RETRY_MS, MAX_HOLDS, BLOCK_REASONS } from "./lib/sendPolicy";
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

    // ── Eligibility gate ──
    //
    // One check for suppression, unsubscribes and verification, in that
    // order, for every recipient. This replaces the old pair of checks here:
    // a DNS/MX lookup that could not see whether a mailbox existed, and an
    // unsubscribe filter that only ran when a batchId happened to be set.
    //
    // Compose is interactive, so it is allowed to wait for a verification the
    // cache is missing. In practice the wait is rare: contact ingestion
    // verifies addresses long before anybody composes to them.
    const gate = await evaluateForSend(ctx, {
      userId: mailbox.userId,
      domainId: mailbox.domainId,
      emails: [...to, ...(cc ?? []), ...(bcc ?? [])],
      path: "compose",
      mailboxId,
      batchId,
      allowInlineVerification: true,
    });

    if (gate.sendingPaused) {
      throw new Error(
        `Sending is paused${gate.pausedReason ? `: ${gate.pausedReason}` : ""}. No messages are being dispatched.`
      );
    }

    // A recipient still held after the inline lookup means the verifier could
    // not answer and policy says hold. Tell the user rather than sending to
    // everyone else and dropping that address without saying so: on an
    // interactive path there is somebody to tell, and they can retry.
    if (gate.held.length > 0) {
      throw new Error(
        `Could not verify ${gate.held.map((h) => h.email).join(", ")} right now. Nothing was sent; please try again shortly.`
      );
    }

    const permitted = new Set(gate.allowed);
    to = to.filter((e) => permitted.has(e.trim().toLowerCase()));
    cc = cc?.filter((e) => permitted.has(e.trim().toLowerCase()));
    bcc = bcc?.filter((e) => permitted.has(e.trim().toLowerCase()));

    if (to.length === 0 && (cc?.length ?? 0) === 0 && (bcc?.length ?? 0) === 0) {
      throw new Error(
        `No eligible recipients. ${describeRefusal(gate)}`
      );
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

    // Screen at queue time so an already-known-bad address is refused while
    // the user is still looking at the compose window, rather than three weeks
    // later in a log. This is a courtesy check, not the authority: the gate in
    // sendScheduledEmail runs again at dispatch, because suppression and
    // unsubscribe state changes between now and then and a verification made
    // today may have expired by the send date.
    //
    // Only outright blocks refuse the schedule. An address merely awaiting
    // verification is queued as normal and resolved before it sends.
    const schedGate = await evaluateForSend(ctx, {
      userId: mailbox.userId,
      domainId: mailbox.domainId,
      emails: [...to, ...(cc ?? []), ...(bcc ?? [])],
      path: "scheduled",
      mailboxId,
      batchId,
      allowInlineVerification: true,
    });
    if (schedGate.sendingPaused) {
      throw new Error(
        `Sending is paused${schedGate.pausedReason ? `: ${schedGate.pausedReason}` : ""}.`
      );
    }
    if (schedGate.blocked.length > 0 && schedGate.allowed.length === 0 && schedGate.held.length === 0) {
      throw new Error(`No eligible recipients. ${describeRefusal(schedGate)}`);
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
    // The lists as scheduled. A hold re-arms the job with these rather than
    // the gate-filtered ones, so an address held today is reconsidered on the
    // retry instead of being quietly dropped from the message forever.
    const originalTo = to;
    const originalCc = cc;
    const originalBcc = bcc;

    // Look up the outbox email record to verify it still exists
    const emails = await ctx.runQuery(internal.emails.getMailboxWithDomain, { mailboxId });
    if (!emails) {
      console.log("[sendScheduledEmail] mailbox not found, skipping", mailboxId);
      return;
    }

    // ── Eligibility gate ──
    //
    // This path had no checks at all. Verification ran when the message was
    // *scheduled*, which for the current queue is up to three weeks before it
    // sends, and unsubscribes were never consulted here at any point. Since
    // this is the path that delivers every one of the 40,000+ queued messages,
    // it is the one that most needed a gate.
    //
    // No inline verification: a lookup is scheduled and the message is held,
    // so the API never sits in this path's latency.
    const gate = await evaluateForSend(ctx, {
      userId: emails.userId,
      domainId: emails.domainId,
      emails: [...to, ...(cc ?? []), ...(bcc ?? [])],
      path: "scheduled",
      mailboxId,
      messageId,
      batchId,
    });

    const permittedScheduled = new Set(gate.allowed);
    to = to.filter((e) => permittedScheduled.has(e.trim().toLowerCase()));
    cc = cc?.filter((e) => permittedScheduled.has(e.trim().toLowerCase()));
    bcc = bcc?.filter((e) => permittedScheduled.has(e.trim().toLowerCase()));
    const hasRecipient =
      to.length > 0 || (cc?.length ?? 0) > 0 || (bcc?.length ?? 0) > 0;

    // Held: the kill switch is on, or a verification is still in flight, or
    // the verifier is unreachable and policy says hold. Re-arm rather than
    // send or discard, so lifting the switch (or the API recovering) resumes
    // the queue exactly where it stopped.
    //
    // Any held recipient holds the whole message, even when others are
    // eligible. Sending to the eligible ones now would drop the held one from
    // this message permanently: the send has happened, nothing re-queues it,
    // and an address awaiting verification would silently never be mailed. A
    // hold is temporary by definition, so waiting ten minutes and
    // re-evaluating everybody costs nothing but delay.
    //
    // A *blocked* recipient is different and deliberately does not hold: that
    // refusal is permanent, so the rest of the message goes out and the block
    // is recorded.
    if (gate.held.length > 0) {
      const hold = await ctx.runMutation(
        internal.emails.recordHoldByMessageId,
        { messageId }
      );

      if (hold.holdCount > MAX_HOLDS) {
        // Give up re-arming, but keep the message: it becomes a blocked row
        // with a reason, which is visible, rather than a job cycling forever.
        console.error(
          `[sendScheduledEmail] ${messageId} held ${hold.holdCount} times, blocking`
        );
        await ctx.runMutation(internal.emails.markBlockedByMessageId, {
          messageId,
          reason: BLOCK_REASONS.verifierUnavailable,
          detail: gate.held.map((h) => `${h.email}: ${h.reason}`).join("; "),
        });
        await ctx.runMutation(internal.sendGate.recordBlocks, {
          userId: emails.userId,
          path: "scheduled",
          blocks: gate.held.map((h) => ({
            email: h.email,
            reason: BLOCK_REASONS.verifierUnavailable,
            detail: h.reason,
          })),
          mailboxId,
          messageId,
          batchId,
        });
        return;
      }

      const jobId = await ctx.scheduler.runAfter(
        HOLD_RETRY_MS,
        internal.ses.sendScheduledEmail,
        { s3Key, messageId, mailboxId, to: originalTo, cc: originalCc, bcc: originalBcc, fromAddress, batchId }
      );
      await ctx.runMutation(internal.emails.updateScheduledJobId, {
        messageId,
        scheduledJobId: String(jobId),
      });
      return;
    }

    // Every recipient refused. The row is marked blocked and kept, never
    // deleted, so it stays queryable with the reason.
    if (!hasRecipient) {
      const first = gate.blocked[0];
      await ctx.runMutation(internal.emails.markBlockedByMessageId, {
        messageId,
        reason: first?.reason ?? BLOCK_REASONS.invalidAddress,
        detail: describeRefusal(gate),
      });
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

    // Same courtesy screen as scheduleEmail above; sendScheduledEmail is the
    // authority at dispatch time.
    const schedApiGate = await evaluateForSend(ctx, {
      userId: mailbox.userId,
      domainId: mailbox.domainId,
      emails: to,
      path: "api",
      mailboxId,
      batchId,
      allowInlineVerification: true,
    });
    if (schedApiGate.sendingPaused) {
      throw new Error(
        `Sending is paused${schedApiGate.pausedReason ? `: ${schedApiGate.pausedReason}` : ""}.`
      );
    }
    if (
      schedApiGate.blocked.length > 0 &&
      schedApiGate.allowed.length === 0 &&
      schedApiGate.held.length === 0
    ) {
      throw new Error(`No eligible recipients. ${describeRefusal(schedApiGate)}`);
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
    // Which caller this is, for the block log. Defaults to the public API.
    path: v.optional(v.union(v.literal("api"), v.literal("sequence"))),
  },
  handler: async (ctx, { mailboxId, to, subject, html, batchId, path }) => {
    const mailbox = await ctx.runQuery(internal.emails.getMailboxWithDomain, { mailboxId });
    if (!mailbox) throw new Error("Mailbox not found");

    // ── Eligibility gate ──
    //
    // Sequence steps reach SES through this function, and they call it without
    // a batchId, so the old `if (batchId)` unsubscribe filter never ran for
    // them: a sequence would keep mailing someone who had opted out until the
    // sequence finished. The gate has no such conditional.
    //
    // `path` distinguishes the two callers in the block log, so it is possible
    // to tell afterwards whether bad addresses arrived through the public API
    // or through a sequence.
    const gate = await evaluateForSend(ctx, {
      userId: mailbox.userId,
      domainId: mailbox.domainId,
      emails: to,
      path: path ?? "api",
      mailboxId,
      batchId,
      // A single API send is interactive enough to wait for a first-time
      // lookup; a sequence step is not, and passes allowInlineVerification
      // false so the step is retried rather than delayed.
      allowInlineVerification: (path ?? "api") === "api",
    });

    // A hold is temporary and a block is permanent, and the caller has to be
    // able to tell them apart: a sequence retries the step on a hold and
    // cancels the enrollment on a block. The public API path, which has a
    // caller waiting on an HTTP response, gets an exception for the hold
    // instead so the client can retry the request.
    if (gate.sendingPaused || gate.held.length > 0) {
      if ((path ?? "api") === "sequence") {
        return { messageId: "held", blocked: gate.blocked, held: gate.held };
      }
      throw new Error(
        gate.sendingPaused
          ? `Sending is paused${gate.pausedReason ? `: ${gate.pausedReason}` : ""}.`
          : `Recipient verification is still pending. ${describeRefusal(gate)}`
      );
    }

    const apiPermitted = new Set(gate.allowed);
    to = to.filter((e) => apiPermitted.has(e.trim().toLowerCase()));
    if (to.length === 0) {
      // Not an error: a suppressed or unsubscribed recipient is an expected
      // outcome, and the sequence caller treats a throw as a step failure.
      return {
        messageId: "blocked",
        blocked: gate.blocked,
        held: gate.held,
      };
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
//
// Both spellings of the filename have to be tried at every prefix, because the
// two ingest paths disagree about the extension: the Lambda names its copy
// {messageId}.eml, while a row that came from the SNS route names the bare SES
// drop, which has no extension at all. The earlier version of this only ever
// stripped .eml and never added it, so from a bare row it could not reach the
// Lambda's copy. A message sitting readable in {domain}/{mailbox}/inbox/
// {messageId}.eml was reported as missing on that account alone.
function candidateS3Keys(s3Key: string, fullAddress: string): string[] {
  const [localPart, domain] = fullAddress.toLowerCase().split("@");
  if (!localPart || !domain) return [];

  const filename = s3Key.split("/").pop() || s3Key;
  const withoutExtension = filename.replace(/\.eml$/, "");
  const names = [withoutExtension, `${withoutExtension}.eml`];

  // const candidates = [
  //   `${domain}/${localPart}/incoming/${filename}`,
  //   `${domain}/${localPart}/inbox/${filename}`,
  //   `${domain}/incoming/${filename}`,
  //   `${domain}/incoming/${withoutExtension}`,
  // ];
  const candidates = [
    ...names.map((name) => `${domain}/${localPart}/incoming/${name}`),
    ...names.map((name) => `${domain}/${localPart}/inbox/${name}`),
    ...names.map((name) => `${domain}/incoming/${name}`),
  ];

  return candidates.filter((key, i) => key !== s3Key && candidates.indexOf(key) === i);
}

// Index everything under the domain's prefixes once, keyed by the message id
// embedded in the object name.
//
// candidateS3Keys can only find the namings we thought to write down, and it
// has already been wrong once: the extension gap above hid a message that was
// readable the whole time. Listing asks S3 where the message actually is
// rather than guessing, so a naming this code has never seen still resolves.
// The listing is done once per repair run and consulted in memory, because a
// per-row list would be several requests per broken email.
async function indexObjectsByMessageId(
  aws: AwsClientBundle,
  prefixes: string[]
): Promise<Map<string, string[]>> {
  const index = new Map<string, string[]>();

  for (const prefix of prefixes) {
    let continuationToken: string | undefined = undefined;
    do {
      const page: ListObjectsV2CommandOutput = await aws.s3.send(
        new ListObjectsV2Command({
          Bucket: aws.s3Bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );
      for (const object of page.Contents ?? []) {
        if (!object.Key) continue;
        const name = (object.Key.split("/").pop() || "").replace(/\.eml$/, "");
        if (!name) continue;
        const found = index.get(name);
        if (found) found.push(object.Key);
        else index.set(name, [object.Key]);
      }
      continuationToken = page.IsTruncated
        ? page.NextContinuationToken
        : undefined;
    } while (continuationToken);
  }

  return index;
}

// The message id as it appears in an object name, for looking a row up in the
// index above. Rows name their object either bare or with .eml.
function messageIdFromS3Key(s3Key: string): string {
  return (s3Key.split("/").pop() || s3Key).replace(/\.eml$/, "");
}

// A row should be repointed at a copy filed under its own mailbox before the
// shared drop, which whichever pipeline owns it is entitled to delete.
function preferMailboxCopy(keys: string[], domain: string): string[] {
  const dropPrefix = `${domain}/incoming/`;
  return [...keys].sort((a, b) => {
    const aIsDrop = a.startsWith(dropPrefix) ? 1 : 0;
    const bIsDrop = b.startsWith(dropPrefix) ? 1 : 0;
    return aIsDrop - bIsDrop;
  });
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
    const [inspectLocalPart, inspectDomain] = mailbox.fullAddress
      .toLowerCase()
      .split("@");

    // Same listing fallback the repair uses. Without it this report answers
    // "not at the keys I thought to check" while printing it as "not found",
    // which is what made a recoverable message look lost.
    let objectIndex: Map<string, string[]> | null = null;
    const lookupByMessageId = async (s3Key: string): Promise<string[]> => {
      if (!inspectLocalPart || !inspectDomain) return [];
      if (!objectIndex) {
        objectIndex = await indexObjectsByMessageId(aws, [
          `${inspectDomain}/${inspectLocalPart}/`,
          `${inspectDomain}/incoming/`,
        ]);
      }
      const matches = objectIndex.get(messageIdFromS3Key(s3Key)) ?? [];
      return preferMailboxCopy(matches, inspectDomain).filter(
        (key) => key !== s3Key
      );
    };

    for (const email of recent) {
      const keyExists = await s3ObjectExists(aws, email.s3Key);

      const alsoFoundAt: string[] = [];
      for (const candidate of candidateS3Keys(email.s3Key, mailbox.fullAddress)) {
        if (await s3ObjectExists(aws, candidate)) alsoFoundAt.push(candidate);
      }
      if (!keyExists) {
        for (const key of await lookupByMessageId(email.s3Key)) {
          if (!alsoFoundAt.includes(key)) alsoFoundAt.push(key);
        }
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

    const [localPart, domain] = mailbox.fullAddress.toLowerCase().split("@");

    // Built on first need, so a mailbox with nothing broken never pays for the
    // listing, and a mailbox with many broken rows pays for it exactly once.
    let objectIndex: Map<string, string[]> | null = null;
    const lookupByMessageId = async (s3Key: string): Promise<string | null> => {
      if (!localPart || !domain) return null;
      if (!objectIndex) {
        objectIndex = await indexObjectsByMessageId(aws, [
          `${domain}/${localPart}/`,
          `${domain}/incoming/`,
        ]);
      }
      const matches = objectIndex.get(messageIdFromS3Key(s3Key)) ?? [];
      const usable = preferMailboxCopy(matches, domain).filter(
        (key) => key !== s3Key
      );
      return usable[0] ?? null;
    };

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

      // No candidate matched, so stop guessing and ask S3 what it holds.
      if (!found) found = await lookupByMessageId(email.s3Key);

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

// Scheduled right after an inbound message is stored, so the ingest request
// itself never waits on a download and a MIME parse.
export const syncRecipientsFromS3 = internalAction({
  args: {
    emailId: v.id("emails"),
    s3Key: v.string(),
  },
  handler: async (ctx, { emailId, s3Key }) => {
    const aws = await clientsForS3Key(ctx, s3Key);
    await syncIngestedRecipients(ctx, aws, s3Key, emailId);
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

    // Only the raw SES drop is ours to move. The drop is the one object SES
    // itself writes, at {domain}/incoming/{messageId}: a flat per-domain
    // prefix, because a receipt rule matching the whole domain cannot template
    // its key per recipient. Anything else is already filed under a mailbox.
    //
    // This guard is the difference between one move and two. The Lambda hands
    // /ingestEmail a key it has already finished with,
    // {domain}/{mailbox}/inbox/{messageId}.eml, and without this check the old
    // code compared that to {domain}/{mailbox}/incoming/{messageId}.eml, found
    // them different, and copied the message a third time before deleting the
    // Lambda's copy. That is where the .eml files under incoming/ came from:
    // the Lambda never writes there. Re-moving a filed message buys nothing
    // and gives the delete another chance to land on the copy a row names.
    const segments = oldS3Key.split("/");
    const isRawDrop =
      segments.length === 3 && segments[0] === domain && segments[1] === "incoming";
    if (!isRawDrop) {
      await ctx.scheduler.runAfter(0, internal.ses.syncRecipientsFromS3, {
        emailId,
        s3Key: oldS3Key,
      });
      return;
    }

    const aws = await clientsForS3Key(ctx, oldS3Key);
    const bucket = aws.s3Bucket;

    const filename = oldS3Key.split("/").pop() || oldS3Key;
    const newS3Key = `${domain}/${localPart}/incoming/${filename}`;

    // Unreachable now that the guard above returns for every key that is not
    // the raw drop: a drop key can never equal the mailbox key built from it.
    // if (oldS3Key === newS3Key) {
    //   await ctx.scheduler.runAfter(0, internal.ses.syncRecipientsFromS3, {
    //     emailId,
    //     s3Key: oldS3Key,
    //   });
    //   return;
    // }

    // Take our own copy before doing anything else with the message.
    //
    // oldS3Key is the drop the sender's pipeline owns, and it deletes that
    // object once it has handed the message over. Everything we do before the
    // copy is time in which that delete can land first, and then the copy
    // fails, the row is left naming the deleted drop, and the message is gone
    // for good: no mailbox copy was ever made. So the copy goes first, the row
    // is pointed at it second, and the slow work (downloading and parsing the
    // message to read its real recipients) happens afterwards against our own
    // key, which nothing else can remove.
    //
    // A failed copy costs the message, so it is retried: a transient S3 error
    // here is the difference between a delivered mail and one that no longer
    // exists anywhere.
    let copied = false;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3 && !copied; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 400));
      try {
        await aws.s3.send(
          new CopyObjectCommand({
            Bucket: bucket,
            CopySource: encodeURI(`${bucket}/${oldS3Key}`),
            Key: newS3Key,
          })
        );
        copied = true;
      } catch (error) {
        lastError = error;
        // The source may be gone because an earlier run already copied it. If
        // the destination is there, adopt it rather than stranding the row.
        if (await s3ObjectExists(aws, newS3Key)) {
          console.error(
            `Copy from ${oldS3Key} failed but ${newS3Key} exists; adopting it:`,
            error
          );
          copied = true;
        }
      }
    }

    if (!copied) {
      // The drop is gone. Before stranding the row on a key that no longer
      // resolves, check whether the other consumer of this delivery already
      // filed the message somewhere: losing the race is not the same as
      // losing the mail, and it usually is not. Adopting its copy is what
      // keeps a transient race from costing an email permanently.
      const rescued = candidateS3Keys(oldS3Key, `${localPart}@${domain}`);
      for (const candidate of rescued) {
        if (await s3ObjectExists(aws, candidate)) {
          console.error(
            `Copy from ${oldS3Key} failed but the message is filed at ${candidate}; adopting it:`,
            lastError
          );
          await ctx.runMutation(internal.emails.updateS3Key, {
            emailId,
            s3Key: candidate,
          });
          await ctx.scheduler.runAfter(0, internal.ses.syncRecipientsFromS3, {
            emailId,
            s3Key: candidate,
          });
          return;
        }
      }

      console.error(
        `Failed to copy ${oldS3Key} to ${newS3Key} after 3 attempts; the row still points at the drop and the message may be lost:`,
        lastError
      );
      return;
    }

    // Point the row at our copy before removing the source, so a run cut
    // short leaves the row naming an object that exists.
    await ctx.runMutation(internal.emails.updateS3Key, {
      emailId,
      s3Key: newS3Key,
    });

    // Reading the recipients means downloading and parsing the whole message,
    // which is the slowest thing this pipeline does. It runs on its own after
    // the response goes back, so a slow or failing parse cannot hold up the
    // delivery or make the sender's pipeline time out and retry.
    await ctx.scheduler.runAfter(0, internal.ses.syncRecipientsFromS3, {
      emailId,
      s3Key: newS3Key,
    });

    try {
      await aws.s3.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: oldS3Key,
        })
      );
    } catch (error) {
      console.error(`Failed to delete ${oldS3Key} after copying:`, error);
    }
  },
});

// Repoint a row at a key a later delivery named, when the row's own key has
// stopped resolving and the new one has not.
//
// A second delivery of an already ingested message is usually nothing to act
// on, but it carries something the row cannot get anywhere else: another
// pipeline's opinion of where the message lives. When the row's key is dead
// and that opinion is alive, the redelivery is the row's chance to recover,
// and taking it turns a permanently broken email into a self-healing one.
//
// Deliberately conservative. A row whose object still reads is left exactly as
// it is, so this can only ever move a row off a key that is already broken.
export const reconcileS3Key = internalAction({
  args: {
    emailId: v.id("emails"),
    currentS3Key: v.string(),
    incomingS3Key: v.string(),
  },
  handler: async (ctx, { emailId, currentS3Key, incomingS3Key }) => {
    if (currentS3Key === incomingS3Key) {
      return { adopted: false, reason: "same key" };
    }

    const aws = await clientsForS3Key(ctx, incomingS3Key);

    if (await s3ObjectExists(aws, currentS3Key)) {
      return { adopted: false, reason: "current key still resolves" };
    }
    if (!(await s3ObjectExists(aws, incomingS3Key))) {
      return { adopted: false, reason: "neither key resolves" };
    }

    await ctx.runMutation(internal.emails.updateS3Key, {
      emailId,
      s3Key: incomingS3Key,
    });
    console.log(
      `Adopted ${incomingS3Key} for an email whose key ${currentS3Key} no longer resolves`
    );
    await ctx.scheduler.runAfter(0, internal.ses.syncRecipientsFromS3, {
      emailId,
      s3Key: incomingS3Key,
    });

    return { adopted: true, s3Key: incomingS3Key };
  },
});
