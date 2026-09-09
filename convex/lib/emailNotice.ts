/**
 * The pieces every notice built in this directory shares: escaping, the
 * one-line guard for values that become headers, and the acknowledgement
 * layout sent to whoever filled in a public form.
 *
 * Pulled out when the careers form gained an acknowledgement and the contact
 * form was about to gain the same one, which would have made three copies of
 * the greeting rule and the escaper. Pure string building, no Convex or AWS
 * imports, so the V8 mutations and the Node send actions can both use it.
 */

export type NoticeBody = {
  html: string;
  text: string;
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Collapse newlines, for the values that reach SES as a header rather than as
 * body text. SES rejects most of this itself, but a subject built from form
 * input is the one way a visitor could reach a header boundary.
 */
export function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/**
 * "Hi Jane," from a submitted name, or a plain "Hi," when there is nothing
 * usable there.
 *
 * First name only, and only when it looks like one: the name comes from a
 * public form, so it can be blank, a pasted URL, or a paragraph, and none of
 * those should be read back to someone as their name.
 */
export function greetingFor(name: string): string {
  const firstName = singleLine(name).split(" ")[0] ?? "";
  return firstName.length > 0 && firstName.length <= 40
    ? `Hi ${firstName},`
    : "Hi,";
}

/**
 * The acknowledgement layout: a greeting, a few paragraphs, the Mailmark
 * sign-off, and a footer saying why the mail arrived.
 *
 * Every acknowledgement goes to an address typed into a public form and never
 * verified, so anyone can make us send one to anyone. Callers pass only lines
 * that are true of every submission, and the footer tells a stranger who
 * received one in error that they can ignore it.
 */
export function renderAcknowledgement(input: {
  greeting: string;
  lines: string[];
  footer: string;
}): NoticeBody {
  const { greeting, lines, footer } = input;

  const html = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f6f6f7;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;padding:32px;">
            <tr>
              <td>
                <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#7c3aed;">Mailmark</p>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#111;">${escapeHtml(greeting)}</p>
                ${lines
                  .map(
                    (line) =>
                      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${escapeHtml(line)}</p>`
                  )
                  .join("\n                ")}
                <p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#374151;">Mailmark</p>
                <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #eee;font-size:12px;line-height:1.5;color:#9ca3af;">${escapeHtml(footer)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;

  const text = [
    greeting,
    "",
    ...lines.flatMap((line) => [line, ""]),
    "Mailmark",
    "",
    footer,
  ].join("\n");

  return { html, text };
}
