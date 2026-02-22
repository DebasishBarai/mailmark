"use node";

import { v } from "convex/values";
import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

export const getMailboxWithDomain = internalQuery({
  args: { mailboxId: v.id("mailboxes") },
  handler: async (ctx, { mailboxId }) => {
    const mailbox = await ctx.db.get(mailboxId);
    if (!mailbox) return null;

    const domain = await ctx.db.get(mailbox.domainId);
    if (!domain) return null;

    return {
      ...mailbox,
      domain: domain.domain,
    };
  },
});

function getSESClient() {
  return new SESv2Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

function getS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

export const sendEmail = action({
  args: {
    mailboxId: v.id("mailboxes"),
    to: v.array(v.string()),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, { mailboxId, to, subject, body }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get mailbox and domain info
    const mailbox = await ctx.runQuery(internal.ses.getMailboxWithDomain, {
      mailboxId,
    });

    if (!mailbox) throw new Error("Mailbox not found");

    const fromAddress = mailbox.displayName
      ? `${mailbox.displayName} <${mailbox.fullAddress}>`
      : mailbox.fullAddress;

    // Send via SES
    const ses = getSESClient();
    const messageId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: fromAddress,
        Destination: {
          ToAddresses: to,
        },
        Content: {
          Simple: {
            Subject: { Data: subject },
            Body: {
              Html: { Data: body },
              Text: { Data: body.replace(/<[^>]*>/g, "") },
            },
          },
        },
      })
    );

    // Save raw email to S3
    const s3Key = `${mailbox.domain}/${mailbox.address}/sent/${messageId}.eml`;
    const rawEmail = [
      `From: ${fromAddress}`,
      `To: ${to.join(", ")}`,
      `Subject: ${subject}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${messageId}@${mailbox.domain}>`,
      `Content-Type: text/html; charset=UTF-8`,
      "",
      body,
    ].join("\r\n");

    const s3 = getS3Client();
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
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
      from: mailbox.fullAddress,
      to,
      subject,
      snippet,
      date: Date.now(),
      s3Key,
    });

    return { success: true, messageId };
  },
});

export const fetchEmailBody = action({
  args: { s3Key: v.string() },
  handler: async (ctx, { s3Key }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const s3 = getS3Client();
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: s3Key,
      })
    );

    const rawEmail = await response.Body?.transformToString("utf-8");
    if (!rawEmail) throw new Error("Email not found in S3");

    // Parse body from raw email (split on double CRLF)
    const bodyStart = rawEmail.indexOf("\r\n\r\n");
    if (bodyStart === -1) {
      const altBodyStart = rawEmail.indexOf("\n\n");
      if (altBodyStart === -1) return rawEmail;
      return rawEmail.slice(altBodyStart + 2);
    }
    return rawEmail.slice(bodyStart + 4);
  },
});
