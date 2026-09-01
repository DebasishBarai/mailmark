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

// Classify a Gmail failure. Credentials that Google has revoked or that were
// never valid will not start working again, so those pause the account on the
// first occurrence rather than after the usual three strikes.
function describeFailure(error: unknown): { reason: string; fatal: boolean } {
  const reason = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  const fatal =
    code === "EAUTH" ||
    /invalid credentials|authenticationfailed|username and password not accepted|application-specific password|\b535\b/i.test(
      reason
    );
  return { reason, fatal };
}

// Amazon SES overwrites the Message-ID header on raw sends: "Amazon SES
// automatically applies its own Message-ID and Date headers; if you passed
// these headers when creating the message, they are overwritten by the values
// that Amazon SES provides" (SendRawEmail API reference). The id the warmup
// engine writes into the message therefore never reaches Gmail, so searching
// for it found nothing, every placement came back "unknown", and no open,
// importance flag, reply or spam rescue ever happened.
//
// Two things do survive to Gmail: the SES-assigned id, which SES puts in the
// Message-ID header it writes, and our own X- header, which SES leaves alone.
// IMAP HEADER search matches on substring, so the bare SES id matches the
// full header value. Both are tried, so neither assumption is load bearing on
// its own.
async function findMessageSequence(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  keys: { messageId: string; sesMessageId?: string; warmupToken?: string }
): Promise<number | null> {
  const searches: Record<string, string>[] = [];
  if (keys.warmupToken) searches.push({ "X-Warmup-Message-Id": keys.warmupToken });
  if (keys.sesMessageId) searches.push({ "Message-ID": keys.sesMessageId });
  searches.push({ "Message-ID": keys.messageId });

  for (const header of searches) {
    const results = await client.search({ header });
    if (results && results.length > 0) return results[0];
  }
  return null;
}

// Gmail's spam folder is not always at "[Gmail]/Spam". UK accounts use
// "[Google Mail]/Spam" and non-English accounts localise the name, so a
// hardcoded path throws on mailboxOpen for those. The IMAP special-use flag
// names the folder whatever it is called.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findJunkPath(client: any): Promise<string | null> {
  try {
    const boxes = await client.list();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const junk = (boxes ?? []).find((b: any) => b.specialUse === "\\Junk");
    return junk?.path ?? null;
  } catch {
    return null;
  }
}

// imapflow hands back Gmail's X-GM-LABELS as a Set, not an array, and the same
// goes for flags. Array.includes on a Set is not a function, so reading the
// importance label threw a TypeError on every message that was found in the
// inbox. The catch in checkPlacement then recorded that as an account failure,
// which is why healthy accounts kept auto-pausing after three strikes, and it
// returned "unknown" placement, so no open, importance flag, reply or spam
// rescue ever ran for a delivered warmup email.
//
// Both shapes are accepted rather than just the Set: the value is untyped here
// and a bare array is what the old code assumed.
function hasLabel(value: unknown, label: string): boolean {
  if (value instanceof Set) return value.has(label);
  if (Array.isArray(value)) return value.includes(label);
  return false;
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

    // await transporter.sendMail(mailOptions);
    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      const { reason, fatal } = describeFailure(error);
      await ctx.runMutation(
        internal.platformWarmupAccounts.recordAccountFailure,
        { accountId: args.accountId, reason: `SMTP send: ${reason}`, fatal }
      );
      throw error;
    }

    await ctx.runMutation(
      internal.platformWarmupAccounts.recordAccountSuccess,
      { accountId: args.accountId }
    );
    return messageId;
  },
});

export const checkPlacement = internalAction({
  args: {
    accountId: v.id("platformWarmupAccounts"),
    messageId: v.string(),
    sesMessageId: v.optional(v.string()),
    warmupToken: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ placement: "inbox" | "spam" | "unknown"; isImportant: boolean }> => {
    const account = await ctx.runQuery(
      internal.platformWarmupAccounts.getAccountById,
      { accountId: args.accountId }
    );
    if (!account) return { placement: "unknown", isImportant: false };

    const client = createImapClient(account.email, account.appPassword);
    const keys = {
      messageId: args.messageId,
      sesMessageId: args.sesMessageId,
      warmupToken: args.warmupToken,
    };

    try {
      await client.connect();

      // Check INBOX
      await client.mailboxOpen("INBOX");
      const inboxHit = await findMessageSequence(client, keys);
      if (inboxHit !== null) {
        const msg = await client.fetchOne(inboxHit, { flags: true, labels: true });
        await client.logout();
        await ctx.runMutation(
          internal.platformWarmupAccounts.recordAccountSuccess,
          { accountId: args.accountId }
        );
        // // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // const labels = (msg as any).labels || [];
        // return {
        //   placement: "inbox",
        //   isImportant: labels.includes("\\Important"),
        // };
        //
        // fetchOne resolves to false when the sequence number no longer names a
        // message, so the label read has to survive that as well as the Set.
        return {
          placement: "inbox",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          isImportant: hasLabel((msg as any)?.labels, "\\Important"),
        };
      }

      // Check Spam, wherever this account keeps it
      const junkPath = await findJunkPath(client);
      let spamHit: number | null = null;
      if (junkPath) {
        await client.mailboxOpen(junkPath);
        spamHit = await findMessageSequence(client, keys);
      } else {
        console.error(
          `Warmup account ${account.email}: no \\Junk mailbox found, cannot check spam placement`
        );
      }
      await client.logout();

      // The session itself worked, whatever the search turned up.
      await ctx.runMutation(
        internal.platformWarmupAccounts.recordAccountSuccess,
        { accountId: args.accountId }
      );

      if (spamHit !== null) {
        return { placement: "spam", isImportant: false };
      }

      return { placement: "unknown", isImportant: false };
    } catch (error) {
      try { await client.logout(); } catch { /* ignore */ }
      console.error("IMAP checkPlacement failed:", error);
      // A failure here is why placements silently stopped resolving before:
      // the error was logged and the account stayed in rotation.
      const { reason, fatal } = describeFailure(error);
      await ctx.runMutation(
        internal.platformWarmupAccounts.recordAccountFailure,
        { accountId: args.accountId, reason: `IMAP placement check: ${reason}`, fatal }
      );
      return { placement: "unknown", isImportant: false };
    }
  },
});

export const rescueFromSpam = internalAction({
  args: {
    accountId: v.id("platformWarmupAccounts"),
    messageId: v.string(),
    sesMessageId: v.optional(v.string()),
    warmupToken: v.optional(v.string()),
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

      const junkPath = await findJunkPath(client);
      if (!junkPath) {
        await client.logout();
        console.error(
          `Warmup account ${account.email}: no \\Junk mailbox found, cannot rescue from spam`
        );
        return;
      }

      await client.mailboxOpen(junkPath);
      const hit = await findMessageSequence(client, {
        messageId: args.messageId,
        sesMessageId: args.sesMessageId,
        warmupToken: args.warmupToken,
      });

      if (hit !== null) {
        await client.messageMove(hit, "INBOX");
      }

      await client.logout();
    } catch (error) {
      try { await client.logout(); } catch { /* ignore */ }
      console.error("IMAP rescueFromSpam failed:", error);
      const { reason, fatal } = describeFailure(error);
      await ctx.runMutation(
        internal.platformWarmupAccounts.recordAccountFailure,
        { accountId: args.accountId, reason: `IMAP spam rescue: ${reason}`, fatal }
      );
    }
  },
});

export const markImportant = internalAction({
  args: {
    accountId: v.id("platformWarmupAccounts"),
    messageId: v.string(),
    sesMessageId: v.optional(v.string()),
    warmupToken: v.optional(v.string()),
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

      const hit = await findMessageSequence(client, {
        messageId: args.messageId,
        sesMessageId: args.sesMessageId,
        warmupToken: args.warmupToken,
      });

      if (hit !== null) {
        await client.messageFlagsAdd(hit, ["\\Flagged"]);
        // Gmail maps X-GM-LABELS for importance
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (client as any).messageLabelAdd(hit, ["\\Important"]);
        } catch {
          // Fallback: flagging is sufficient for engagement signal
        }
      }

      await client.logout();
    } catch (error) {
      try { await client.logout(); } catch { /* ignore */ }
      console.error("IMAP markImportant failed:", error);
      const { reason, fatal } = describeFailure(error);
      await ctx.runMutation(
        internal.platformWarmupAccounts.recordAccountFailure,
        { accountId: args.accountId, reason: `IMAP mark important: ${reason}`, fatal }
      );
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
