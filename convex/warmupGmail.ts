import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

function buildRfc2822Message(args: {
  from: string;
  to: string;
  subject: string;
  html: string;
  inReplyToMessageId?: string;
  warmupEmailId?: string;
}): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const messageId = `<${Date.now()}-${Math.random().toString(36).slice(2, 10)}@warmup.mailmark.dev>`;

  let headers = [
    `From: ${args.from}`,
    `To: ${args.to}`,
    `Subject: ${args.subject}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
  ];

  if (args.inReplyToMessageId) {
    headers.push(`In-Reply-To: ${args.inReplyToMessageId}`);
    headers.push(`References: ${args.inReplyToMessageId}`);
  }

  if (args.warmupEmailId) {
    headers.push(`X-Warmup-Id: ${args.warmupEmailId}`);
  }

  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

  const textContent = args.html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

  const body = [
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    textContent,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    args.html,
    `--${boundary}--`,
  ].join("\r\n");

  return headers.join("\r\n") + "\r\n\r\n" + body;
}

function base64UrlEncode(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const sendViaGmail = internalAction({
  args: {
    accountId: v.id("platformWarmupAccounts"),
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    inReplyToMessageId: v.optional(v.string()),
    warmupEmailId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const accessToken = await ctx.runAction(
      internal.platformWarmupAccounts.refreshTokenIfNeeded,
      { accountId: args.accountId }
    );

    const account = await ctx.runQuery(
      internal.platformWarmupAccounts.getAccountById,
      { accountId: args.accountId }
    );
    if (!account) throw new Error("Platform account not found");

    const rawMessage = buildRfc2822Message({
      from: account.email,
      to: args.to,
      subject: args.subject,
      html: args.html,
      inReplyToMessageId: args.inReplyToMessageId,
      warmupEmailId: args.warmupEmailId,
    });

    const encodedMessage = base64UrlEncode(rawMessage);

    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: encodedMessage }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gmail send failed (${response.status}): ${errorText}`);
    }

    const data = await response.json() as { id: string };
    return data.id;
  },
});

export const checkPlacement = internalAction({
  args: {
    accountId: v.id("platformWarmupAccounts"),
    messageId: v.string(),
  },
  handler: async (ctx, args): Promise<{ placement: "inbox" | "spam" | "unknown"; isImportant: boolean }> => {
    const accessToken = await ctx.runAction(
      internal.platformWarmupAccounts.refreshTokenIfNeeded,
      { accountId: args.accountId }
    );

    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=rfc822msgid:${encodeURIComponent(args.messageId)}&maxResults=1`;
    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchResponse.ok) {
      return { placement: "unknown", isImportant: false };
    }

    const searchData = await searchResponse.json() as { messages?: Array<{ id: string }> };
    if (!searchData.messages || searchData.messages.length === 0) {
      return { placement: "unknown", isImportant: false };
    }

    const gmailMessageId = searchData.messages[0].id;
    const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMessageId}?format=metadata&metadataHeaders=Message-ID`;
    const msgResponse = await fetch(msgUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!msgResponse.ok) {
      return { placement: "unknown", isImportant: false };
    }

    const msgData = await msgResponse.json() as { labelIds?: string[] };
    const labels = msgData.labelIds ?? [];

    let placement: "inbox" | "spam" | "unknown" = "unknown";
    if (labels.includes("SPAM")) {
      placement = "spam";
    } else if (labels.includes("INBOX")) {
      placement = "inbox";
    }

    return {
      placement,
      isImportant: labels.includes("IMPORTANT"),
    };
  },
});

export const rescueFromSpam = internalAction({
  args: {
    accountId: v.id("platformWarmupAccounts"),
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    const accessToken = await ctx.runAction(
      internal.platformWarmupAccounts.refreshTokenIfNeeded,
      { accountId: args.accountId }
    );

    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=rfc822msgid:${encodeURIComponent(args.messageId)}&maxResults=1`;
    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchResponse.ok) return;

    const searchData = await searchResponse.json() as { messages?: Array<{ id: string }> };
    if (!searchData.messages || searchData.messages.length === 0) return;

    const gmailMessageId = searchData.messages[0].id;

    await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMessageId}/modify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          addLabelIds: ["INBOX", "IMPORTANT"],
          removeLabelIds: ["SPAM"],
        }),
      }
    );
  },
});

export const markImportant = internalAction({
  args: {
    accountId: v.id("platformWarmupAccounts"),
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    const accessToken = await ctx.runAction(
      internal.platformWarmupAccounts.refreshTokenIfNeeded,
      { accountId: args.accountId }
    );

    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=rfc822msgid:${encodeURIComponent(args.messageId)}&maxResults=1`;
    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!searchResponse.ok) return;

    const searchData = await searchResponse.json() as { messages?: Array<{ id: string }> };
    if (!searchData.messages || searchData.messages.length === 0) return;

    const gmailMessageId = searchData.messages[0].id;

    await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMessageId}/modify`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          addLabelIds: ["IMPORTANT"],
        }),
      }
    );
  },
});

export const replyViaGmail = internalAction({
  args: {
    accountId: v.id("platformWarmupAccounts"),
    originalMessageId: v.string(),
    to: v.string(),
    subject: v.string(),
    html: v.string(),
    warmupEmailId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    return await ctx.runAction(internal.warmupGmail.sendViaGmail, {
      accountId: args.accountId,
      to: args.to,
      subject: args.subject,
      html: args.html,
      inReplyToMessageId: args.originalMessageId,
      warmupEmailId: args.warmupEmailId,
    });
  },
});
