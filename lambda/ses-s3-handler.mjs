/**
 * AWS Lambda: SES → S3 → Convex Webhook
 *
 * Trigger: S3 PutObject event on the devmail-emails bucket
 * (only for keys matching {domain}/incoming/*)
 *
 * What it does:
 *  1. Receives the S3 event (new .eml file dropped by SES receipt rule)
 *  2. Downloads the raw email from S3
 *  3. Parses headers (From, To, Subject, Date, Message-ID, Content-Type)
 *  4. Re-saves the email under the correct mailbox path:
 *     {domain}/{localPart}/inbox/{messageId}.eml
 *  5. Calls the Convex HTTP endpoint (/ingestEmail) with the metadata
 *
 * Environment variables (set in Lambda config):
 *   CONVEX_SITE_URL   — e.g. https://harmless-armadillo-386.convex.site
 *   WEBHOOK_SECRET    — must match SES_WEBHOOK_SECRET in Convex env
 *   S3_BUCKET         — e.g. devmail-emails
 */

import { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({});

export async function handler(event) {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    // S3 key is URL-encoded in the event
    const rawKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    console.log(`Processing: s3://${bucket}/${rawKey}`);

    // Only process emails from the SES incoming prefix
    // Expected key format: {domain}/incoming/{ses-message-id}
    const incomingMatch = rawKey.match(/^([^/]+)\/incoming\/(.+)$/);
    if (!incomingMatch) {
      console.log(`Skipping non-incoming key: ${rawKey}`);
      continue;
    }

    const domain = incomingMatch[1];
    const sesMessageId = incomingMatch[2];

    // Download the raw email
    let rawEmail;
    try {
      const response = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: rawKey })
      );
      rawEmail = await response.Body.transformToString("utf-8");
    } catch (err) {
      console.error(`Failed to download s3://${bucket}/${rawKey}:`, err);
      continue;
    }

    // Parse email headers
    const parsed = parseEmailHeaders(rawEmail);

    // Determine recipients on this domain
    const allRecipients = [
      ...parseAddressList(parsed.to),
      ...parseAddressList(parsed.cc),
    ];
    const domainRecipients = allRecipients.filter((addr) =>
      addr.toLowerCase().endsWith("@" + domain.toLowerCase())
    );

    if (domainRecipients.length === 0) {
      console.log(`No recipients found for domain ${domain}, skipping`);
      continue;
    }

    const messageId = sesMessageId;
    const hasAttachments = checkForAttachments(parsed.contentType, rawEmail);

    // For each recipient mailbox, copy the email and notify Convex
    for (const recipient of domainRecipients) {
      const localPart = recipient.split("@")[0].toLowerCase();

      // Copy email to the mailbox-specific path
      const newKey = `${domain}/${localPart}/inbox/${messageId}.eml`;

      try {
        await s3.send(
          new CopyObjectCommand({
            Bucket: bucket,
            CopySource: `${bucket}/${rawKey}`,
            Key: newKey,
            ContentType: "message/rfc822",
          })
        );
      } catch (err) {
        console.error(`Failed to copy to ${newKey}:`, err);
        continue;
      }

      // Call Convex HTTP endpoint
      const payload = {
        recipientAddress: recipient.toLowerCase(),
        from: parsed.from,
        to: domainRecipients,
        subject: parsed.subject || "(no subject)",
        date: parsed.date ? new Date(parsed.date).getTime() : Date.now(),
        messageId,
        hasAttachments,
        s3Key: newKey,
      };

      try {
        const res = await fetch(
          `${process.env.CONVEX_SITE_URL}/ingestEmail`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-webhook-secret": process.env.WEBHOOK_SECRET,
            },
            body: JSON.stringify(payload),
          }
        );

        if (!res.ok) {
          const text = await res.text();
          console.error(`Convex ingest failed for ${recipient}: ${res.status} ${text}`);
        } else {
          console.log(`Ingested email for ${recipient}: ${parsed.subject}`);
        }
      } catch (err) {
        console.error(`Failed to call Convex for ${recipient}:`, err);
      }
    }

    // Delete the original incoming/ copy (we've moved it to mailbox paths)
    try {
      await s3.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: rawKey })
      );
    } catch (err) {
      console.error(`Failed to delete original ${rawKey}:`, err);
    }
  }

  return { statusCode: 200, body: "OK" };
}

/**
 * Parse key email headers from raw RFC 822 email text.
 */
function parseEmailHeaders(raw) {
  // Headers end at the first blank line
  const headerEndIndex = raw.indexOf("\r\n\r\n");
  const headerSection =
    headerEndIndex !== -1
      ? raw.slice(0, headerEndIndex)
      : raw.slice(0, raw.indexOf("\n\n"));

  // Unfold multi-line headers (lines starting with whitespace are continuations)
  const unfolded = headerSection.replace(/\r?\n[ \t]+/g, " ");

  const headers = {};
  for (const line of unfolded.split(/\r?\n/)) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();
    headers[key] = value;
  }

  return {
    from: headers["from"] || "",
    to: headers["to"] || "",
    cc: headers["cc"] || "",
    subject: decodeSubject(headers["subject"] || ""),
    date: headers["date"] || "",
    messageId: headers["message-id"] || "",
    contentType: headers["content-type"] || "",
  };
}

/**
 * Extract individual email addresses from a header value like:
 * "John Smith <john@example.com>, jane@example.com"
 */
function parseAddressList(headerValue) {
  if (!headerValue) return [];

  const addresses = [];
  // Split by comma, but not commas inside quotes
  const parts = headerValue.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);

  for (const part of parts) {
    const trimmed = part.trim();
    // Match <email@domain.com> pattern
    const angleMatch = trimmed.match(/<([^>]+)>/);
    if (angleMatch) {
      addresses.push(angleMatch[1].trim());
    } else if (trimmed.includes("@")) {
      // Plain email address
      addresses.push(trimmed);
    }
  }

  return addresses;
}

/**
 * Decode MIME encoded-word subjects (=?UTF-8?B?...?= or =?UTF-8?Q?...?=)
 */
function decodeSubject(subject) {
  return subject.replace(
    /=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi,
    (match, charset, encoding, encoded) => {
      try {
        if (encoding.toUpperCase() === "B") {
          return Buffer.from(encoded, "base64").toString("utf-8");
        } else {
          // Quoted-printable
          const decoded = encoded
            .replace(/_/g, " ")
            .replace(/=([0-9A-Fa-f]{2})/g, (m, hex) =>
              String.fromCharCode(parseInt(hex, 16))
            );
          return decoded;
        }
      } catch {
        return match;
      }
    }
  );
}

/**
 * Check if the email likely has attachments based on Content-Type.
 */
function checkForAttachments(contentType, rawEmail) {
  if (!contentType) return false;
  // Multipart/mixed usually means attachments
  if (contentType.toLowerCase().includes("multipart/mixed")) return true;
  // Also check for Content-Disposition: attachment in the body
  if (rawEmail.includes("Content-Disposition: attachment")) return true;
  return false;
}
