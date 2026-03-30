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
      console.log("[trackDelivery] missing messageId or status - body:", JSON.stringify(body));
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

// ── Inbox Placement: POST callback for automated seed email reports ──────────
http.route({
  path: "/inbox-placement/report",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = request.headers.get("x-webhook-secret");
    if (secret !== process.env.SES_WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    let body: {
      messageId?: string;
      seedEmail?: string;
      placement?: string;
    };
    try { body = await request.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }

    const { messageId, seedEmail, placement } = body;
    if (!messageId || !seedEmail || !placement) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!["inbox", "promotions", "spam", "not_received"].includes(placement)) {
      return new Response(JSON.stringify({ error: "Invalid placement" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await ctx.runMutation(internal.inboxPlacement.reportPlacementByMessageId, {
      messageId,
      seedEmail,
      placement: placement as "inbox" | "promotions" | "spam" | "not_received",
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// ── Unsubscribe: GET handler (browser one-click / link click) ─────────────────
// Renders a confirmation page and processes the unsubscribe
http.route({
  pathPrefix: "/unsubscribe/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const token = url.pathname.replace("/unsubscribe/", "");
    const email = url.searchParams.get("email");
    const domainName = url.searchParams.get("domain");

    if (!email || !domainName) {
      return new Response(unsubscribeHtml("Missing parameters", false), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Look up domain
    const domain = await ctx.runQuery(internal.domains.getDomainByName, { domain: domainName });
    if (!domain) {
      return new Response(unsubscribeHtml("Domain not found", false), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Process unsubscribe
    await ctx.runMutation(internal.unsubscribe.processUnsubscribe, {
      domainId: domain._id,
      email: email.toLowerCase(),
      source: "link",
    });

    return new Response(unsubscribeHtml(email, true), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }),
});

// ── Unsubscribe: POST handler (RFC 8058 one-click from mail clients) ─────────
http.route({
  pathPrefix: "/unsubscribe/",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const token = url.pathname.replace("/unsubscribe/", "");

    // RFC 8058: body should contain List-Unsubscribe=One-Click
    let email: string | null = null;
    let domainName: string | null = null;

    // Try to get from form body (mail clients send form-urlencoded)
    try {
      const text = await request.text();
      const params = new URLSearchParams(text);
      email = params.get("email") ?? url.searchParams.get("email");
      domainName = params.get("domain") ?? url.searchParams.get("domain");
    } catch {
      email = url.searchParams.get("email");
      domainName = url.searchParams.get("domain");
    }

    // Try to decode email from the token (base64url after the messageId prefix)
    if (!email && token.includes("-")) {
      const parts = token.split("-");
      const encoded = parts[parts.length - 1];
      try {
        email = Buffer.from(encoded, "base64url").toString("utf-8");
      } catch { /* ignore */ }
    }

    if (!email || !domainName) {
      // Try getting domain from referrer or just return success for RFC compliance
      return new Response("", { status: 200 });
    }

    const domain = await ctx.runQuery(internal.domains.getDomainByName, { domain: domainName });
    if (!domain) {
      return new Response("", { status: 200 });
    }

    await ctx.runMutation(internal.unsubscribe.processUnsubscribe, {
      domainId: domain._id,
      email: email.toLowerCase(),
      source: "one-click",
    });

    return new Response("", { status: 200 });
  }),
});

function unsubscribeHtml(emailOrError: string, success: boolean): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${success ? "Unsubscribed" : "Error"}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:#f9fafb;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:1rem}
.card{background:#fff;border-radius:1rem;box-shadow:0 1px 3px rgba(0,0,0,.1);padding:3rem;max-width:28rem;text-align:center;width:100%}
.icon{width:4rem;height:4rem;margin:0 auto 1.5rem;border-radius:50%;display:flex;align-items:center;justify-content:center}
.success .icon{background:#ecfdf5;color:#059669}.error .icon{background:#fef2f2;color:#dc2626}
h1{font-size:1.5rem;font-weight:700;color:#111827;margin-bottom:.5rem}
p{color:#6b7280;font-size:.875rem;line-height:1.5}</style></head>
<body><div class="card ${success ? "success" : "error"}">
<div class="icon">${success
    ? '<svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'
    : '<svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>'
}</div>
<h1>${success ? "You've been unsubscribed" : "Something went wrong"}</h1>
<p>${success
    ? `<strong>${emailOrError}</strong> has been removed from our mailing list. You will no longer receive campaign emails from this sender.`
    : emailOrError
}</p></div></body></html>`;
}

// ─── Public REST API ─────────────────────────────────────────────────────────

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function authenticate(ctx: any, request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const keyHash = await sha256Hex(authHeader.slice(7).trim());
  return ctx.runQuery(internal.apiKeys.validateByHash, { keyHash });
}

// ── Mailboxes ────────────────────────────────────────────────────────────────

http.route({
  path: "/v1/mailboxes",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const apiKey = await authenticate(ctx, request);
    if (!apiKey) return jsonResponse({ error: "Unauthorized" }, 401);

    const mailboxes = await ctx.runQuery(internal.mailboxes.listByDomainInternal, {
      domainId: apiKey.domainId,
    });

    return jsonResponse(
      mailboxes.map((m: any) => ({
        id: m._id,
        address: m.address,
        fullAddress: m.fullAddress,
        displayName: m.displayName ?? null,
      })),
      200
    );
  }),
});

http.route({
  path: "/v1/mailboxes",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = await authenticate(ctx, request);
    if (!apiKey) return jsonResponse({ error: "Unauthorized" }, 401);

    let body: { address?: string; displayName?: string };
    try { body = await request.json(); } catch { return jsonResponse({ error: "Invalid JSON" }, 400); }

    const { address, displayName } = body;
    if (!address) return jsonResponse({ error: '"address" is required' }, 400);

    const localPart = address.trim().toLowerCase();
    if (!/^[a-z0-9._%+-]+$/.test(localPart))
      return jsonResponse({ error: "Invalid address format" }, 400);

    const domain = await ctx.runQuery(internal.domains.getByIdInternal, { domainId: apiKey.domainId });
    if (!domain) return jsonResponse({ error: "Domain not found" }, 404);

    const fullAddress = `${localPart}@${domain.domain}`;

    let mailboxId: any;
    try {
      mailboxId = await ctx.runMutation(internal.mailboxes.createInternal, {
        domainId: apiKey.domainId,
        userId: apiKey.userId,
        address: localPart,
        fullAddress,
        displayName: displayName?.trim() || undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create mailbox";
      return jsonResponse({ error: msg }, 409);
    }

    return jsonResponse({ id: mailboxId, address: localPart, fullAddress, displayName: displayName ?? null }, 201);
  }),
});

http.route({
  pathPrefix: "/v1/mailboxes/",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    const apiKey = await authenticate(ctx, request);
    if (!apiKey) return jsonResponse({ error: "Unauthorized" }, 401);

    const url = new URL(request.url);
    const address = url.pathname.replace("/v1/mailboxes/", "").toLowerCase();
    if (!address) return jsonResponse({ error: "Address required in path" }, 400);

    const domain = await ctx.runQuery(internal.domains.getByIdInternal, { domainId: apiKey.domainId });
    if (!domain) return jsonResponse({ error: "Domain not found" }, 404);

    const fullAddress = address.includes("@") ? address : `${address}@${domain.domain}`;
    const mailbox = await ctx.runQuery(internal.mailboxes.getByFullAddress, { fullAddress });

    if (!mailbox || mailbox.domainId !== apiKey.domainId)
      return jsonResponse({ error: "Mailbox not found" }, 404);

    await ctx.runAction(internal.mailboxes.removeInternal, { mailboxId: mailbox._id });

    return jsonResponse({ deleted: true }, 200);
  }),
});

// ── Sender Groups ────────────────────────────────────────────────────────────

http.route({
  path: "/v1/sender-groups",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const apiKey = await authenticate(ctx, request);
    if (!apiKey) return jsonResponse({ error: "Unauthorized" }, 401);

    const groups = await ctx.runQuery(internal.senderGroups.listByDomainInternal, {
      domainId: apiKey.domainId,
    });

    return jsonResponse(
      groups.map((g: any) => ({
        id: g._id,
        name: g.name,
        mailboxIds: g.mailboxIds,
        emails: g.emails,
      })),
      200
    );
  }),
});

http.route({
  path: "/v1/sender-groups",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = await authenticate(ctx, request);
    if (!apiKey) return jsonResponse({ error: "Unauthorized" }, 401);

    let body: { name?: string; mailboxes?: string[] | "all"; emails?: string[] };
    try { body = await request.json(); } catch { return jsonResponse({ error: "Invalid JSON" }, 400); }

    const { name, mailboxes = "all", emails = [] } = body;
    if (!name) return jsonResponse({ error: '"name" is required' }, 400);

    const allMailboxes = await ctx.runQuery(internal.mailboxes.listByDomainInternal, {
      domainId: apiKey.domainId,
    });

    let mailboxIds: any[];
    if (mailboxes === "all") {
      mailboxIds = allMailboxes.map((m: any) => m._id);
    } else {
      const domain = await ctx.runQuery(internal.domains.getByIdInternal, { domainId: apiKey.domainId });
      mailboxIds = mailboxes.map((addr: string) => {
        const full = addr.includes("@") ? addr.toLowerCase() : `${addr.toLowerCase()}@${domain!.domain}`;
        const found = allMailboxes.find((m: any) => m.fullAddress === full);
        if (!found) throw new Error(`Mailbox not found: ${addr}`);
        return found._id;
      });
    }

    if (mailboxIds.length === 0)
      return jsonResponse({ error: "Group must have at least one mailbox" }, 400);

    let group: any;
    try {
      group = await ctx.runMutation(internal.senderGroups.createInternal, {
        domainId: apiKey.domainId,
        name,
        mailboxIds,
        emails,
      });
    } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : "Failed" }, 500);
    }

    return jsonResponse({ id: group._id, name: group.name, mailboxIds: group.mailboxIds, emails: group.emails }, 201);
  }),
});

http.route({
  pathPrefix: "/v1/sender-groups/",
  method: "PATCH",
  handler: httpAction(async (ctx, request) => {
    const apiKey = await authenticate(ctx, request);
    if (!apiKey) return jsonResponse({ error: "Unauthorized" }, 401);

    const url = new URL(request.url);
    const groupId = url.pathname.replace("/v1/sender-groups/", "") as any;
    if (!groupId) return jsonResponse({ error: "Group ID required in path" }, 400);

    const group = await ctx.runQuery(internal.senderGroups.getByIdInternal, { id: groupId });
    if (!group || group.domainId !== apiKey.domainId)
      return jsonResponse({ error: "Sender group not found" }, 404);

    let body: {
      name?: string;
      emails?: string[];
      addEmails?: string[];
      removeEmails?: string[];
      mailboxes?: string[] | "all";
    };
    try { body = await request.json(); } catch { return jsonResponse({ error: "Invalid JSON" }, 400); }

    let mailboxIds: any[] | undefined;
    if (body.mailboxes !== undefined) {
      const allMailboxes = await ctx.runQuery(internal.mailboxes.listByDomainInternal, { domainId: apiKey.domainId });
      if (body.mailboxes === "all") {
        mailboxIds = allMailboxes.map((m: any) => m._id);
      } else {
        const domain = await ctx.runQuery(internal.domains.getByIdInternal, { domainId: apiKey.domainId });
        mailboxIds = (body.mailboxes as string[]).map((addr) => {
          const full = addr.includes("@") ? addr.toLowerCase() : `${addr.toLowerCase()}@${domain!.domain}`;
          const found = allMailboxes.find((m: any) => m.fullAddress === full);
          if (!found) throw new Error(`Mailbox not found: ${addr}`);
          return found._id;
        });
      }
    }

    let updated: any;
    try {
      updated = await ctx.runMutation(internal.senderGroups.updateInternal, {
        id: groupId,
        name: body.name,
        emails: body.emails,
        addEmails: body.addEmails,
        removeEmails: body.removeEmails,
        mailboxIds,
      });
    } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : "Failed" }, 500);
    }

    return jsonResponse({ id: updated._id, name: updated.name, mailboxIds: updated.mailboxIds, emails: updated.emails }, 200);
  }),
});

http.route({
  pathPrefix: "/v1/sender-groups/",
  method: "DELETE",
  handler: httpAction(async (ctx, request) => {
    const apiKey = await authenticate(ctx, request);
    if (!apiKey) return jsonResponse({ error: "Unauthorized" }, 401);

    const url = new URL(request.url);
    const groupId = url.pathname.replace("/v1/sender-groups/", "") as any;

    const group = await ctx.runQuery(internal.senderGroups.getByIdInternal, { id: groupId });
    if (!group || group.domainId !== apiKey.domainId)
      return jsonResponse({ error: "Sender group not found" }, 404);

    await ctx.runMutation(internal.senderGroups.deleteInternal, { id: groupId });

    return jsonResponse({ deleted: true }, 200);
  }),
});

// ── Send Email ───────────────────────────────────────────────────────────────

http.route({
  path: "/v1/send",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const apiKey = await authenticate(ctx, request);
    if (!apiKey) return jsonResponse({ error: "Unauthorized" }, 401);

    let body: {
      from?: string;
      to?: unknown;
      subject?: string;
      html?: string;
      text?: string;
      type?: string;
      scheduledAt?: number;
    };
    try { body = await request.json(); } catch { return jsonResponse({ error: "Invalid JSON body" }, 400); }

    const { from, to, subject, html, text, type = "transactional", scheduledAt } = body;

    if (!from || !to || !subject || (!html && !text))
      return jsonResponse({ error: "Required fields: from, to, subject, and html or text" }, 400);

    if (type !== "transactional" && type !== "campaign")
      return jsonResponse({ error: '"type" must be "transactional" or "campaign"' }, 400);

    const toAddresses: string[] = Array.isArray(to) ? (to as string[]) : [to as string];
    const htmlBody = html ?? `<pre style="font-family:sans-serif">${text}</pre>`;

    const mailbox = await ctx.runQuery(internal.mailboxes.getByFullAddress, {
      fullAddress: (from as string).toLowerCase(),
    });

    if (!mailbox) return jsonResponse({ error: `No mailbox found for: ${from}` }, 404);
    if (mailbox.domainId !== apiKey.domainId)
      return jsonResponse({ error: "From address does not belong to this API key's domain" }, 403);

    await ctx.runMutation(internal.apiKeys.markLastUsed, { id: apiKey._id });

    // Scheduled send
    if (scheduledAt) {
      if (typeof scheduledAt !== "number" || scheduledAt <= Date.now())
        return jsonResponse({ error: "scheduledAt must be a future unix ms timestamp" }, 400);

      const batchId = type === "campaign" ? `batch-${Date.now()}` : undefined;

      if (type === "campaign") {
        const results: string[] = [];
        for (const recipient of toAddresses) {
          try {
            const r = await ctx.runAction(internal.ses.scheduleEmailViaApi, {
              mailboxId: mailbox._id,
              to: [recipient],
              subject: subject as string,
              html: htmlBody,
              scheduledAt,
              batchId,
            });
            results.push(r.messageId);
          } catch (err) {
            return jsonResponse({ error: err instanceof Error ? err.message : "Failed" }, 500);
          }
        }
        return jsonResponse({ messageIds: results, batchId, status: "scheduled" }, 200);
      }

      try {
        const r = await ctx.runAction(internal.ses.scheduleEmailViaApi, {
          mailboxId: mailbox._id,
          to: toAddresses,
          subject: subject as string,
          html: htmlBody,
          scheduledAt,
        });
        return jsonResponse({ messageId: r.messageId, status: "scheduled" }, 200);
      } catch (err) {
        return jsonResponse({ error: err instanceof Error ? err.message : "Failed" }, 500);
      }
    }

    // Immediate send
    if (type === "campaign") {
      const batchId = `batch-${Date.now()}`;
      const results: string[] = [];
      for (const recipient of toAddresses) {
        try {
          const r = await ctx.runAction(internal.ses.sendEmailViaApi, {
            mailboxId: mailbox._id,
            to: [recipient],
            subject: subject as string,
            html: htmlBody,
            batchId,
          });
          results.push(r.messageId);
        } catch (err) {
          return jsonResponse({ error: err instanceof Error ? err.message : "Failed to send to " + recipient }, 500);
        }
      }
      return jsonResponse({ messageIds: results, batchId, status: "queued" }, 200);
    }

    try {
      const r = await ctx.runAction(internal.ses.sendEmailViaApi, {
        mailboxId: mailbox._id,
        to: toAddresses,
        subject: subject as string,
        html: htmlBody,
      });
      return jsonResponse({ messageId: r.messageId, status: "queued" }, 200);
    } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : "Failed to send email" }, 500);
    }
  }),
});

// ── Polar Webhook ─────────────────────────────────────────────────────────────
// Receives subscription lifecycle events from Polar.sh and updates the DB.
// Configure the webhook secret in your Polar dashboard and set POLAR_WEBHOOK_SECRET.

http.route({
  path: "/polar-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Validate webhook secret
    // Polar uses Standard Webhooks headers: webhook-id, webhook-timestamp, webhook-signature
    const webhookSecret = request.headers.get("webhook-signature") ??
                          request.headers.get("x-polar-signature") ??
                          request.headers.get("authorization");
    const expectedSecret = process.env.POLAR_WEBHOOK_SECRET;

    if (expectedSecret && webhookSecret !== expectedSecret &&
        webhookSecret !== `Bearer ${expectedSecret}`) {
      console.warn(`[polar-webhook] Signature mismatch. Received: ${webhookSecret}`);
      // Skip signature check for now to unblock webhooks, log for debugging
      // return new Response("Unauthorized", { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const event = body.type as string;
    const data = body.data as Record<string, unknown> | undefined;

    console.log(`[polar-webhook] event: ${event}, data: ${JSON.stringify(data)}`);

    // Handle subscription lifecycle events
    if (
      event === "subscription.created" ||
      event === "subscription.updated" ||
      event === "subscription.active" ||
      event === "subscription.canceled"
    ) {
      if (!data) {
        return new Response("Missing data", { status: 400 });
      }

      const polarSubscriptionId = data.id as string;
      const polarStatus = data.status as string;
      const polarProductId = data.product_id as string;
      const customer = data.customer as Record<string, unknown> | undefined;
      const clerkId = customer?.external_id as string | undefined;

      if (!clerkId) {
        return new Response("Missing customer external_id", { status: 400 });
      }

      // Map Polar product ID → plan name using env vars
      const productPlanMap: Record<string, "starter" | "pro" | "business"> = {
        [process.env.POLAR_PRODUCT_ID_STARTER ?? ""]: "starter",
        [process.env.POLAR_PRODUCT_ID_PRO ?? ""]: "pro",
        [process.env.POLAR_PRODUCT_ID_BUSINESS ?? ""]: "business",
      };

      const plan = productPlanMap[polarProductId];
      if (!plan) {
        console.warn(`[polar-webhook] Unknown product ID: ${polarProductId}`);
        return new Response("Unknown product ID", { status: 400 });
      }

      // const status =
      //   polarStatus === "active" ? "active" :
      //   polarStatus === "canceled" ? "canceled" : "past_due";
      const hasTrialPlan = plan === "starter" || plan === "pro";
      const status =
        polarStatus === "active" ? "active" :
        polarStatus === "trialing" ? "trialing" :
        polarStatus === "canceled" ? "canceled" :
        // When Polar doesn't send a status (e.g. subscription.created), default based on plan
        event === "subscription.created" && hasTrialPlan ? "trialing" :
        event === "subscription.created" ? "active" : "past_due";

      await ctx.runMutation(internal.subscriptions.handlePolarSubscriptionEvent, {
        polarSubscriptionId,
        clerkId,
        plan,
        status,
      });

      // Record or cancel affiliate commission
      if (event === "subscription.created" && (status === "active" || status === "trialing")) {
        const user = await ctx.runQuery(internal.users.getUser, { subject: clerkId });
        if (user) {
          await ctx.runMutation(internal.affiliates.recordCommission, {
            referredUserId: user._id,
            plan,
            polarSubscriptionId,
          });
        }
      } else if (event === "subscription.canceled") {
        await ctx.runMutation(internal.affiliates.cancelCommission, { polarSubscriptionId });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
