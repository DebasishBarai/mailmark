/**
 * Builds the internal notice we email to the support inbox when someone
 * submits the public /contact form.
 *
 * Pure string building, no Convex or AWS imports, so the Node send action can
 * use it without dragging the runtime into a test. Every value here is typed
 * by an anonymous visitor, so all of it is HTML escaped on the way in: the
 * only markup in the output is the markup this file writes.
 */

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Header injection guard for the values that reach SES as headers rather than
// as body text. SES rejects most of this itself, but the subject is built from
// visitor input and a stray newline there is the one way form input could
// reach a header boundary.
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

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
