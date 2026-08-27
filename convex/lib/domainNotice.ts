/**
 * Builds the "your domain is not verified yet" notice we send to a domain
 * owner from support@mailmark.dev.
 *
 * Pure string building, no Convex or AWS imports, so both the V8 preview
 * query and the Node send action can use it and produce byte-identical
 * output. The record set here mirrors the one rendered on the domain detail
 * page, so what the customer reads in the email matches their dashboard.
 */

export type DomainNoticeInput = {
  domain: string;
  region: string;
  dkimTokens: string[];
  dkimRecordStatus: boolean[];
  mxVerified: boolean;
  spfVerified: boolean;
  dmarcVerified: boolean;
  mailFromMxVerified: boolean;
  mailFromSpfVerified: boolean;
  sesDkimStatus?: string;
  sesMailFromStatus?: string;
};

export type PendingRecord = {
  purpose: string;
  type: "MX" | "TXT" | "CNAME";
  name: string;
  value: string;
};

// "dns": records are missing and the customer has to add them.
// "waiting": every record resolves, AWS is still running its own check.
// "failed": AWS stopped checking and the identity needs to be reissued,
// which is our job rather than the customer's.
export type NoticeKind = "dns" | "waiting" | "failed";

export type DomainPendingNotice = {
  kind: NoticeKind;
  subject: string;
  missingRecords: PendingRecord[];
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

// Every record we expect, in the same order and with the same values as the
// domain detail page shows.
export function expectedRecords(input: DomainNoticeInput): Array<PendingRecord & { verified: boolean }> {
  const { domain, region } = input;

  return [
    ...input.dkimTokens.map((token, i) => ({
      purpose: `DKIM ${i + 1}`,
      type: "CNAME" as const,
      name: `${token}._domainkey`,
      value: `${token}.dkim.amazonses.com`,
      verified: input.dkimRecordStatus[i] ?? false,
    })),
    {
      purpose: "Receiving",
      type: "MX" as const,
      name: "@",
      value: `10 inbound-smtp.${region}.amazonaws.com`,
      verified: input.mxVerified,
    },
    {
      purpose: "SPF",
      type: "TXT" as const,
      name: "@",
      value: "v=spf1 include:amazonses.com ~all",
      verified: input.spfVerified,
    },
    {
      purpose: "DMARC",
      type: "TXT" as const,
      name: "_dmarc",
      value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}`,
      verified: input.dmarcVerified,
    },
    {
      purpose: "MAIL FROM",
      type: "MX" as const,
      name: "mail",
      value: `10 feedback-smtp.${region}.amazonaws.com`,
      verified: input.mailFromMxVerified,
    },
    {
      purpose: "MAIL FROM SPF",
      type: "TXT" as const,
      name: "mail",
      value: "v=spf1 include:amazonses.com ~all",
      verified: input.mailFromSpfVerified,
    },
  ];
}

export function buildDomainPendingNotice(
  input: DomainNoticeInput,
  options: { note?: string; appUrl?: string; domainUrl?: string } = {}
): DomainPendingNotice {
  const records = expectedRecords(input);
  const missingRecords: PendingRecord[] = records
    .filter((r) => !r.verified)
    .map(({ purpose, type, name, value }) => ({ purpose, type, name, value }));

  // Only a DKIM failure means the identity has to be reissued. A failed MAIL
  // FROM check is not a reissue situation: it is optional, it falls back to the
  // default Amazon sending domain, and it never blocks the domain.
  //
  // const sesFailed =
  //   input.sesDkimStatus?.toUpperCase() === "FAILED" ||
  //   input.sesMailFromStatus?.toUpperCase() === "FAILED";
  const sesFailed = input.sesDkimStatus?.toUpperCase() === "FAILED";

  const kind: NoticeKind =
    missingRecords.length > 0 ? "dns" : sesFailed ? "failed" : "waiting";

  const subject =
    kind === "dns"
      ? `Action needed: ${missingRecords.length} DNS ${
          missingRecords.length === 1 ? "record" : "records"
        } still missing for ${input.domain}`
      : kind === "failed"
        ? `We need to reissue the DNS records for ${input.domain}`
        : `${input.domain} is set up correctly, AWS is still verifying it`;

  const intro =
    kind === "dns"
      ? `We noticed that ${input.domain} is not fully set up on Mailmark yet. The ${
          missingRecords.length === 1 ? "record" : "records"
        } below could not be found in your domain's DNS, so we cannot finish verifying it.`
      : kind === "failed"
        ? `All of the DNS records for ${input.domain} look correct on your side. Unfortunately AWS stopped checking before they were in place, so the verification has to be restarted from our end. We are taking care of that and will email you again once the new records are ready for you to add.`
        : `Good news: every DNS record for ${input.domain} is in place and resolving correctly. Nothing is pending on your side. AWS runs its own check on top of ours and has not finished yet, which is why the domain still shows as pending in your dashboard.`;

  const nextSteps =
    kind === "dns"
      ? "Add the missing records at your DNS provider, then open your domain in Mailmark and press Verify DNS. Changes can take a little while to spread across the internet, so if the check does not pass right away it is worth trying again in an hour."
      : kind === "failed"
        ? "There is nothing for you to do right now. We will follow up shortly."
        : "There is nothing for you to do. We check again every hour and your domain will switch to verified automatically once AWS confirms it. We will let you know if anything changes.";

  const closing =
    kind === "dns"
      ? "If you are stuck or your DNS provider does not accept one of these records, just reply to this email and we will sort it out with you."
      : "If anything looks off or you have questions, just reply to this email and we will help.";

  const domainUrl = options.domainUrl ?? options.appUrl ?? "https://www.mailmark.dev/domains";
  const note = options.note?.trim();

  // ── HTML ──

  const recordRowsHtml = missingRecords
    .map(
      (r) => `
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;color:#111;">${escapeHtml(r.purpose)}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;color:#111;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(r.type)}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;color:#111;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all;">${escapeHtml(r.name)}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:13px;color:#111;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all;">${escapeHtml(r.value)}</td>
            </tr>`
    )
    .join("");

  const recordTableHtml =
    missingRecords.length > 0
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #eee;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#faf7ff;">
              <th align="left" style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;">Purpose</th>
              <th align="left" style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;">Type</th>
              <th align="left" style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;">Name</th>
              <th align="left" style="padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;">Value</th>
            </tr>
          </thead>
          <tbody>${recordRowsHtml}
          </tbody>
        </table>`
      : "";

  const noteHtml = note
    ? `
        <div style="margin:20px 0;padding:14px 16px;background:#faf7ff;border-left:3px solid #7c3aed;border-radius:4px;">
          <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;white-space:pre-wrap;">${escapeHtml(note)}</p>
        </div>`
    : "";

  // A fragment, not a full HTML document: this lands in the compose editor,
  // which appends the signature and any quoted text after it and lets the
  // send path add its own wrapping. A doctype and <html> here would leave
  // that trailing content outside the document.
  const html = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f6f6f7;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;padding:32px;">
            <tr>
              <td>
                <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#7c3aed;">Mailmark</p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#111;">Hi,</p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${escapeHtml(intro)}</p>
                ${recordTableHtml}
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${escapeHtml(nextSteps)}</p>
                ${noteHtml}
                <p style="margin:24px 0;">
                  <a href="${escapeHtml(domainUrl)}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:8px;">Open your domain settings</a>
                </p>
                <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#374151;">${escapeHtml(closing)}</p>
                <p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#374151;">Mailmark Support</p>
                <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #eee;font-size:12px;line-height:1.5;color:#9ca3af;">You are receiving this because you added ${escapeHtml(input.domain)} to your Mailmark account.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;

  // ── Plain text ──

  const recordLinesText = missingRecords
    .map((r) => `  ${r.purpose}\n    Type:  ${r.type}\n    Name:  ${r.name}\n    Value: ${r.value}`)
    .join("\n\n");

  const text = [
    "Hi,",
    "",
    intro,
    ...(missingRecords.length > 0 ? ["", "Missing records:", "", recordLinesText] : []),
    "",
    nextSteps,
    ...(note ? ["", note] : []),
    "",
    `Open your domain settings: ${domainUrl}`,
    "",
    closing,
    "",
    "Mailmark Support",
    "",
    `You are receiving this because you added ${input.domain} to your Mailmark account.`,
  ].join("\n");

  return { kind, subject, missingRecords, html, text };
}

// Shape the stored domain row into the input the notice builder expects, so
// the preview query and the send action describe the domain identically.
export function noticeInputFromDomain(
  domain: {
    domain: string;
    sesDkimTokens?: string[];
    dkimRecordStatus?: boolean[];
    mxVerified: boolean;
    spfVerified: boolean;
    dmarcVerified: boolean;
    mailFromMxVerified?: boolean;
    mailFromSpfVerified?: boolean;
    sesDkimStatus?: string;
    sesMailFromStatus?: string;
  },
  region: string
): DomainNoticeInput {
  return {
    domain: domain.domain,
    region,
    dkimTokens: domain.sesDkimTokens ?? [],
    dkimRecordStatus: domain.dkimRecordStatus ?? [],
    mxVerified: domain.mxVerified,
    spfVerified: domain.spfVerified,
    dmarcVerified: domain.dmarcVerified,
    mailFromMxVerified: domain.mailFromMxVerified ?? false,
    mailFromSpfVerified: domain.mailFromSpfVerified ?? false,
    sesDkimStatus: domain.sesDkimStatus,
    sesMailFromStatus: domain.sesMailFromStatus,
  };
}

