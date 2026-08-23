"use node";

import { DOMParser } from "@xmldom/xmldom";
// Convex's bundler loads the browser build of the AWS SDK XML parser,
// which expects DOMParser to be a global. Polyfill it for Node.js.
if (typeof globalThis.DOMParser === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).DOMParser = DOMParser;
}

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import {
  getPlatformAwsClients,
  getAwsClientsForAccount,
  type AwsClientBundle,
} from "./lib/awsClients";
import type { Doc } from "./_generated/dataModel";

// Mailbox that receives portal applications. Overridable so staging can
// point somewhere else without a code change.
const JOBS_MAILBOX = (
  process.env.JOBS_MAILBOX_ADDRESS ?? "jobs@mailmark.dev"
).toLowerCase();

async function clientsForMailbox(mailbox: {
  awsAccount?: Doc<"awsAccounts"> | null;
}): Promise<AwsClientBundle> {
  if (mailbox.awsAccount) return await getAwsClientsForAccount(mailbox.awsAccount);
  return getPlatformAwsClients();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * RFC 2047 encoded-word for header values containing non-ASCII characters.
 * Applicant names routinely do, and an unencoded 8-bit header renders as
 * mojibake in the mailbox list (the same reason some inbound subjects
 * currently show up as raw =?UTF-8?B?...?= strings).
 */
function encodeHeaderValue(value: string): string {
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

/** Strip CR/LF so a submitted value can never inject extra headers. */
function sanitiseHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/** `From`/`Reply-To` value for the MIME headers. */
function formatAddressHeader(name: string, email: string): string {
  const clean = sanitiseHeader(name).replace(/"/g, "");
  const encoded = encodeHeaderValue(clean);
  // An encoded-word must not sit inside a quoted string (RFC 2047 s5), so
  // only plain-ASCII names get quoted.
  const display = encoded === clean ? `"${clean}"` : encoded;
  return `${display} <${sanitiseHeader(email)}>`;
}

/**
 * Display value stored on the `emails` row. This one is never a MIME header,
 * so it stays unencoded and readable; the mailbox list renders it directly
 * and `getRawEmail` pulls the address back out of the angle brackets.
 */
function formatAddressDisplay(name: string, email: string): string {
  return `${sanitiseHeader(name).replace(/"/g, "")} <${sanitiseHeader(email)}>`;
}

/**
 * Builds the RFC 822 message that lands in the jobs@ inbox.
 *
 * `From` is the applicant, so the mailbox Reply button (which reads
 * `email.from`) opens a reply straight to the candidate, exactly as it does
 * for the applications that arrive by ordinary email. This message is never
 * handed to SES: it is written to S3 and inserted into the `emails` table
 * directly, the same shape the inbound Lambda produces.
 */
function buildApplicationEml(params: {
  application: Doc<"jobApplications">;
  messageId: string;
  domain: string;
  resumeBase64: string;
  siteUrl: string;
}): { raw: string; html: string } {
  const { application: app, messageId, domain, resumeBase64, siteUrl } = params;
  const boundary = `----=_Mailmark_Job_${messageId}`;

  const rows: Array<[string, string]> = [
    ["Role", app.jobTitle],
    ["Name", app.name],
    ["Email", app.email],
  ];
  if (app.phone) rows.push(["Phone", app.phone]);
  if (app.location) rows.push(["Location", app.location]);

  const links: Array<[string, string]> = [];
  if (app.portfolioUrl) links.push(["Portfolio", app.portfolioUrl]);
  if (app.githubUrl) links.push(["GitHub", app.githubUrl]);
  if (app.linkedinUrl) links.push(["LinkedIn", app.linkedinUrl]);

  const detailRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#6b7280;font-size:13px;white-space:nowrap">${escapeHtml(
          label
        )}</td><td style="padding:4px 0;color:#111827;font-size:14px">${escapeHtml(
          value
        )}</td></tr>`
    )
    .join("");

  const linkRows = links
    .map(
      ([label, url]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#6b7280;font-size:13px;white-space:nowrap">${escapeHtml(
          label
        )}</td><td style="padding:4px 0;font-size:14px"><a href="${escapeHtml(
          url
        )}" style="color:#7c3aed">${escapeHtml(url)}</a></td></tr>`
    )
    .join("");

  const coverLetterHtml = escapeHtml(app.coverLetter).replace(/\n/g, "<br />");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;line-height:1.6">
<p style="margin:0 0 4px"><strong>New application via the careers portal</strong></p>
<p style="margin:0 0 20px;color:#6b7280;font-size:13px">Reply to this email to respond to ${escapeHtml(
    app.name
  )} directly.</p>
<table style="border-collapse:collapse;margin-bottom:20px">${detailRows}${linkRows}</table>
<div style="border-top:1px solid #e5e7eb;padding-top:16px">
<p style="margin:0 0 8px;font-weight:600;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Cover letter</p>
<div style="font-size:14px">${coverLetterHtml}</div>
</div>
<p style="margin:24px 0 0;font-size:12px;color:#9ca3af">Resume attached. Submitted from ${escapeHtml(
    siteUrl
  )}/careers/${escapeHtml(app.jobSlug)}.</p>
</div>`;

  const wrappedResume = resumeBase64.match(/.{1,76}/g)?.join("\r\n") ?? resumeBase64;
  const subject = encodeHeaderValue(
    sanitiseHeader(`Application: ${app.jobTitle} - ${app.name}`)
  );

  const raw = [
    `MIME-Version: 1.0`,
    `From: ${formatAddressHeader(app.name, app.email)}`,
    `To: ${JOBS_MAILBOX}`,
    `Reply-To: ${sanitiseHeader(app.email)}`,
    `Subject: ${subject}`,
    `Date: ${new Date(app.submittedAt).toUTCString()}`,
    `Message-ID: <${messageId}@${domain}>`,
    `X-Mailmark-Job-Slug: ${sanitiseHeader(app.jobSlug)}`,
    `X-Mailmark-Source: careers-portal`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    html,
    `--${boundary}`,
    `Content-Type: ${app.resumeContentType}; name="${app.resumeFilename.replace(/"/g, "")}"`,
    `Content-Disposition: attachment; filename="${app.resumeFilename.replace(/"/g, "")}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    wrappedResume,
    `--${boundary}--`,
  ].join("\r\n");

  return { raw, html };
}

function buildAcknowledgementHtml(params: {
  name: string;
  jobTitle: string;
  isGeneral: boolean;
  siteUrl: string;
}): string {
  const { name, jobTitle, isGeneral, siteUrl } = params;
  const firstName = escapeHtml(name.split(/\s+/)[0] ?? name);
  const roleLine = isGeneral
    ? `Thanks for your general application to Mailmark.`
    : `Thanks for applying for the <strong>${escapeHtml(jobTitle)}</strong> role at Mailmark.`;

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;padding:32px 16px">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #eef0f3">
<p style="margin:0 0 24px;font-size:20px;font-weight:700;color:#7c3aed">Mailmark</p>
<p style="margin:0 0 16px;font-size:16px;color:#111827">Hi ${firstName},</p>
<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6">${roleLine} We've received it, and your resume came through fine.</p>
<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6">We read every application ourselves. If it looks like a fit, you'll hear from a real person within about a week. If you don't hear back in that time, it means we've gone in a different direction for now, and we'll keep your details on file for future openings.</p>
<p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6">You can reply directly to this email if you'd like to add anything.</p>
<p style="margin:0;font-size:15px;color:#374151">Thanks for your interest,<br />The Mailmark team</p>
<div style="margin-top:28px;padding-top:16px;border-top:1px solid #eef0f3">
<a href="${siteUrl}/careers" style="color:#7c3aed;font-size:13px;text-decoration:none">See all open roles</a>
</div>
</div>
</div>`;
}

/**
 * Delivers both sides of a submitted application:
 *   1. a copy into the jobs@ inbox, written straight to S3 and the emails
 *      table so it reads exactly like an emailed application
 *   2. a transactional acknowledgement to the applicant, sent via SES
 *
 * Each half is recorded separately, so one failing does not roll back the
 * other and the application row shows exactly how far delivery got.
 */
export const deliverApplication = internalAction({
  args: { applicationId: v.id("jobApplications") },
  handler: async (ctx, { applicationId }) => {
    const app = await ctx.runQuery(internal.jobApplications.getInternal, {
      applicationId,
    });
    if (!app) throw new Error(`Application ${applicationId} not found`);

    const siteUrl = process.env.APP_URL ?? "https://www.mailmark.dev";

    const mailboxRow = await ctx.runQuery(internal.mailboxes.getByFullAddress, {
      fullAddress: JOBS_MAILBOX,
    });
    if (!mailboxRow) {
      // The application is already stored, so this is recoverable: create the
      // mailbox and the copy can be replayed.
      await ctx.runMutation(internal.jobApplications.recordDeliveryError, {
        applicationId,
        error: `Mailbox ${JOBS_MAILBOX} does not exist, application stored but not delivered to the inbox`,
      });
      return;
    }

    const mailbox = await ctx.runQuery(internal.emails.getMailboxWithDomain, {
      mailboxId: mailboxRow._id,
    });
    if (!mailbox) {
      await ctx.runMutation(internal.jobApplications.recordDeliveryError, {
        applicationId,
        error: `Mailbox ${JOBS_MAILBOX} has no resolvable domain`,
      });
      return;
    }

    // ── 1. Copy into the jobs@ inbox ──────────────────────────────────────
    try {
      const resumeBlob = await ctx.storage.get(app.resumeStorageId);
      if (!resumeBlob) throw new Error("Resume file is missing from storage");
      const resumeBase64 = Buffer.from(await resumeBlob.arrayBuffer()).toString("base64");

      const messageId = `job-${app._id}-${Date.now().toString(36)}`;
      const { raw, html } = buildApplicationEml({
        application: app,
        messageId,
        domain: mailbox.domain,
        resumeBase64,
        siteUrl,
      });

      const aws = await clientsForMailbox(mailbox);
      const s3Key = `${mailbox.domain}/${mailbox.address}/inbox/${messageId}.eml`;
      await aws.s3.send(
        new PutObjectCommand({
          Bucket: aws.s3Bucket,
          Key: s3Key,
          Body: raw,
          ContentType: "message/rfc822",
        })
      );

      const inboxEmailId = await ctx.runMutation(internal.emails.insertFromWebhook, {
        mailboxId: mailbox._id,
        messageId,
        from: formatAddressDisplay(app.name, app.email),
        to: [JOBS_MAILBOX],
        subject: `Application: ${app.jobTitle} - ${app.name}`,
        snippet: html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 100),
        date: app.submittedAt,
        hasAttachments: true,
        s3Key,
        folder: "inbox",
      });

      await ctx.runMutation(internal.jobApplications.recordInboxDelivery, {
        applicationId,
        inboxEmailId,
      });

      // Keep the applicant in contacts, same as the inbound webhook does.
      await ctx.runMutation(internal.contacts.upsert, {
        userId: mailbox.userId,
        email: app.email,
        name: app.name,
      });
    } catch (err) {
      await ctx.runMutation(internal.jobApplications.recordDeliveryError, {
        applicationId,
        error: `Inbox copy failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    // ── 2. Acknowledge the applicant ──────────────────────────────────────
    try {
      // Sent through the existing sendEmailViaApi path, so Mailmark's normal
      // sending rules (monthly quota, warming daily limit) apply unchanged.
      // If either one blocks the send it throws, and the reason is recorded
      // on the application row below rather than being swallowed.
      const result = await ctx.runAction(internal.ses.sendEmailViaApi, {
        mailboxId: mailbox._id,
        to: [app.email],
        subject: app.jobSlug === "general"
          ? "We received your application - Mailmark"
          : `We received your application - ${app.jobTitle}`,
        html: buildAcknowledgementHtml({
          name: app.name,
          jobTitle: app.jobTitle,
          isGeneral: app.jobSlug === "general",
          siteUrl,
        }),
      });
      await ctx.runMutation(internal.jobApplications.recordAckSent, {
        applicationId,
        ackMessageId: result.messageId,
      });
    } catch (err) {
      await ctx.runMutation(internal.jobApplications.recordDeliveryError, {
        applicationId,
        error: `Acknowledgement failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  },
});
