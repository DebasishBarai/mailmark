"use node";

import { DOMParser } from "@xmldom/xmldom";
// Convex's bundler loads the browser build of the AWS SDK XML parser,
// which expects DOMParser to be a global. Polyfill it for Node.js.
if (typeof globalThis.DOMParser === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).DOMParser = DOMParser;
}

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { SendEmailCommand } from "@aws-sdk/client-sesv2";
import { getPlatformAwsClients } from "./lib/awsClients";
import {
  buildSupportNotice,
  buildSupportAcknowledgement,
} from "./lib/supportNotice";

// Always the platform's own support identity, never a customer domain: this
// mail is sent on our behalf, to ourselves, about a message from a stranger.
const SUPPORT_FROM_ADDRESS =
  process.env.SUPPORT_FROM_EMAIL ?? "support@mailmark.dev";
const SUPPORT_FROM_NAME = "Mailmark Contact Form";
// Where the notice lands. Separate from the From address so the inbox can be
// moved (to a shared inbox, a helpdesk, a personal address) without changing
// which verified identity we send as.
const SUPPORT_INBOX_ADDRESS =
  process.env.SUPPORT_INBOX_EMAIL ?? SUPPORT_FROM_ADDRESS;

/**
 * Email the support inbox about one /contact submission, and acknowledge it
 * to the sender.
 *
 * Scheduled from supportRequests.submit, so the visitor's request has already
 * committed by the time this runs. A failure here is recorded on the row and
 * swallowed: the message is safe in the table either way, and there is no
 * caller left to report to.
 *
 * The two sends are independent, each in its own try. A rejected
 * acknowledgement, which is the likelier of the two since the address is
 * whatever the visitor typed, must not stop the message reaching the support
 * inbox, and neither failure should hide the other on the row.
 *
 * Both bodies are built from the stored row rather than from anything the
 * client sent along, and every field is escaped, so no visitor can post
 * markup out through our support identity. On the internal notice Reply-To
 * carries their address, which is unverified, which is why it is Reply-To and
 * not From: sending as an address we do not own would fail DMARC at the
 * receiver.
 */
export const notifySupportInbox = internalAction({
  args: { requestId: v.id("supportRequests") },
  handler: async (ctx, { requestId }) => {
    const request = await ctx.runQuery(
      internal.supportRequests.getForNotice,
      { requestId }
    );
    if (!request) return;

    const notice = buildSupportNotice({
      name: request.name,
      email: request.email,
      subject: request.subject,
      message: request.message,
      createdAt: request.createdAt,
    });

    const clients = getPlatformAwsClients();

    let noticeError: string | undefined;
    try {
      await clients.sesv2.send(
        new SendEmailCommand({
          FromEmailAddress: `${SUPPORT_FROM_NAME} <${SUPPORT_FROM_ADDRESS}>`,
          Destination: { ToAddresses: [SUPPORT_INBOX_ADDRESS] },
          ReplyToAddresses: [request.email],
          Content: {
            Simple: {
              Subject: { Data: notice.subject, Charset: "UTF-8" },
              Body: {
                Html: { Data: notice.html, Charset: "UTF-8" },
                Text: { Data: notice.text, Charset: "UTF-8" },
              },
            },
          },
        })
      );
    } catch (error) {
      noticeError = error instanceof Error ? error.message : String(error);
    }

    // The acknowledgement. Replies point at the support address a person
    // actually reads, which is the From address here rather than the inbox
    // the notice above was routed to.
    const acknowledgement = buildSupportAcknowledgement(
      { name: request.name, subject: request.subject },
      { supportEmail: SUPPORT_FROM_ADDRESS }
    );

    let acknowledged = false;
    let acknowledgeError: string | undefined;
    try {
      await clients.sesv2.send(
        new SendEmailCommand({
          FromEmailAddress: `${SUPPORT_FROM_NAME} <${SUPPORT_FROM_ADDRESS}>`,
          Destination: { ToAddresses: [request.email] },
          ReplyToAddresses: [SUPPORT_FROM_ADDRESS],
          Content: {
            Simple: {
              Subject: { Data: acknowledgement.subject, Charset: "UTF-8" },
              Body: {
                Html: { Data: acknowledgement.html, Charset: "UTF-8" },
                Text: { Data: acknowledgement.text, Charset: "UTF-8" },
              },
            },
          },
        })
      );
      acknowledged = true;
    } catch (error) {
      acknowledgeError =
        error instanceof Error ? error.message : String(error);
    }

    await ctx.runMutation(internal.supportRequests.recordNotified, {
      requestId,
      error: noticeError,
      acknowledged,
      acknowledgeError,
    });
  },
});
