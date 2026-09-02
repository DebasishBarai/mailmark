"use node";

/**
 * Breach notifications: one email to the account owner, one to us.
 *
 * Sent from the platform's own SES account and SUPPORT_FROM_EMAIL, not from
 * the customer's identity: the point of the message is that the customer's
 * sending is in trouble, so routing it through their own reputation would be
 * the wrong place to put it.
 *
 * Nothing here is allowed to throw into the evaluation path. A notification
 * that cannot be delivered is recorded on the incident and logged; the
 * incident itself, and any enforcement, stand on their own.
 */

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { SendEmailCommand } from "@aws-sdk/client-sesv2";
import { getPlatformAwsClients } from "./lib/awsClients";
import { asPercent, metricLabel } from "./lib/deliverability";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function supportAddress(): string {
  return process.env.SUPPORT_FROM_EMAIL ?? "support@mailmark.dev";
}

function internalAlertAddress(): string {
  return process.env.DELIVERABILITY_ALERT_EMAIL ?? supportAddress();
}

// What the customer is told to do about it. The advice differs by metric:
// a hard bounce spike is a list quality problem, a complaint spike is a
// targeting or consent problem, and they have different fixes.
function guidanceFor(metric: "hard_bounce_rate" | "complaint_rate"): string[] {
  if (metric === "hard_bounce_rate") {
    return [
      "Stop sending to the list that produced these bounces until it has been cleaned.",
      "A hard bounce means the address does not exist. Every one of them is an address that should never have been sent to.",
      "Verify the list before the next send, and remove every address that comes back invalid.",
      "Bounced addresses are already suppressed and must not be retried.",
    ];
  }
  return [
    "Stop the campaign that produced these complaints.",
    "A complaint means a recipient marked the message as spam. Recipients who did not ask to hear from you complain at a much higher rate than those who did.",
    "Check that everyone on the list opted in, that the sender name and subject match what they opted into, and that the unsubscribe link is visible.",
    "Remove any purchased, scraped, or inherited list segments.",
  ];
}

export const sendBreachNotification = internalAction({
  args: { incidentId: v.id("deliverabilityIncidents") },
  handler: async (ctx, { incidentId }) => {
    const record = await ctx.runQuery(internal.deliverability.getIncident, {
      incidentId,
    });
    if (!record?.incident) {
      console.warn("[deliverability] incident not found for notify:", incidentId);
      return;
    }

    const { incident, user, throttleDailyLimit } = record;
    const label = metricLabel(incident.metric);
    const valuePct = asPercent(incident.value);
    const thresholdPct = asPercent(incident.threshold);

    // What actually happened to their sending, which depends on the account's
    // enforcement mode and not on the breach itself.
    const actionSentence =
      incident.actionTaken === "paused"
        ? "Sending on your account is currently paused."
        : incident.actionTaken === "throttled"
          ? `Sending on your account is currently limited to ${throttleDailyLimit} emails per 24 hours.`
          : "No limit has been applied to your account. This is a warning.";

    const guidance = guidanceFor(incident.metric);
    const ownerSubject = `Action needed: ${label} at ${valuePct}% on your Mailmark account`;

    const ownerHtml = `
<div style="font-family:sans-serif;font-size:14px;color:#111827;line-height:1.6">
  <p>Your Mailmark account crossed a deliverability limit.</p>
  <table style="border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:4px 16px 4px 0;color:#6b7280">Metric</td><td style="padding:4px 0"><strong>${escapeHtml(label)}</strong></td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#6b7280">Value</td><td style="padding:4px 0"><strong>${valuePct}%</strong></td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#6b7280">Limit</td><td style="padding:4px 0">${thresholdPct}%</td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#6b7280">Window</td><td style="padding:4px 0">last ${incident.windowHours} hours</td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#6b7280">Measured over</td><td style="padding:4px 0">${incident.sampleSends.toLocaleString()} sends, ${incident.hardBounces.toLocaleString()} hard bounces, ${incident.complaints.toLocaleString()} complaints</td></tr>
  </table>
  <p><strong>${escapeHtml(actionSentence)}</strong></p>
  <p>What to do:</p>
  <ul>${guidance.map((g) => `<li>${escapeHtml(g)}</li>`).join("")}</ul>
  <p>Mailbox providers judge a sender on these rates, and AWS reviews accounts that stay above 5% hard bounce or 0.1% complaint. Bringing the rate down protects your own inbox placement as well as everyone else sending on the platform.</p>
  <p>Reply to this email if you need help cleaning the list or want the limit reviewed.</p>
  <p style="color:#6b7280">Mailmark</p>
</div>`.trim();

    const ownerText = [
      `Your Mailmark account crossed a deliverability limit.`,
      ``,
      `Metric: ${label}`,
      `Value: ${valuePct}%`,
      `Limit: ${thresholdPct}%`,
      `Window: last ${incident.windowHours} hours`,
      `Measured over: ${incident.sampleSends} sends, ${incident.hardBounces} hard bounces, ${incident.complaints} complaints`,
      ``,
      actionSentence,
      ``,
      `What to do:`,
      ...guidance.map((g) => `  - ${g}`),
      ``,
      `Reply to this email if you need help cleaning the list or want the limit reviewed.`,
    ].join("\n");

    const internalSubject = `[deliverability] ${incident.metric} ${valuePct}% - ${
      user?.email ?? incident.userId
    } (${incident.actionTaken})`;

    const internalHtml = `
<div style="font-family:monospace;font-size:13px;color:#111827;line-height:1.6">
  <p><strong>${escapeHtml(label)} breach</strong></p>
  <ul>
    <li>account: ${escapeHtml(user?.email ?? "unknown")} (${incident.userId})</li>
    <li>value: ${valuePct}% (limit ${thresholdPct}%)</li>
    <li>window: ${incident.windowHours}h</li>
    <li>sends: ${incident.sampleSends}, hard bounces: ${incident.hardBounces}, complaints: ${incident.complaints}</li>
    <li>enforcement mode: ${incident.enforcementMode}</li>
    <li>action taken: ${incident.actionTaken}</li>
    <li>incident: ${incidentId}</li>
  </ul>
  <p>Move the account with the setEnforcementMode internal mutation. Nothing changes on its own.</p>
</div>`.trim();

    let ownerNotified = false;
    let internalNotified = false;
    let notifyError: string | undefined;

    try {
      const aws = getPlatformAwsClients();
      const from = supportAddress();

      if (user?.email) {
        try {
          await aws.sesv2.send(
            new SendEmailCommand({
              FromEmailAddress: from,
              Destination: { ToAddresses: [user.email] },
              Content: {
                Simple: {
                  Subject: { Data: ownerSubject },
                  Body: {
                    Html: { Data: ownerHtml },
                    Text: { Data: ownerText },
                  },
                },
              },
            })
          );
          ownerNotified = true;
        } catch (err) {
          notifyError = `owner: ${err instanceof Error ? err.message : String(err)}`;
          console.error("[deliverability] owner notification failed:", err);
        }
      } else {
        notifyError = "owner: no email on account";
      }

      try {
        await aws.sesv2.send(
          new SendEmailCommand({
            FromEmailAddress: from,
            Destination: { ToAddresses: [internalAlertAddress()] },
            Content: {
              Simple: {
                Subject: { Data: internalSubject },
                Body: { Html: { Data: internalHtml } },
              },
            },
          })
        );
        internalNotified = true;
      } catch (err) {
        notifyError = [
          notifyError,
          `internal: ${err instanceof Error ? err.message : String(err)}`,
        ]
          .filter(Boolean)
          .join("; ");
        console.error("[deliverability] internal notification failed:", err);
      }
    } catch (err) {
      notifyError = err instanceof Error ? err.message : String(err);
      console.error("[deliverability] notification setup failed:", err);
    }

    await ctx.runMutation(internal.deliverability.markIncidentNotified, {
      incidentId,
      ownerNotified,
      internalNotified,
      notifyError,
    });
  },
});
