/**
 * Pure helpers for applications submitted through /careers/apply: the link
 * checks the mutation validates with, the notice emailed to the jobs inbox,
 * and the acknowledgement sent back to the applicant.
 *
 * No Convex or AWS imports, so the Node send action and the V8 mutation can
 * both use this and the rules stay testable on their own.
 */

import {
  escapeHtml,
  singleLine,
  greetingFor,
  renderAcknowledgement,
} from "./emailNotice";

/**
 * Answers to "How did you hear about Mailmark?".
 *
 * A fixed list rather than free text, so the answers can be counted later
 * instead of being read one by one. Shared with the form, which renders it as
 * the select's options, and with the mutation, which refuses anything not on
 * it: a hand-rolled POST cannot write a value the form could not produce.
 */
export const HEARD_ABOUT_OPTIONS = [
  "Google search",
  "X / Twitter",
  "LinkedIn",
  "GitHub",
  "Hacker News or Reddit",
  "A friend or colleague",
  "Somewhere else",
] as const;

export type HeardAbout = (typeof HEARD_ABOUT_OPTIONS)[number];

export function isKnownHeardAbout(value: string): value is HeardAbout {
  return (HEARD_ABOUT_OPTIONS as readonly string[]).includes(value);
}

/**
 * The role someone picks when nothing on the list fits.
 *
 * Defined here rather than with the openings, because both the form and the
 * acknowledgement have to recognise it: "your application for Open
 * application" is not a sentence, so the wording changes when this is the
 * role. app/careers/openings.ts re-exports it so the page has one import.
 */
export const OPEN_APPLICATION = "Open application";

export type JobApplicationInput = {
  name: string;
  email: string;
  role: string;
  location: string;
  profileUrl: string;
  resumeUrl?: string;
  heardAbout: string;
  note: string;
  createdAt: number;
};

export type JobApplicationNotice = {
  subject: string;
  html: string;
  text: string;
};

/**
 * Accept a link a candidate pasted, or null when it is not one we would put
 * in an email.
 *
 * A bare "linkedin.com/in/jane" is what people actually type, so a missing
 * scheme is filled in rather than rejected. Only http and https survive:
 * javascript: and data: would otherwise be rendered as an href in the notice
 * we send ourselves, and mailto: or file: links are not portfolios.
 */
export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 500) return null;
  // Reject anything with whitespace inside before guessing at a scheme, so
  // "see my site: example.com" does not become a URL.
  if (/\s/.test(trimmed)) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  // A hostname with no dot is either localhost or a typo, and neither is a
  // link we can open.
  if (!parsed.hostname.includes(".")) return null;

  return parsed.toString();
}

export function buildJobApplicationNotice(
  input: JobApplicationInput
): JobApplicationNotice {
  const name = singleLine(input.name) || "Someone";
  const role = singleLine(input.role) || "Open application";
  const submittedAt = new Date(input.createdAt).toUTCString();

  const subject = `[Careers] ${role}: ${name}`;

  const rows: Array<[string, string]> = [
    ["Applicant", `${name} <${input.email}>`],
    ["Role", role],
    ["Location", singleLine(input.location)],
    ["Profile", input.profileUrl],
    ...(input.resumeUrl
      ? ([["Resume", input.resumeUrl]] as Array<[string, string]>)
      : []),
    ["Heard about us", singleLine(input.heardAbout)],
    ["Submitted", submittedAt],
  ];

  // Links are rendered as anchors so the inbox is one click from the CV. Safe
  // to do because normalizeUrl has already refused anything that is not http
  // or https, and the value is escaped on the way into both the href and the
  // link text.
  const linkLabels = new Set(["Profile", "Resume"]);
  const rowsHtml = rows
    .map(([label, value]) => {
      const rendered = linkLabels.has(label)
        ? `<a href="${escapeHtml(value)}" style="color:#7c3aed;">${escapeHtml(value)}</a>`
        : escapeHtml(value);
      return `
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;white-space:nowrap;">${escapeHtml(label)}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#111;word-break:break-word;">${rendered}</td>
            </tr>`;
    })
    .join("");

  const html = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f6f6f7;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;padding:32px;">
            <tr>
              <td>
                <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#7c3aed;">Mailmark</p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#111;">New application for ${escapeHtml(role)}.</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #eee;border-radius:8px;overflow:hidden;">
                  <tbody>${rowsHtml}
                  </tbody>
                </table>
                <div style="margin:20px 0;padding:14px 16px;background:#faf7ff;border-left:3px solid #7c3aed;border-radius:4px;">
                  <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;white-space:pre-wrap;">${escapeHtml(input.note)}</p>
                </div>
                <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#374151;">Reply to this email to answer ${escapeHtml(name)} directly.</p>
                <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #eee;font-size:12px;line-height:1.5;color:#9ca3af;">Sent by the Mailmark careers form. The applicant's address has not been verified.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;

  const text = [
    `New application for ${role}.`,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Note:",
    "",
    input.note,
    "",
    `Reply to this email to answer ${name} directly.`,
    "",
    "Sent by the Mailmark careers form. The applicant's address has not been verified.",
  ].join("\n");

  return { subject, html, text };
}

/**
 * The acknowledgement the applicant receives.
 *
 * Deliberately thin on content. It goes to an address typed into a public
 * form and never verified, so anyone can make us send one to anyone: it
 * carries no attachment, no link back into the product, and nothing the
 * sender wrote beyond their own first name and the role they picked. What it
 * says is true for every application, so a stranger receiving one in error
 * learns only that someone used their address.
 */
export function buildApplicantAcknowledgement(
  input: Pick<JobApplicationInput, "name" | "role">,
  options: { jobsEmail: string }
): JobApplicationNotice {
  const role = singleLine(input.role);
  const isOpenApplication =
    role.length === 0 || role.toLowerCase() === OPEN_APPLICATION.toLowerCase();

  const subject = isOpenApplication
    ? "We received your application"
    : `We received your application for ${role}`;

  const { html, text } = renderAcknowledgement({
    greeting: greetingFor(input.name),
    lines: [
      isOpenApplication
        ? "Thanks for writing to us about joining Mailmark. Your application is in and a person will read it."
        : `Thanks for applying for ${role} at Mailmark. Your application is in and a person will read it.`,
      "We reply to everyone, usually within a week. If we would like to talk, the next step is a short call to hear about what you have built.",
      `Anything to add in the meantime, a link or an updated resume, just reply to this email and it will reach us at ${options.jobsEmail}.`,
    ],
    footer:
      "You are receiving this because this address was used to apply on www.mailmark.dev/careers. If that was not you, you can ignore this email.",
  });

  return { subject, html, text };
}
