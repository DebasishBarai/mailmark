import { NextRequest, NextResponse } from "next/server";
import { S3Client, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

function getS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

export async function POST(req: NextRequest) {
  const snsMessageType = req.headers.get("x-amz-sns-message-type");

  // Handle SNS messages (from SES receipt rule → SNS → HTTPS subscription)
  if (snsMessageType) {
    return handleSnsMessage(req, snsMessageType);
  }

  // Legacy: direct webhook calls with secret header
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.SES_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    return await ingestEmail(body);
  } catch (error) {
    console.error("SES webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleSnsMessage(req: NextRequest, messageType: string) {
  try {
    const body = await req.json();

    // Auto-confirm SNS subscription
    if (messageType === "SubscriptionConfirmation") {
      const subscribeUrl = body.SubscribeURL;
      if (subscribeUrl) {
        await fetch(subscribeUrl);
        console.log("SNS subscription confirmed");
      }
      return NextResponse.json({ success: true });
    }

    // Handle SNS notification containing SES email data
    if (messageType === "Notification") {
      const message = JSON.parse(body.Message);
      const notificationType = message.notificationType;

      if (notificationType !== "Received") {
        // Ignore bounce/complaint/delivery notifications
        return NextResponse.json({ success: true });
      }

      const mail = message.mail;
      const receipt = message.receipt;

      // Extract S3 key from the receipt action
      const s3Action = receipt?.action;
      const s3Key = s3Action?.objectKey || "";

      const emailData = {
        key: s3Key,
        from: mail.source,
        to: mail.destination || [],
        subject: mail.commonHeaders?.subject || "(no subject)",
        date: mail.commonHeaders?.date || mail.timestamp,
        messageId: mail.messageId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        hasAttachments: (mail.commonHeaders?.["content-type"] || "").includes("multipart") || false,
      };

      return await ingestEmail(emailData);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SNS message handling error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Move S3 object from domain/incoming/ to domain/mailbox/incoming/
async function moveS3Object(oldKey: string, recipientAddress: string): Promise<string> {
  const [localPart, domain] = recipientAddress.toLowerCase().split("@");
  if (!localPart || !domain) return oldKey;

  const filename = oldKey.split("/").pop() || oldKey;
  const newKey = `${domain}/${localPart}/incoming/${filename}`;

  if (oldKey === newKey) return oldKey;

  const bucket = process.env.AWS_S3_BUCKET!;
  const s3 = getS3Client();

  try {
    await s3.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${oldKey}`,
        Key: newKey,
      })
    );
    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: oldKey,
      })
    );
    return newKey;
  } catch (error) {
    console.error("Failed to move S3 object:", error);
    return oldKey;
  }
}

async function ingestEmail(emailData: {
  key: string;
  from: string;
  to: string[];
  subject: string;
  date: string | number;
  messageId: string;
  hasAttachments: boolean;
}) {
  const { key, from, to, subject, date, messageId, hasAttachments } = emailData;

  // Forward each recipient's email to the Convex HTTP endpoint
  for (const recipient of to) {
    // Move S3 object to domain/mailbox/incoming/ path
    const newS3Key = await moveS3Object(key, recipient);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL}/ingestEmail`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": process.env.SES_WEBHOOK_SECRET!,
        },
        body: JSON.stringify({
          recipientAddress: recipient,
          from,
          to,
          subject: subject || "(no subject)",
          date: typeof date === "number" ? date : new Date(date).getTime() || Date.now(),
          messageId: messageId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          hasAttachments: hasAttachments || false,
          s3Key: newS3Key,
        }),
      }
    );

    if (!response.ok) {
      console.error("Failed to ingest email:", await response.text());
    }
  }

  return NextResponse.json({ success: true });
}
