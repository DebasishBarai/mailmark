"use node";

import { DOMParser } from "@xmldom/xmldom";
// Convex's bundler loads the browser build of the AWS SDK XML parser,
// which expects DOMParser to be a global. Polyfill it for Node.js.
if (typeof globalThis.DOMParser === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).DOMParser = DOMParser;
}

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { S3Client, PutObjectCommand, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { simpleParser } from "mailparser";

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
    const mailbox = await ctx.runQuery(internal.emails.getMailboxWithDomain, {
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

    // Parse MIME email to extract HTML or text body
    const parsed = await simpleParser(rawEmail);
    if (parsed.html) {
      return parsed.html as string;
    }
    if (parsed.textAsHtml) {
      return parsed.textAsHtml;
    }
    if (parsed.text) {
      return parsed.text;
    }
    return rawEmail;
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

    console.log("Moving S3 object:", oldS3Key, "→", newS3Key);
    const bucket = process.env.AWS_S3_BUCKET!;
    const s3 = getS3Client();

    try {
      await s3.send(
        new CopyObjectCommand({
          Bucket: bucket,
          CopySource: encodeURI(`${bucket}/${oldS3Key}`),
          Key: newS3Key,
        })
      );
      await s3.send(
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
