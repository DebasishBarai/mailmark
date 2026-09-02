import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const snsMessageType = req.headers.get("x-amz-sns-message-type");
  console.log("[WEBHOOK] POST received | x-amz-sns-message-type:", snsMessageType ?? "(none)");

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
      console.log("[SNS] SubscriptionConfirmation received | TopicArn:", body.TopicArn, "| SubscribeURL:", subscribeUrl);
      if (subscribeUrl) {
        const confirmRes = await fetch(subscribeUrl);
        console.log("[SNS] confirmation fetch status:", confirmRes.status);
      } else {
        console.log("[SNS] SubscriptionConfirmation missing SubscribeURL");
      }
      return NextResponse.json({ success: true });
    }

    // Handle SNS notification containing SES email data
    if (messageType === "Notification") {
      const message = JSON.parse(body.Message);
      // SES v2 Configuration Set events use "eventType";
      // SES v1 receipt rule notifications use "notificationType".
      const eventType = message.eventType ?? message.notificationType;

      console.log("[SNS] eventType:", eventType);

      if (eventType === "Delivery") {
        return await handleDeliveryNotification(message, "delivered");
      }

      if (eventType === "Bounce") {
        const bounceType = message.bounce?.bounceType;
        // Permanent bounces = failed, transient bounces = bounced (temporary)
        const status = bounceType === "Permanent" ? "failed" : "bounced";
        const diagnosticCode =
          message.bounce?.bouncedRecipients?.[0]?.diagnosticCode;
        const reason =
          diagnosticCode ??
          [bounceType, message.bounce?.bounceSubType].filter(Boolean).join("/");
        // The raw SES fields are forwarded alongside the collapsed status.
        // "failed" and "bounced" above are this codebase's own labels for
        // permanent and transient, which is not what either word suggests, so
        // per-account bounce accounting classifies on bounceType instead.
        return await handleDeliveryNotification(message, status, reason, {
          bounceType,
          bounceSubType: message.bounce?.bounceSubType,
          diagnosticCode,
          recipient: message.bounce?.bouncedRecipients?.[0]?.emailAddress,
        });
      }

      // Complaints were dropped here entirely. They still are for ordinary
      // mail, which has no "complained" delivery status to record, but warmup
      // needs them: a complaint against a warmup send is a reputation event on
      // the customer's own SES account.
      if (eventType === "Complaint") {
        const complaintFeedbackType = message.complaint?.complaintFeedbackType;
        const reason = complaintFeedbackType ?? "complaint";
        return await handleDeliveryNotification(message, "complained", reason, {
          complaintFeedbackType,
          recipient: message.complaint?.complainedRecipients?.[0]?.emailAddress,
        });
      }

      // Inbound mail is not ingested here any more.
      //
      // Every inbound message used to be ingested twice, by two independent
      // pipelines hanging off the same SES receipt rule. The S3 action drops
      // the message and the Lambda (lambda/ses-s3-handler.mjs) files it under
      // {domain}/{mailbox}/inbox/{messageId}.eml, calls /ingestEmail with that
      // final key, then deletes the drop. The SNS action then brought the same
      // message here, where it was ingested a second time.
      //
      // Convex dedupes the row by messageId, so the second ingest was
      // invisible until the two raced: this path had to guess the drop key
      // (receipt.action refers to the SNS action, so objectKey is undefined
      // here and the key was reconstructed from the domain and messageId),
      // and when the Lambda's delete landed inside the guessed copy's retry
      // window, the row was left naming an object that no longer existed and
      // the mailbox showed "Failed to load email body".
      //
      // The Lambda is better at this in every respect: it reads the real key
      // from the S3 event rather than reconstructing it, takes recipients from
      // the parsed To and Cc headers, and detects attachments from the raw
      // body instead of a commonHeaders content-type that SES usually omits.
      // So it keeps the job and this path stands down.
      //
      // Sending events (Delivery, Bounce, Complaint) arrive from the sending
      // configuration set's own topic and are handled above; they are
      // unaffected.
      if (eventType === "Received") {
        console.log(
          "[SNS] ignoring inbound Received notification; the ingest Lambda owns this message"
        );
        return NextResponse.json({ success: true, ignored: "received" });
      }

      console.log("[SNS] ignoring eventType:", eventType);
      return NextResponse.json({ success: true });

      // const mail = message.mail;
      // const receipt = message.receipt;
      //
      // const recipients = mail.destination || [];
      // const domain = recipients[0]?.split("@")[1] || "";
      // const sesMessageId = mail.messageId || "";
      // const s3Key = receipt?.action?.objectKey
      //   || (domain && sesMessageId ? `${domain}/incoming/${sesMessageId}` : "");
      //
      // const emailData = {
      //   key: s3Key,
      //   from: mail.commonHeaders?.from?.[0] || mail.source,
      //   to: recipients,
      //   subject: mail.commonHeaders?.subject || "(no subject)",
      //   date: mail.commonHeaders?.date || mail.timestamp,
      //   messageId: sesMessageId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      //   hasAttachments: (mail.commonHeaders?.["content-type"] || "").includes("multipart") || false,
      //   inReplyTo: mail.commonHeaders?.["in-reply-to"] || mail.headers?.find?.((h: { name?: string; value?: string }) => h.name?.toLowerCase() === "in-reply-to")?.value || undefined,
      // };
      //
      // return await ingestEmail(emailData);
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

type SesEventDetail = {
  bounceType?: string;
  bounceSubType?: string;
  complaintFeedbackType?: string;
  diagnosticCode?: string;
  recipient?: string;
};

async function handleDeliveryNotification(
  message: Record<string, unknown>,
  status: "delivered" | "failed" | "bounced" | "complained",
  reason?: string,
  detail?: SesEventDetail
) {
  const mail = message.mail as Record<string, unknown> | undefined;
  console.log("[DELIVERY] status:", status, "| mail present:", !!mail);
  if (!mail) return NextResponse.json({ success: true });

  // mail.messageId is the SES-assigned ID stored in emails.sesMessageId
  const messageId = (mail.messageId as string | undefined) ?? "";
  console.log("[DELIVERY] mail.messageId (SES-assigned):", messageId);

  if (!messageId) return NextResponse.json({ success: true });

  const deliveryTimestamp =
    (message.delivery as Record<string, unknown> | undefined)?.timestamp ??
    (message.bounce as Record<string, unknown> | undefined)?.timestamp ??
    (message.complaint as Record<string, unknown> | undefined)?.timestamp ??
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
      body: JSON.stringify({ messageId, status, timestamp, reason, ...(detail ?? {}) }),
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
  inReplyTo?: string;
}) {
  const { key, from, to, subject, date, messageId, hasAttachments, inReplyTo } = emailData;

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
          ...(inReplyTo ? { inReplyTo } : {}),
        }),
      }
    );

    if (!response.ok) {
      console.error("Failed to ingest email:", await response.text());
    }
  }

  return NextResponse.json({ success: true });
}
