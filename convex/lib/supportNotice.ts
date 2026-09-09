/**
 * Builds the two emails a /contact submission sends: the internal notice to
 * the support inbox, and the acknowledgement back to whoever wrote in.
 *
 * Pure string building, no Convex or AWS imports, so the Node send action can
 * use it without dragging the runtime into a test. Every value here is typed
 * by an anonymous visitor, so all of it is HTML escaped on the way in: the
 * only markup in the output is the markup this file writes.
 */

import {
  escapeHtml,
  singleLine,
  greetingFor,
  renderAcknowledgement,
} from "./emailNotice";

export type SupportRequestInput = {
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: number;
};

export type SupportNotice = {
  subject: string;
  html: string;
  text: string;
};

export function buildSupportNotice(input: SupportRequestInput): SupportNotice {
  const name = singleLine(input.name) || "Someone";
  const topic = singleLine(input.subject) || "No subject";
  const submittedAt = new Date(input.createdAt).toUTCString();

  const subject = `[Contact] ${topic} from ${name}`;

  const rows: Array<[string, string]> = [
    ["From", `${name} <${input.email}>`],
    ["Topic", topic],
    ["Submitted", submittedAt],
  ];

  const rowsHtml = rows
    .map(
      ([label, value]) => `
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;white-space:nowrap;">${escapeHtml(label)}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#111;word-break:break-word;">${escapeHtml(value)}</td>
            </tr>`
    )
    .join("");

  const html = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f6f6f7;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;padding:32px;">
            <tr>
              <td>
                <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#7c3aed;">Mailmark</p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#111;">New message from the contact form.</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #eee;border-radius:8px;overflow:hidden;">
                  <tbody>${rowsHtml}
                  </tbody>
                </table>
                <div style="margin:20px 0;padding:14px 16px;background:#faf7ff;border-left:3px solid #7c3aed;border-radius:4px;">
                  <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;white-space:pre-wrap;">${escapeHtml(input.message)}</p>
                </div>
                <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#374151;">Reply to this email to answer ${escapeHtml(name)} directly.</p>
                <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #eee;font-size:12px;line-height:1.5;color:#9ca3af;">Sent by the Mailmark contact form. The sender's address has not been verified.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;

  const text = [
    "New message from the contact form.",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Message:",
    "",
    input.message,
    "",
    `Reply to this email to answer ${name} directly.`,
    "",
    "Sent by the Mailmark contact form. The sender's address has not been verified.",
  ].join("\n");

  return { subject, html, text };
}

/**
 * The acknowledgement the sender receives.
 *
 * Thin on content for the same reason the careers one is: it goes to an
 * address typed into a public form and never verified, so anyone can make us
 * send one to anyone. It carries the topic they chose, which came from a
 * fixed list, and nothing else they wrote. Their own message is not quoted
 * back: that would turn the form into a way to deliver arbitrary text to a
 * stranger's inbox over our domain.
 */
export function buildSupportAcknowledgement(
  input: Pick<SupportRequestInput, "name" | "subject">,
  options: { supportEmail: string }
): SupportNotice {
  const topic = singleLine(input.subject);

  const subject =
    topic.length > 0
      ? `We received your message about ${topic}`
      : "We received your message";

  const { html, text } = renderAcknowledgement({
    greeting: greetingFor(input.name),
    lines: [
      topic.length > 0
        ? `Thanks for writing to Mailmark about ${topic}. Your message is in and a person will read it.`
        : "Thanks for writing to Mailmark. Your message is in and a person will read it.",
      "We answer every message, usually within a couple of hours on business days. Our hours are Monday to Friday, 9am to 6pm UTC.",
      `Anything to add in the meantime, just reply to this email and it will reach us at ${options.supportEmail}.`,
    ],
    footer:
      "You are receiving this because this address was used to write to us on www.mailmark.dev/contact. If that was not you, you can ignore this email.",
  });

  return { subject, html, text };
}
