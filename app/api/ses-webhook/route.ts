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
        // Permanent bounces = failed, transient bounces = bounced (temporary).
        // This mapping is why the production snapshot reads 643 failed against
        // 163 bounced: the 643 are hard bounces, and they are the ones that
        // feed suppression.
        const status = bounceType === "Permanent" ? "failed" : "bounced";
        const reason =
          message.bounce?.bouncedRecipients?.[0]?.diagnosticCode ??
          [bounceType, message.bounce?.bounceSubType].filter(Boolean).join("/");

        // The per-recipient detail used to be thrown away here, which left
        // nothing to suppress on: a bounce told us a *message* failed but not
        // which address caused it. SES reports one bouncedRecipients entry per
        // failed address, each with its own SMTP diagnostic code, so a message
        // to five people where one address is dead names that one address.
        return await handleDeliveryNotification(message, status, reason, {
          bounceType,
          bounceSubType: message.bounce?.bounceSubType,
          recipients: (message.bounce?.bouncedRecipients ?? []).map(
            (r: { emailAddress?: string; diagnosticCode?: string; status?: string }) => ({
              email: r.emailAddress,
              diagnosticCode: r.diagnosticCode,
              smtpStatus: r.status,
            })
          ),
        });
      }

      // Complaints used to be recorded for warmup only, and dropped for
      // ordinary mail because the emails table had no "complained" status to
      // put them in. That threw away the strongest reputation signal SES
      // gives: a complaint weighs far more heavily than a bounce with every
      // mailbox provider, and AWS suspends accounts over the complaint rate as
      // readily as over the bounce rate. Both are now recorded, and a
      // complaint suppresses the address permanently.
      if (eventType === "Complaint") {
        const feedbackType: string | undefined =
          message.complaint?.complaintFeedbackType;

        // "not-spam" is the opposite of a complaint. Gmail and Yahoo send it
        // through the same feedback loop when a recipient pulls a message
        // *out* of their spam folder, which is the strongest positive signal
        // a mailbox provider ever gives us. Recorded as a complaint it would
        // suppress that recipient permanently and inflate the very rate this
        // is all meant to bring down, so it is logged and dropped instead.
        //
        // Old: every Complaint notification became a complaint.
        // const reason = message.complaint?.complaintFeedbackType ?? "complaint";
        if (feedbackType === "not-spam") {
          console.log(
            "[SNS] ignoring not-spam feedback (recipient rescued the message from spam)"
          );
          return NextResponse.json({ success: true, ignored: "not-spam" });
        }

        const reason = feedbackType ?? "complaint";
        return await handleDeliveryNotification(message, "complained", reason, {
          recipients: (message.complaint?.complainedRecipients ?? []).map(
            (r: { emailAddress?: string }) => ({ email: r.emailAddress })
          ),
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

type BounceDetail = {
  bounceType?: string;
  bounceSubType?: string;
  recipients?: Array<{
    email?: string;
    diagnosticCode?: string;
    smtpStatus?: string;
  }>;
};

async function handleDeliveryNotification(
  message: Record<string, unknown>,
  status: "delivered" | "failed" | "bounced" | "complained",
  reason?: string,
  detail?: BounceDetail
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

  // The recipients SES named, with their own diagnostic codes. Only the
  // addresses that actually failed appear here, which is what makes
  // per-address suppression possible.
  const recipients = (detail?.recipients ?? [])
    .filter((r) => !!r.email)
    .map((r) => ({
      email: r.email!.toLowerCase(),
      diagnosticCode: r.diagnosticCode,
      smtpStatus: r.smtpStatus,
    }));

  console.log("[DELIVERY] calling /trackDelivery with messageId:", messageId, "status:", status);

  try {
    const trackRes = await fetch(
      `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL}/trackDelivery`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": process.env.SES_WEBHOOK_SECRET!,
        },
        body: JSON.stringify({
          messageId,
          status,
          timestamp,
          reason,
          bounceType: detail?.bounceType,
          bounceSubType: detail?.bounceSubType,
          recipients,
        }),
      }
    );
    const responseText = await trackRes.text();
    console.log("[DELIVERY] /trackDelivery response status:", trackRes.status, responseText);

    // Answer SNS with the same verdict rather than a blanket 200.
    //
    // This used to return success no matter what happened downstream, so a
    // Convex error, a deploy, or a transient network failure silently threw
    // the event away and SNS never retried it. A bounce lost that way is lost
    // for good: the message stays pending forever and the address is never
    // suppressed. Returning a 5xx lets SNS do what it is for.
    if (!trackRes.ok) {
      return NextResponse.json(
        { error: "trackDelivery rejected the event" },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("[DELIVERY] trackDelivery call failed:", error);
    return NextResponse.json(
      { error: "trackDelivery unreachable" },
      { status: 502 }
    );
  }

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
