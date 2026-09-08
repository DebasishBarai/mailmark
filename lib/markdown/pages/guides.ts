/**
 * Markdown bodies for the pages under /guides.
 *
 * These mirror the prose of the React pages they belong to.
 */

export const guidesMarkdown: Record<string, string> = {
  "/guides/dns-setup": `Configure your domain's DNS records to send and receive email with Mailmark. This takes about 10 minutes, plus DNS propagation time (up to 48 hours).

## Before you begin

- You must own the domain you want to configure.
- You need access to your domain registrar's DNS settings (Namecheap, Cloudflare, GoDaddy, and so on).
- Mailmark shows you the exact values to copy. You do not need to calculate anything.

## 1. Add your domain in Mailmark

Go to Dashboard -> Domains -> Add domain and enter your domain name (e.g. \`yourcompany.com\`). Mailmark generates the DNS records you need to add.

## 2. Add MX records (incoming email)

MX (Mail Exchanger) records tell the internet where to deliver email for your domain.

| Type | Host / Name | Value | Priority | TTL |
| ---- | ----------- | ----- | -------- | --- |
| MX | @ | inbound.mailmark.dev | 10 | 3600 |
| MX | @ | inbound-alt.mailmark.dev | 20 | 3600 |

## 3. Add an SPF record (sender authentication)

SPF tells receiving servers which services are authorised to send email on behalf of your domain.

| Type | Host / Name | Value | TTL |
| ---- | ----------- | ----- | --- |
| TXT | @ | v=spf1 include:spf.mailmark.dev ~all | 3600 |

If you already have an SPF record, add \`include:spf.mailmark.dev\` to it rather than creating a second TXT record. A domain can only have one SPF record.

## 4. Add a DKIM record (email signing)

DKIM adds a cryptographic signature to your outgoing emails. Mailmark generates a unique DKIM key for your domain; find it in Dashboard -> Domains -> [your domain] -> DNS records.

| Type | Host / Name | Value | TTL |
| ---- | ----------- | ----- | --- |
| TXT | mailmark._domainkey | v=DKIM1; k=rsa; p=<your key from dashboard> | 3600 |

## 5. Add a DMARC record (optional but recommended)

DMARC tells receiving servers what to do with emails that fail SPF or DKIM checks. Start with a monitoring-only policy.

| Type | Host / Name | Value | TTL |
| ---- | ----------- | ----- | --- |
| TXT | _dmarc | v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com | 3600 |

## 6. Verify your domain

Go back to Dashboard -> Domains and click Verify domain. Mailmark checks for all the records above. DNS changes typically propagate within minutes but can take up to 48 hours.

Once verified, you are ready to create mailboxes and send email.

## Next steps

- [Create your first mailbox](/docs)
- [Improve deliverability](/guides/email-deliverability)
- [Check your records](/tools/email-deliverability-checker) with the free deliverability checker.
`,

  "/guides/email-deliverability": `Reaching the inbox is only half the battle. This guide covers how to build and maintain a strong sender reputation so your emails land in the inbox, not spam.

Email deliverability is the ability of your emails to reach subscribers' inboxes. The major factors are domain authentication, sender reputation, email content, and list quality. Neglecting any one of them can route your email to spam or get it blocked entirely.

## Healthy benchmarks

| Metric | Target |
| ------ | ------ |
| Open rate | > 20% |
| Click rate | > 2% |
| Bounce rate | < 2% |
| Spam complaint rate | < 0.1% |
| Unsubscribe rate | < 0.5% |

## 1. Authenticate your domain

- Set up SPF, DKIM, and DMARC records (see the [DNS Setup Guide](/guides/dns-setup)).
- Use a custom domain. Never send campaigns from @gmail.com or @yahoo.com.
- Start with DMARC policy \`p=none\`, then graduate to \`p=quarantine\` as you gain confidence.

## 2. Warm up your sending IP

- Start with small volumes (50-100/day) and increase by 30-50% every 3-5 days.
- Send to your most engaged contacts first. High open rates signal good sender reputation.
- Avoid large one-off blasts. Consistent daily volume beats spikes.

## 3. Maintain list hygiene

- Remove hard bounces immediately and soft bounces after 3-5 attempts.
- Remove contacts who have not engaged in 90+ days, or run a re-engagement campaign first.
- Never purchase email lists. They contain spam traps and dramatically hurt deliverability.
- Use double opt-in for new subscribers.

## 4. Write better email content

- Avoid spam trigger words like "FREE!!!", "Act now", "Guaranteed", "No risk".
- Maintain a healthy text-to-image ratio (more text than images).
- Always include a plain-text version of your email.
- Use a clear, recognisable sender name and reply-to address.

## 5. Monitor your metrics

- Keep open rate above 20% and click rate above 2%. Lower rates signal disengagement.
- Keep bounce rate below 2% and spam complaint rate below 0.1%.
- Monitor your domain's reputation with Google Postmaster Tools and Senderscore.org.
- Set up bounce and complaint webhook handlers to act on events in real time.

## 6. Send at the right time

- Tuesday to Thursday, 9 to 11 am recipient local time, consistently outperform other windows.
- Avoid major holidays and Fridays for B2B audiences.
- Test send times with A/B splits and let the data guide you.

## Quick summary

Great deliverability comes down to three things: proving you are who you say you are (authentication), earning trust over time (sender reputation), and respecting your recipients (list hygiene and content quality). Mailmark handles the technical infrastructure. The rest is up to you.

## Related

- [DNS Setup Guide](/guides/dns-setup)
- [Email Warmup](/docs/warmup)
- [Deliverability checker](/tools/email-deliverability-checker)
`,
};
