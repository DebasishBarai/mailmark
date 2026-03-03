import { NextRequest, NextResponse } from "next/server";

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

      console.log("[SNS] notificationType:", notificationType);

      if (notificationType === "Delivery") {
        return await handleDeliveryNotification(message, "delivered");
      }

      if (notificationType === "Bounce") {
        const bounceType = message.bounce?.bounceType;
        // Permanent bounces = failed, transient bounces = bounced (temporary)
        const status = bounceType === "Permanent" ? "failed" : "bounced";
        return await handleDeliveryNotification(message, status);
      }

      if (notificationType !== "Received") {
        // Ignore complaint/other notifications
        console.log("[SNS] ignoring notificationType:", notificationType);
        return NextResponse.json({ success: true });
      }

      const mail = message.mail;
      const receipt = message.receipt;

      // The SNS action triggers this notification, so receipt.action refers to
      // the SNS action (not S3). Construct the S3 key from the known prefix
      // pattern and messageId. Also check receipt.action.objectKey as fallback.
      const recipients = mail.destination || [];
      const domain = recipients[0]?.split("@")[1] || "";
      const sesMessageId = mail.messageId || "";
      const s3Key = receipt?.action?.objectKey
        || (domain && sesMessageId ? `${domain}/incoming/${sesMessageId}` : "");

      const emailData = {
        key: s3Key,
        from: mail.commonHeaders?.from?.[0] || mail.source,
        to: recipients,
        subject: mail.commonHeaders?.subject || "(no subject)",
        date: mail.commonHeaders?.date || mail.timestamp,
        messageId: sesMessageId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

async function handleDeliveryNotification(
  message: Record<string, unknown>,
  status: "delivered" | "failed" | "bounced"
) {
  const mail = message.mail as Record<string, unknown> | undefined;
  console.log("[DELIVERY] status:", status, "| mail present:", !!mail);
  if (!mail) return NextResponse.json({ success: true });

  // In SES Configuration Set event notifications, mail.commonHeaders uses
  // camelCase keys and scalar values (not arrays). "messageId" holds the
  // Message-ID header we embedded in the raw MIME: <{ourId}@{domain}>.
  // mail.messageId is the SES-assigned ID and won't match our DB records.
  const commonHeaders = mail.commonHeaders as Record<string, unknown> | undefined;
  const rawHeadersArray = mail.headers as Array<{ name: string; value: string }> | undefined;

  console.log("[DELIVERY] mail.messageId (SES-assigned):", mail.messageId);
  console.log("[DELIVERY] commonHeaders:", JSON.stringify(commonHeaders));
  console.log("[DELIVERY] headers array:", JSON.stringify(rawHeadersArray));

  const messageIdHeader =
    (commonHeaders?.["messageId"] as string | undefined) ??
    (commonHeaders?.["message-id"] as string | undefined) ??
    // Fallback: scan the raw headers array for a Message-ID entry
    rawHeadersArray?.find((h) => h.name.toLowerCase() === "message-id")?.value ??
    "";
  console.log("[DELIVERY] messageIdHeader (raw):", messageIdHeader);

  // Strip angle brackets then take the local part before '@'
  const messageId = messageIdHeader.replace(/^<|>$/g, "").split("@")[0];
  console.log("[DELIVERY] extracted messageId:", messageId || "(empty — will skip)");

  if (!messageId) return NextResponse.json({ success: true });

  const deliveryTimestamp =
    (message.delivery as Record<string, unknown> | undefined)?.timestamp ??
    (message.bounce as Record<string, unknown> | undefined)?.timestamp ??
    new Date().toISOString();

  const timestamp =
    typeof deliveryTimestamp === "number"
      ? deliveryTimestamp
      : new Date(deliveryTimestamp as string).getTime() || Date.now();

  console.log("[DELIVERY] calling /trackDelivery with messageId:", messageId, "status:", status);
  const trackRes = await fetch(
    `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL}/trackDelivery`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": process.env.SES_WEBHOOK_SECRET!,
      },
      body: JSON.stringify({ messageId, status, timestamp }),
    }
  );
  console.log("[DELIVERY] /trackDelivery response status:", trackRes.status, await trackRes.text());

  return NextResponse.json({ success: true });
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
          s3Key: key,
        }),
      }
    );

    if (!response.ok) {
      console.error("Failed to ingest email:", await response.text());
    }
  }

  return NextResponse.json({ success: true });
}
