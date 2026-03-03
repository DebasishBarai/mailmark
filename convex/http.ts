import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

// 1x1 transparent GIF pixel (base64-decoded bytes)
const TRACKING_PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
  0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b,
]);

const http = httpRouter();

http.route({
  path: "/ingestEmail",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = request.headers.get("x-webhook-secret");
    if (secret !== process.env.SES_WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const {
      recipientAddress,
      from,
      to,
      subject,
      date,
      messageId,
      hasAttachments,
      s3Key,
    } = body;

    // Find the mailbox by recipient address
    const mailbox = await ctx.runQuery(
      internal.mailboxes.getByFullAddress,
      { fullAddress: recipientAddress.toLowerCase() }
    );

    if (!mailbox) {
      return new Response(
        JSON.stringify({ error: "Mailbox not found for " + recipientAddress }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Insert email metadata
    const emailId = await ctx.runMutation(internal.emails.insertFromWebhook, {
      mailboxId: mailbox._id,
      messageId,
      from,
      to,
      subject,
      snippet: "",
      date,
      hasAttachments,
      s3Key,
    });

    // Save sender as contact if "from" has a display name (e.g. "Name <email>")
    const fromMatch = from.match(/^(.+?)\s*<([^>]+)>$/);
    if (fromMatch) {
      await ctx.runMutation(internal.contacts.upsert, {
        userId: mailbox.userId,
        email: fromMatch[2].toLowerCase(),
        name: fromMatch[1].trim().replace(/^["']|["']$/g, ""),
      });
    }

    // Move S3 object from domain/incoming/ to domain/mailbox/incoming/
    await ctx.runAction(internal.ses.moveIncomingEmail, {
      emailId,
      oldS3Key: s3Key,
      recipientAddress: recipientAddress.toLowerCase(),
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// Open tracking pixel: GET /track/open/:messageId.gif
http.route({
  pathPrefix: "/track/open/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    // Extract messageId from path like /track/open/{messageId}.gif
    const filename = url.pathname.split("/").pop() ?? "";
    const messageId = filename.replace(/\.gif$/, "");

    if (messageId) {
      // Fire-and-forget: mark the email as opened on first pixel load
      await ctx.runMutation(internal.emails.markAsOpened, { messageId });
    }

    return new Response(TRACKING_PIXEL, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "Pragma": "no-cache",
      },
    });
  }),
});

// Delivery status webhook: POST /trackDelivery (called from ses-webhook route)
http.route({
  path: "/trackDelivery",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = request.headers.get("x-webhook-secret");
    if (secret !== process.env.SES_WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { messageId, status, timestamp } = body;

    console.log("[trackDelivery] received messageId:", messageId, "status:", status);

    if (!messageId || !status) {
      console.log("[trackDelivery] missing messageId or status — body:", JSON.stringify(body));
      return new Response(JSON.stringify({ error: "Missing messageId or status" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await ctx.runMutation(internal.emails.updateDeliveryStatus, {
      messageId,
      status,
      timestamp: timestamp ?? Date.now(),
    });
    console.log("[trackDelivery] mutation done for messageId:", messageId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
