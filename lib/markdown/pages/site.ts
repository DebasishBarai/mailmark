/**
 * Markdown bodies for the home page, the free tools, and the company pages.
 *
 * Legal pages (privacy, terms, security) are deliberately absent: their
 * binding text lives on the HTML page, and a summary that drifts from it would
 * be worse than no summary. Requests for those in Markdown get the generated
 * stub from lib/markdown/index.ts, which points at the canonical page.
 */

export const siteMarkdown: Record<string, string> = {
  "/": `Mailmark is an email hosting and campaign platform for custom domains. Connect a domain you own, create mailboxes like \`support@yourco.com\`, and run day-to-day email, bulk campaigns, and transactional sending from one dashboard or from the REST API.

## What you get

- **Custom domain email hosting** - send and receive from your own domain without running mail servers. Mailmark handles the infrastructure on Amazon SES.
- **A full email client** - inbox, sent, outbox, drafts, and trash for every mailbox, in the browser.
- **Email campaigns** - bulk sends with personalisation, open and click tracking, follow-up sequences, and real-time analytics.
- **Email warmup** - automated warmup that builds sender reputation before you send at volume.
- **REST API and npm SDK** - \`mailmark-sdk\` for Node.js, TypeScript, and Bun; API keys prefixed \`dm_live_\`.
- **BYO-AWS** - optionally run the same SES / S3 / Lambda / SNS resources inside your own AWS account.

## How it works

1. Add your domain in Dashboard -> Domains and choose Mailmark-hosted infrastructure or your own AWS account.
2. Add the DNS records Mailmark generates (MX, SPF, DKIM, DMARC) at your registrar and click Verify.
3. Create mailboxes on the verified domain.
4. Send from the dashboard, the REST API, or the npm SDK.

Full walkthrough: [Getting Started](/docs/getting-started).

## Pricing

All plans include a 7-day free trial with full feature access, no credit card required. Billing is monthly; upgrade, downgrade, or cancel at any time.

| Plan | Price | Emails/month | Domains | Mailboxes | Support |
| ---- | ----- | ------------ | ------- | --------- | ------- |
| Starter | $10/month | 1,000 | 1 | 3 | Basic |
| Pro | $50/month | 25,000 | 5 | Unlimited | Priority |
| Business | $100/month | 100,000 | Unlimited | Unlimited | Dedicated |

Every plan includes the full email UI, campaigns, campaign analytics, and REST API access.

## Where to go next

- [Documentation](/docs)
- [API reference](/docs/api) and the [OpenAPI description](/openapi.json)
- [Free tools](/tools)
- [Blog](/blog)
- [llms.txt](/llms.txt) - the long-form, machine-readable description of the whole product
`,

  "/tools": `Free email tools from Mailmark. No signup required for most of them.

| Tool | What it does |
| ---- | ------------ |
| [Email Deliverability Checker](/tools/email-deliverability-checker) | Check a domain's SPF, DKIM, DMARC records, blacklist status, and overall health score. |
| [SES Savings Calculator](/tools/ses-savings-calculator) | Compare what your volume costs on AWS SES with Mailmark against your current provider. |
| [Cold Email Subject Line Generator](/tools/subject-line-generator) | Generate cold email subject lines for your industry and offer. |
| [Cold Email Lead Finder](/tools/lead-finder) | Find business leads and their public contact details. |
| [Email List Validator](/tools/email-list-validator) | Validate addresses for syntax, disposable domains, MX records, and role accounts. |
| [Email Spam Score Tester](/tools/spam-score-tester) | Score subject and body content against common spam filter triggers. |
| [Email Signature Generator](/tools/email-signature-generator) | Build an HTML signature you can paste into any email client. |

Some tools have HTTP endpoints of their own; see the [API reference](/docs/api#public-tool-endpoints).
`,

  "/tools/email-deliverability-checker": `Check your domain's SPF, DKIM, DMARC records, blacklist status, and get an overall health score. Instant results, no signup required.

## What it checks

- **SPF** - whether a valid \`v=spf1\` record exists and which senders it authorises.
- **DKIM** - whether DKIM keys are published for the domain.
- **DMARC** - whether a \`_dmarc\` policy exists, and what it is set to.
- **MX** - the mail exchangers responsible for inbound mail.
- **Blacklists** - whether the domain appears on common DNS blocklists.

## API

\`\`\`bash
curl -X POST https://www.mailmark.dev/api/tools/check-deliverability \\
  -H "Content-Type: application/json" \\
  -d '{"domain":"acme.com"}'
\`\`\`

Rate limited per IP. Errors come back as structured JSON with \`error\`, \`code\`, and \`hint\`.

Related: [DNS Setup Guide](/guides/dns-setup), [Email Deliverability Guide](/guides/email-deliverability).
`,

  "/tools/ses-savings-calculator": `Find out how much you could save by switching from your current email provider to AWS SES with Mailmark.

Enter your monthly email volume and current provider spend; the calculator compares that against SES pricing plus a Mailmark plan and shows the monthly and annual difference. Everything runs in the browser, no signup required.

Related: [Pricing](/#pricing), [Getting Started](/docs/getting-started).
`,

  "/tools/subject-line-generator": `Generate cold email subject lines tailored to your industry, your offer, and the tone you want.

## API

\`\`\`bash
curl -X POST https://www.mailmark.dev/api/tools/generate-subject-lines \\
  -H "Content-Type: application/json" \\
  -d '{"industry":"SaaS","offer":"a 15 minute demo","tone":"direct"}'
\`\`\`

Valid tones: \`casual\`, \`professional\`, \`direct\`, \`friendly\`, \`urgent\`.

Rate limited per IP. Errors come back as structured JSON with \`error\`, \`code\`, and \`hint\`.

Related: [Email Deliverability Guide](/guides/email-deliverability), [Spam Score Tester](/tools/spam-score-tester).
`,

  "/tools/lead-finder": `Find business leads and their public contact details for cold outreach, then export them for a campaign.

Search by role, industry, and location. Results include the public company and contact details available for each lead.

Related: [Email List Validator](/tools/email-list-validator), [Email Campaigns](/docs/email-campaigns).
`,

  "/tools/email-list-validator": `Validate a list of email addresses before you send to it.

## What it checks

- Syntax
- Disposable email providers
- Whether the domain has an MX record
- Role-based addresses (shared inboxes such as \`info@\`)
- Free email providers

Each address is returned as \`valid\`, \`risky\`, or \`invalid\` with a reason.

## API

\`\`\`bash
curl -X POST https://www.mailmark.dev/api/tools/validate-emails \\
  -H "Content-Type: application/json" \\
  -d '{"emails":["alice@acme.com","bob@example.com"]}'
\`\`\`

Related: [Email Deliverability Guide](/guides/email-deliverability).
`,

  "/tools/spam-score-tester": `Score an email's subject line and body against the patterns that trigger spam filters, and see what to change before you send.

Related: [Email Deliverability Guide](/guides/email-deliverability), [Deliverability Checker](/tools/email-deliverability-checker).
`,

  "/tools/email-signature-generator": `Build a professional HTML email signature and copy it into any email client.

Fill in your name, title, company, contact details, and links; the generator produces HTML you can paste into Mailmark, Gmail, Outlook, or Apple Mail.

Related: [Mailboxes](/docs/mailboxes).
`,

  "/blog": `Guides and product notes on custom domain email, deliverability, and campaigns.

The full list of posts, with links, is generated from the article registry. Any post is also available as Markdown at its own URL, either with \`Accept: text/markdown\` or by appending \`.md\`.
`,

  "/about": `Mailmark makes professional email hosting and campaigns accessible to every business.

## What we believe

- **Own your infrastructure.** Businesses should own their email infrastructure: your domain, your data, your rules. No vendor lock-in.
- **Simplicity first.** DNS, SPF, DKIM should not require a systems administrator. We automate the hard parts.
- **Transparent pricing.** No per-seat fees that punish growth, no surprise overages.
- **Built for teams.** Solo founder or 50-person team, Mailmark scales with you: shared inboxes, permissions, and collaboration from day one.

## In short

- All-in-one: hosting, inbox, and campaigns
- Custom domains: you@yourcompany.com
- Open source: transparent and extensible
- Self-hostable: your data, your server

Related: [Contact](/contact), [Careers](/careers), [Security](/security).
`,

  "/contact": `Get in touch with the Mailmark team. Typical response time is under 2 hours on business days.

| Reason | Address |
| ------ | ------- |
| General support | support@mailmark.dev |
| Urgent production issues | urgent@mailmark.dev |
| Security reports | security@mailmark.dev |
| Privacy requests | privacy@mailmark.dev |
| Job applications | jobs@mailmark.dev |

Before writing in, the [documentation](/docs) and [troubleshooting guide](/docs/troubleshooting) cover the most common questions.
`,

  "/careers": `Mailmark is remote-first: work from anywhere, async-friendly. All positions are remote (worldwide).

Open roles are listed on the [careers page](/careers). To apply, or to introduce yourself when nothing fits, email jobs@mailmark.dev.
`,

  "/affiliate-program": `Earn 30% recurring commission for every customer you refer to Mailmark, every month, for as long as they stay subscribed.

| Plan referred | Their price | Your commission |
| ------------- | ----------- | --------------- |
| Starter | $10/mo | $3.00/mo |
| Pro | $50/mo | $15/mo |
| Business | $100/mo | $30/mo |

- Payouts are processed on the 15th of each month for the previous month's commissions, via PayPal or bank transfer (SWIFT/SEPA).
- The minimum payout is $50. Earnings below that roll over to the next month.

Full terms and signup: [affiliate program](/affiliate-program).
`,

  "/status": `Live status of the Mailmark platform. The [status page](/status) shows the current state of each component:

- Email Sending (Outbound) - SMTP and API-based delivery via AWS SES
- Email Receiving (Inbound) - inbound MX routing and mailbox delivery
- Web Dashboard
- API - REST API at api.mailmark.dev
- DNS Verification - domain verification and DNS record checking
- Campaign Engine - bulk email sending and scheduling
- Authentication (Clerk)
- Database (Convex)
- File Storage (S3) - email attachment storage
- Webhooks & Notifications - bounce, complaint, and delivery webhooks via AWS SNS

For an incident that is not reflected here, email urgent@mailmark.dev.
`,
};
