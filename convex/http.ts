import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

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

export default http;
