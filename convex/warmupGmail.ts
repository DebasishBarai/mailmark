"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";

function createSmtpTransport(email: string, appPassword: string) {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: email, pass: appPassword },
  });
}

function createImapClient(email: string, appPassword: string) {
  return new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: email, pass: appPassword },
    logger: false,
  });
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
    const account = await ctx.runQuery(
      internal.platformWarmupAccounts.getAccountById,
      { accountId: args.accountId }
    );
    if (!account) throw new Error("Platform account not found");

    const transporter = createSmtpTransport(account.email, account.appPassword);

    const messageId = `<${Date.now()}-${Math.random().toString(36).slice(2, 10)}@warmup.mailmark.dev>`;

    const mailOptions: nodemailer.SendMailOptions = {
      from: account.email,
      to: args.to,
      subject: args.subject,
      html: args.html,
      messageId,
      headers: {} as Record<string, string>,
    };

    if (args.inReplyToMessageId) {
      mailOptions.inReplyTo = args.inReplyToMessageId;
      mailOptions.references = args.inReplyToMessageId;
    }

    if (args.warmupEmailId) {
      (mailOptions.headers as Record<string, string>)["X-Warmup-Id"] = args.warmupEmailId;
    }

    await transporter.sendMail(mailOptions);
    return messageId;
  },
});

export const checkPlacement = internalAction({
  args: {
    accountId: v.id("platformWarmupAccounts"),
    messageId: v.string(),
  },
  handler: async (ctx, args): Promise<{ placement: "inbox" | "spam" | "unknown"; isImportant: boolean }> => {
    const account = await ctx.runQuery(
      internal.platformWarmupAccounts.getAccountById,
      { accountId: args.accountId }
    );
    if (!account) return { placement: "unknown", isImportant: false };

    const client = createImapClient(account.email, account.appPassword);

    try {
      await client.connect();

      const escapedId = args.messageId.replace(/"/g, '\\"');

      // Check INBOX
      await client.mailboxOpen("INBOX");
      const inboxResults = await client.search({ header: { "Message-ID": escapedId } });
      if (inboxResults && inboxResults.length > 0) {
        const msg = await client.fetchOne(inboxResults[0], { flags: true, labels: true });
        await client.logout();
        const labels = (msg as any).labels || [];
        return {
          placement: "inbox",
          isImportant: labels.includes("\\Important"),
        };
      }

      // Check Spam
      await client.mailboxOpen("[Gmail]/Spam");
      const spamResults = await client.search({ header: { "Message-ID": escapedId } });
      await client.logout();

      if (spamResults && spamResults.length > 0) {
        return { placement: "spam", isImportant: false };
      }

      return { placement: "unknown", isImportant: false };
    } catch (error) {
      try { await client.logout(); } catch { /* ignore */ }
      console.error("IMAP checkPlacement failed:", error);
      return { placement: "unknown", isImportant: false };
    }
  },
});

export const rescueFromSpam = internalAction({
  args: {
    accountId: v.id("platformWarmupAccounts"),
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.runQuery(
      internal.platformWarmupAccounts.getAccountById,
      { accountId: args.accountId }
    );
    if (!account) return;

    const client = createImapClient(account.email, account.appPassword);

    try {
      await client.connect();
      await client.mailboxOpen("[Gmail]/Spam");

      const escapedId = args.messageId.replace(/"/g, '\\"');
      const results = await client.search({ header: { "Message-ID": escapedId } });

      if (results && results.length > 0) {
        await client.messageMove(results[0], "INBOX");
      }

      await client.logout();
    } catch (error) {
      try { await client.logout(); } catch { /* ignore */ }
      console.error("IMAP rescueFromSpam failed:", error);
    }
  },
});

export const markImportant = internalAction({
  args: {
    accountId: v.id("platformWarmupAccounts"),
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.runQuery(
      internal.platformWarmupAccounts.getAccountById,
      { accountId: args.accountId }
    );
    if (!account) return;

    const client = createImapClient(account.email, account.appPassword);

    try {
      await client.connect();
      await client.mailboxOpen("INBOX");

      const escapedId = args.messageId.replace(/"/g, '\\"');
      const results = await client.search({ header: { "Message-ID": escapedId } });

      if (results && results.length > 0) {
        await client.messageFlagsAdd(results[0], ["\\Flagged"]);
        // Gmail maps X-GM-LABELS for importance
        try {
          await (client as any).messageLabelAdd(results[0], ["\\Important"]);
        } catch {
          // Fallback: flagging is sufficient for engagement signal
        }
      }

      await client.logout();
    } catch (error) {
      try { await client.logout(); } catch { /* ignore */ }
      console.error("IMAP markImportant failed:", error);
    }
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
