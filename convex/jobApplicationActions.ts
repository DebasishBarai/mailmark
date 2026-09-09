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
  buildJobApplicationNotice,
  buildApplicantAcknowledgement,
} from "./lib/jobApplication";

// Sent as the platform's own support identity, since that is the verified one.
const SUPPORT_FROM_ADDRESS =
  process.env.SUPPORT_FROM_EMAIL ?? "support@mailmark.dev";
const CAREERS_FROM_NAME = "Mailmark Careers Form";
// Where applications land. The careers page names jobs@mailmark.dev, so that
// is the default, and the variable moves it without touching the sending
// identity.
const JOBS_INBOX_ADDRESS =
  process.env.JOBS_INBOX_EMAIL ?? "jobs@mailmark.dev";

/**
 * Email the jobs inbox about one application, and acknowledge it to the
 * applicant.
 *
 * Scheduled from jobApplications.submit, so the row has already committed. A
 * failure is recorded on the row and swallowed: the application is safe in the
 * table either way and there is no caller left to report to.
 *
 * The two sends are independent, each in its own try. A rejected
 * acknowledgement, which is the likelier of the two since the address is
 * whatever the applicant typed, must not stop the application reaching the
 * jobs inbox, and neither failure should hide the other on the row.
 *
 * The applicant's address goes in Reply-To on the internal notice rather than
 * From. It is unverified, and sending as an address we do not own would fail
 * DMARC at the receiver.
 */
export const notifyJobsInbox = internalAction({
  args: { applicationId: v.id("jobApplications") },
  handler: async (ctx, { applicationId }) => {
    const application = await ctx.runQuery(
      internal.jobApplications.getForNotice,
      { applicationId }
    );
    if (!application) return;

    const notice = buildJobApplicationNotice({
      name: application.name,
      email: application.email,
      role: application.role,
      location: application.location,
      profileUrl: application.profileUrl,
      resumeUrl: application.resumeUrl,
      heardAbout: application.heardAbout,
      note: application.note,
      createdAt: application.createdAt,
    });

    const clients = getPlatformAwsClients();

    let noticeError: string | undefined;
    try {
      await clients.sesv2.send(
        new SendEmailCommand({
          FromEmailAddress: `${CAREERS_FROM_NAME} <${SUPPORT_FROM_ADDRESS}>`,
          Destination: { ToAddresses: [JOBS_INBOX_ADDRESS] },
          ReplyToAddresses: [application.email],
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

    // The acknowledgement. Replies go to the jobs inbox rather than the
    // support one, so a candidate answering this lands where the rest of
    // their application already is.
    const acknowledgement = buildApplicantAcknowledgement(
      { name: application.name, role: application.role },
      { jobsEmail: JOBS_INBOX_ADDRESS }
    );

    let acknowledged = false;
    let acknowledgeError: string | undefined;
    try {
      await clients.sesv2.send(
        new SendEmailCommand({
          FromEmailAddress: `${CAREERS_FROM_NAME} <${SUPPORT_FROM_ADDRESS}>`,
          Destination: { ToAddresses: [application.email] },
          ReplyToAddresses: [JOBS_INBOX_ADDRESS],
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

    await ctx.runMutation(internal.jobApplications.recordNotified, {
      applicationId,
      error: noticeError,
      acknowledged,
      acknowledgeError,
    });
  },
});
