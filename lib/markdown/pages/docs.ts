/**
 * Markdown bodies for the pages under /docs.
 *
 * These mirror the prose of the React pages they belong to. Keep both sides in
 * step: a page that changes here should change in app/docs/... too.
 */

export const docsMarkdown: Record<string, string> = {
  "/docs": `Mailmark documentation, grouped by what you are trying to do.

## Getting Started

Set up Mailmark in minutes: create your account, verify a domain, send your first email.

- [Quick-start guide](/docs/getting-started#quick-start)
- [Creating your account](/docs/getting-started#creating-account)
- [Adding your first domain](/docs/getting-started#adding-domain)
- [Sending your first email](/docs/getting-started#sending-email)

## Domain Setup

Configure DNS so your domain can send and receive mail.

- [Choose your infrastructure](/docs/domain-setup#choose-infra)
- [Verifying your domain](/docs/domain-setup#verifying-domain)
- [Configuring MX records](/docs/domain-setup#mx-records)
- [Setting up SPF & DKIM](/docs/domain-setup#spf-dkim)
- [DMARC configuration](/docs/domain-setup#dmarc)

## Bring your own AWS

Run the same SES / S3 / Lambda / SNS resources inside your own AWS account.

- [When to use BYO-AWS](/docs/byo-aws#when-to-use)
- [What gets provisioned](/docs/byo-aws#what-gets-provisioned)
- [Step-by-step setup](/docs/byo-aws#connect)
- [Disconnecting](/docs/byo-aws#disconnect)
- [Troubleshooting](/docs/byo-aws#troubleshooting)

## Mailboxes

- [Creating mailboxes](/docs/mailboxes#creating-mailboxes)
- [Managing aliases](/docs/mailboxes#managing-aliases)
- [Team mailbox permissions](/docs/mailboxes#permissions)
- [Connecting an email client (IMAP)](/docs/mailboxes#imap)

## Email Campaigns

- [Creating a campaign](/docs/email-campaigns#creating-campaign)
- [Mail merge & personalization](/docs/email-campaigns#mail-merge)
- [Scheduling & auto follow-ups](/docs/email-campaigns#scheduling)
- [Campaign analytics](/docs/email-campaigns#analytics)

## Email Warmup

- [What is warmup?](/docs/warmup#what-is-warmup)
- [Requirements](/docs/warmup#requirements)
- [Speed plans (slow / normal / fast)](/docs/warmup#speed-plans)
- [Health score](/docs/warmup#health-score)

## Sequences

- [What are sequences?](/docs/sequences#what-are-sequences)
- [Creating a sequence](/docs/sequences#creating-sequences)
- [Enrolling contacts](/docs/sequences#adding-contacts)
- [Merge fields](/docs/sequences#merge-fields)

## API Reference

- [Authentication & API keys](/docs/api#authentication)
- [Send emails via API](/docs/api#send-email)
- [Manage mailboxes via API](/docs/api#list-mailboxes)
- [OpenAPI description](/openapi.json)

## Troubleshooting

- [Emails not sending](/docs/troubleshooting#emails-not-sending)
- [Domain verification issues](/docs/troubleshooting#domain-verification)
- [Bounces & rejections](/docs/troubleshooting#bounces)
`,

  "/docs/getting-started": `Go from zero to sending emails with Mailmark in under 10 minutes.

## Quick-start guide

1. **Create a Mailmark account.** Go to [mailmark.dev](/) and click Sign In. Sign up with your email or a Google/GitHub account.
2. **Add and verify your domain.** Go to Dashboard -> Domains and click Add domain. Enter your domain name and pick an infrastructure: Mailmark infrastructure (recommended) or Use my own AWS account (see [BYO-AWS](/docs/byo-aws)). Then follow the DNS instructions to verify ownership.
3. **Create a mailbox.** Once your domain is verified, create a mailbox under Dashboard -> Mailboxes, for example \`hello@yourdomain.com\`.
4. **Send your first email.** Use the dashboard composer, the REST API, or the \`mailmark-sdk\` npm package.

## Creating your account

Visit [mailmark.dev/sign-up](/sign-up) and sign up with your email or Google account via Clerk. After signing in you land on the dashboard. Your account starts on the free plan with support for one domain and up to 200 emails per day.

You can upgrade to a paid plan at any time from Dashboard -> Settings -> Billing.

## Adding your first domain

You must own and control the domain you want to send from. Mailmark does not provide domain registration.

1. Go to Dashboard -> Domains and click Add domain.
2. Enter your domain, e.g. \`acme.com\`.
3. Pick where the AWS resources should live: Mailmark infrastructure (default, recommended) or Use my own AWS account. The DNS records are the same either way; the choice only affects where SES / S3 / Lambda are provisioned. See [BYO-AWS](/docs/byo-aws) for the advanced flow.
4. Mailmark shows the DNS records to add at your registrar, including TXT records for SPF and DKIM. Add them all.
5. Click Verify. DNS propagation can take up to 48 hours but usually completes within minutes.

Once verified, the domain status changes to Active. See [Domain Setup](/docs/domain-setup) for the full DNS reference.

## Sending your first email

Once your domain is verified and a mailbox exists, you can send immediately.

Using the npm SDK:

\`\`\`bash
npm install mailmark-sdk
# or
bun add mailmark-sdk
\`\`\`

\`\`\`javascript
import { Mailmark } from 'mailmark-sdk';

const client = new Mailmark('dm_live_your_api_key');

await client.send({
  from: 'hello@yourdomain.com',
  to: 'recipient@example.com',
  subject: 'Hello from Mailmark!',
  html: '<h1>It works!</h1>',
});
\`\`\`

Using cURL:

\`\`\`bash
curl -X POST https://api.mailmark.dev/v1/send \\
  -H "Authorization: Bearer dm_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "hello@yourdomain.com",
    "to": ["recipient@example.com"],
    "subject": "Hello from Mailmark!",
    "html": "<h1>It works!</h1>"
  }'
\`\`\`

Your API key is available in Dashboard -> Developer. See the [API Reference](/docs/api) for the full endpoint list.

## Next steps

- [Domain Setup](/docs/domain-setup) - configure DNS, SPF, DKIM, and DMARC.
- [Mailboxes](/docs/mailboxes) - create and manage mailboxes on your domain.
- [Email Campaigns](/docs/email-campaigns) - send bulk campaign emails with personalization.
- [API Reference](/docs/api) - full REST API reference with live playground.
`,

  "/docs/domain-setup": `Configure DNS records to verify your domain and ensure reliable email delivery.

## Choose your infrastructure

When you click Add domain, Mailmark asks where the underlying AWS resources (SES identity, S3 bucket for inbound email, Lambda forwarder, and SNS topics) should live. There are two options, and you pick one per domain:

- **Mailmark infrastructure** - Mailmark hosts and operates the AWS resources in its own account. Simplest setup, recommended for most users, no separate AWS bill.
- **Use my own AWS account (BYO-AWS)** - the same resources are deployed inside your AWS account via a CloudFormation Quick-Create stack. You keep full ownership of the data and pay SES / S3 costs on your AWS bill.

The choice only affects *where* the AWS resources live. The DNS records you paste into your registrar (MX, SPF, DKIM, DMARC) are the same in both modes, and you can pick a different infrastructure per domain.

For the full BYO-AWS flow - CloudFormation stack, IAM role with \`ExternalId\`, SES sandbox detection, and disconnect behavior - see [Bring your own AWS account](/docs/byo-aws).

## Verifying your domain

Domain verification proves to Mailmark (and to the internet) that you control the domain you want to send from. Until your domain is verified you cannot create mailboxes or send email from it.

1. In the dashboard go to Domains -> Add domain.
2. Enter your root domain, e.g. \`acme.com\`.
3. Mailmark generates a unique TXT record. Add it at your DNS provider.
4. Click Verify now. Mailmark polls for the record automatically every few minutes.

DNS changes can take anywhere from a few seconds to 48 hours to propagate worldwide. Most providers update within 5-15 minutes.

Once verified, the domain status changes to Active and you can start creating mailboxes.

## Configuring MX records

MX (Mail Exchanger) records tell other mail servers where to deliver inbound email for your domain.

| Type | Name | Value | Priority |
| ---- | ---- | ----- | -------- |
| MX | @ | inbound-smtp.us-east-1.amazonaws.com | 10 |

If you already have MX records pointing to another mail provider (e.g. Google Workspace), replacing them redirects all incoming email to Mailmark. Only make this change if you intend Mailmark to be your primary mail host.

## Setting up SPF & DKIM

SPF and DKIM are email authentication standards that prove your emails genuinely come from your domain, reducing the chance they land in spam.

### SPF (Sender Policy Framework)

SPF lists the servers authorised to send email on behalf of your domain.

| Type | Name | Value |
| ---- | ---- | ----- |
| TXT | @ | v=spf1 include:amazonses.com ~all |

If you already have an SPF record, append \`include:amazonses.com\` to it rather than creating a second TXT record. A domain can only have one SPF record.

### DKIM (DomainKeys Identified Mail)

DKIM adds a cryptographic signature to outgoing emails. Mailmark generates a DKIM key pair for each domain and shows the public key in the dashboard.

| Type | Name | Value |
| ---- | ---- | ----- |
| CNAME | mailmark._domainkey | mailmark._domainkey.amazonses.com |

The exact record values are displayed in Dashboard -> Domains -> your domain -> DNS records.

## DMARC configuration

DMARC tells receiving servers what to do when an email fails SPF or DKIM checks, and where to send reports.

| Type | Name | Value |
| ---- | ---- | ----- |
| TXT | _dmarc | v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com |

DMARC policy values:

- \`p=none\` - monitor only, no action taken on failures.
- \`p=quarantine\` - suspicious emails go to spam.
- \`p=reject\` - failed emails are rejected outright (strictest).

Start with \`p=none\` to observe reports, then move to \`p=quarantine\` and \`p=reject\` once you are confident all legitimate email passes authentication.

## Next steps

- [Mailboxes](/docs/mailboxes) - create mailboxes on your verified domain.
- [Troubleshooting](/docs/troubleshooting#domain-verification) - domain verification not working? See common fixes.
`,

  "/docs/mailboxes": `Mailboxes are the email addresses on your verified domain. You can create, manage, and send from them via the dashboard or API.

## Creating mailboxes

A mailbox represents a single email address on your domain, e.g. \`support@acme.com\`. You must have a verified domain before creating mailboxes.

From the dashboard:

1. Go to Dashboard -> Mailboxes and click New mailbox.
2. Enter the local part (e.g. \`support\`) and an optional display name.
3. Click Create. The mailbox is ready to use immediately.

Via the API:

\`\`\`javascript
import { Mailmark } from 'mailmark-sdk';

const client = new Mailmark('dm_live_your_api_key');

const mailbox = await client.createMailbox({
  address: 'support',       // -> support@yourdomain.com
  displayName: 'Support Team',
});

console.log(mailbox.fullAddress); // support@yourdomain.com
\`\`\`

The domain suffix is appended automatically. Pass only the local part (before the @).

Deleting a mailbox also permanently deletes all emails stored in it. This cannot be undone.

\`\`\`javascript
await client.deleteMailbox('support');
// or use the full address:
await client.deleteMailbox('support@yourdomain.com');
\`\`\`

## Managing aliases

Aliases let multiple email addresses deliver to the same mailbox. For example, \`help@acme.com\` and \`contact@acme.com\` can both route to the \`support\` mailbox.

To create an alias, go to Dashboard -> Mailboxes -> select a mailbox -> Aliases -> Add alias and enter the alias address. Aliases count towards your domain's mailbox limit on some plans.

Aliases receive mail but cannot be used as sender addresses. To send from a different address, create a separate mailbox.

## Team mailbox permissions

By default every mailbox on a domain is accessible to the domain owner. Sender Groups control which mailboxes can send as part of a group, letting you segment access without sharing credentials.

To grant a team member access to a specific mailbox via the API, create a separate API key scoped to that domain and share only that key. API keys are scoped per domain, so a key cannot access mailboxes on a domain it was not issued for.

Team member invites and per-user mailbox permissions are on the roadmap.

## Connecting an email client (IMAP)

Mailmark supports IMAP for reading received email through standard clients such as Apple Mail, Thunderbird, or Outlook.

| Setting | Value |
| ------- | ----- |
| Server | imap.mailmark.dev |
| Port | 993 |
| Security | SSL / TLS |
| Username | your full email address |
| Password | your Mailmark account password |

IMAP access is read-only. Sending always goes through the Mailmark dashboard or API.

## Next steps

- [Email Campaigns](/docs/email-campaigns) - use mailboxes to run bulk campaign sends.
- [API: Mailboxes](/docs/api#list-mailboxes) - full REST API reference for mailbox management.
`,

  "/docs/email-campaigns": `Campaigns send individual, personalised emails to a list of recipients, all tracked under a shared batch ID.

## Creating a campaign

A campaign send (\`type: "campaign"\`) sends one individual email per recipient rather than a single email to all recipients together. Each send is tracked with a shared \`batchId\`.

\`\`\`javascript
import { Mailmark } from 'mailmark-sdk';

const client = new Mailmark('dm_live_your_api_key');

const result = await client.send({
  from: 'newsletter@acme.com',
  to: [
    'alice@example.com',
    'bob@example.com',
    'carol@example.com',
  ],
  subject: 'Our monthly update',
  html: '<h1>Hello!</h1><p>Here is what happened this month...</p>',
  type: 'campaign',   // key difference from transactional
});

console.log(result.batchId);    // shared batch ID
console.log(result.messageIds); // one messageId per recipient
\`\`\`

### Transactional vs. campaign

| | Transactional | Campaign |
| - | ------------- | -------- |
| Emails sent | 1 (all recipients in To) | 1 per recipient |
| Recipients see each other | Yes (in To header) | No |
| batchId returned | No | Yes |
| messageIds returned | No (single messageId) | Yes (one per recipient) |
| Best for | Notifications, receipts | Newsletters, outreach |

## Mail merge & personalization

Because each campaign email is rendered and sent individually, you can personalise the HTML body per recipient before calling \`client.send()\`.

Mailmark does not yet have a built-in template engine. Personalisation happens in your application code before you call the API.

\`\`\`javascript
import { Mailmark } from 'mailmark-sdk';

const client = new Mailmark('dm_live_your_api_key');

const recipients = [
  { email: 'alice@example.com', name: 'Alice' },
  { email: 'bob@example.com',   name: 'Bob' },
];

for (const { email, name } of recipients) {
  await client.send({
    from: 'hello@acme.com',
    to: email,
    subject: \`Hey \${name}, check this out\`,
    html: \`<p>Hi \${name},</p><p>We have something just for you!</p>\`,
    type: 'campaign',
  });
}
\`\`\`

For large lists, batch the sends and add a small delay between requests to avoid hitting rate limits.

## Scheduling & auto follow-ups

Use the \`scheduledAt\` field to schedule a campaign for a future time. Pass a Unix millisecond timestamp; the value must be in the future.

\`\`\`javascript
const ONE_HOUR = 60 * 60 * 1000;

await client.send({
  from: 'newsletter@acme.com',
  to: ['alice@example.com', 'bob@example.com'],
  subject: 'Scheduled newsletter',
  html: '<p>This was scheduled!</p>',
  type: 'campaign',
  scheduledAt: Date.now() + ONE_HOUR, // send in 1 hour
});
// status will be "scheduled" instead of "queued"
\`\`\`

Automatic follow-ups can be implemented by scheduling subsequent sends with increasing \`scheduledAt\` values, or with [Sequences](/docs/sequences), which stop automatically when a contact replies.

## Campaign analytics

Each campaign send returns a \`batchId\` and an array of \`messageIds\` (one per recipient). Navigate to Dashboard -> Campaigns and enter your \`batchId\` to see:

- Total recipients
- Delivery status per message (queued, sent, bounced)
- Open and click tracking (on supported plans)
- Bounce and complaint rates

Open and click tracking requires a tracking domain to be configured. This is available on the Pro plan and above.

Programmatic access to the same numbers: \`GET https://api.mailmark.dev/v1/campaign-stats\`.

## Next steps

- [API: Send Email](/docs/api#send-email) - full send endpoint reference with all options.
- [Mailboxes](/docs/mailboxes) - create the mailboxes you send campaigns from.
`,

  "/docs/byo-aws": `Deploy the same SES / S3 / Lambda / SNS resources Mailmark uses, but inside your own AWS account, via a CloudFormation Quick-Create stack. Keep full ownership of your email data.

## When to use BYO-AWS

For most users the default Mailmark infrastructure option is simpler and recommended: Mailmark operates the AWS resources for you and you pay only the Mailmark subscription. Pick BYO-AWS when you need one of:

- **Data residency** - raw inbound email objects live in your own S3 bucket, in the AWS region you choose.
- **Your own SES reputation** - you already have a warmed-up SES account with production access approved.
- **Regulatory / compliance** - mailbox contents must be stored in an account you control.
- **Consolidated billing** - you prefer SES and S3 costs on your existing AWS bill.

You can mix and match: some domains on Mailmark infrastructure, others on BYO-AWS. The choice is per-domain.

## What gets provisioned

The CloudFormation stack creates the following resources in your AWS account:

- **SES configuration set** plus identity registration for your domain.
- **S3 bucket** for inbound email storage. Objects remain in your account.
- **Lambda forwarder** that picks up new S3 objects and POSTs them to the Mailmark inbound webhook, signed with a per-account shared secret.
- **SNS topics** for bounce, complaint, and delivery notifications, pointing to the Mailmark sending webhook.
- **IAM role** trusted by Mailmark's AWS account, with an \`ExternalId\` condition. Mailmark uses this role (via \`STS.AssumeRole\`) whenever it needs to call SES or S3 on your behalf.

The \`ExternalId\` is generated per Mailmark account and baked into the trust policy. It prevents the confused deputy problem: even if someone else learned your role ARN, they could not assume it without the ExternalId.

## Step-by-step setup

Two entry points to the connect wizard:

- Dashboard -> Domains -> Add domain -> Use my own AWS account -> Connect a new AWS account, or
- Dashboard -> Settings -> Connect AWS account.

The wizard has three steps:

1. **Alias & region.** Pick a friendly name for the account (e.g. Production) and the AWS region to provision in (e.g. \`us-east-1\`).
2. **Deploy the CloudFormation stack.** Click Open CloudFormation in AWS. The Quick-Create URL pre-fills every parameter: \`ExternalId\`, \`MailmarkAwsAccountId\`, \`WebhookSecret\`, \`InboundWebhookUrl\`, and \`SendingWebhookUrl\`. Sign in with the AWS account you want to use, review the parameters, acknowledge the IAM capabilities checkbox, and click Create stack.
3. **Paste the outputs.** When the stack status turns \`CREATE_COMPLETE\`, open the Outputs tab and copy \`RoleArn\` and \`BucketName\` into the Mailmark wizard, then click Verify.

On Verify, Mailmark calls \`STS.AssumeRole\` with your RoleArn and ExternalId, confirms identity with \`STS.GetCallerIdentity\`, and probes \`SES.GetAccount\` to detect whether your SES account is still in the sandbox. On success the account status flips to Verified and it becomes selectable when adding domains.

## Ongoing behavior

**SES sandbox.** Fresh AWS accounts start with SES in sandbox mode, which only allows sending to verified recipients. If Mailmark detects the sandbox, a SES sandbox badge is shown next to the account. Request production access in the AWS console to remove it.

**Multiple domains, one AWS account.** A connected AWS account can host any number of Mailmark domains. The Settings page lists every linked domain per account.

**Re-verification.** Mailmark caches the verification result. If you rotate the IAM role, delete and recreate the stack, or change the \`ExternalId\`, the next operation requiring AssumeRole fails and the account status flips to Failed with the AWS error message shown inline.

## Disconnecting an AWS account

Go to Dashboard -> Settings, find the account card, and click Disconnect -> Confirm disconnect.

Disconnect is blocked while any domain is still linked to the account. The Settings card lists the offending domains: delete them in Mailmark first (Dashboard -> Domains -> [domain] -> Delete), then retry.

Disconnecting only removes the link between Mailmark and your AWS account. The CloudFormation stack in your AWS account is not deleted by Mailmark. To free the resources, delete the stack yourself in the AWS console.

## Troubleshooting

**"AssumeRole failed" / "Could not assume role"**

- The role's trust policy does not allow Mailmark's AWS account as principal. Check that the \`MailmarkAwsAccountId\` stack parameter matches the value shown in the wizard.
- The \`ExternalId\` on the stack differs from the one Mailmark issued. Recreate the stack with the exact \`ExternalId\` from the wizard, or re-run the wizard for a fresh one.
- You pasted a different role's ARN. The wizard expects the role ARN listed under the stack's Outputs tab.

**"TemplateURL must be a supported URL" when clicking Open CloudFormation in AWS**

An operator-side configuration error: the Mailmark deployment is missing \`MAILMARK_CFN_TEMPLATE_URL\`, or it points to a non-S3 URL. CloudFormation only accepts template URLs hosted on S3. If you self-host Mailmark, upload \`public/infra/byo-aws-cfn.yml\` to a public-readable S3 object and set \`MAILMARK_CFN_TEMPLATE_URL\` to that URL in Convex. Otherwise contact Mailmark support.

**SES sandbox badge keeps showing after production access is granted**

Mailmark rechecks \`SES.GetAccount\` on the next verification. Reconnect from Settings, or wait for the next scheduled re-check.

## Next steps

- [Domain Setup](/docs/domain-setup) - DNS records are identical for Mailmark-hosted and BYO-AWS domains.
- [Troubleshooting](/docs/troubleshooting) - general fixes for domain verification and delivery issues.
`,

  "/docs/warmup": `Gradually build your mailbox's sending reputation so your emails reliably reach the inbox instead of spam.

## What is email warmup?

When a mailbox is brand new, email providers have no reputation data for it. Sending a large volume of emails from a cold mailbox triggers spam filters, causing your messages to land in junk folders or get blocked entirely.

Warmup fixes this by automatically exchanging real emails between your mailbox and Mailmark's network of platform accounts. These exchanges simulate genuine human email activity: messages are sent, opened, sometimes replied to, and rescued from spam folders. Over several weeks your domain accumulates positive engagement signals that inbox providers use to establish trust.

A warmup run lasts 30 days. On day 30 the mailbox is marked complete and stops sending warmup email. Reputation is not permanent: it fades when a mailbox goes quiet, so keep sending real mail from it afterwards, and start warmup again if the mailbox sits idle or its deliverability slips.

Warmup runs fully in the background. The Warming page in your dashboard shows live progress, health scores, and recent activity.

## Requirements

Before you can start warmup, the following must be true for the mailbox's domain:

- **SPF verified** - your SPF record authorises Mailmark's sending servers.
- **DKIM verified** - your domain's DKIM keys are published and confirmed by AWS SES.
- **DMARC verified** - a DMARC policy exists for your domain.

All three DNS records must show Verified on the Domains page before the Start Warmup button becomes active. See [Domain Setup](/docs/domain-setup#spf-dkim) if any records are pending.

## Speed plans

Choose a speed when you start warmup. Slower speeds are safer for domains that need to maintain a pristine reputation; faster speeds suit new domains where you need to reach sending volume sooner.

| Speed | Days 1-3 | Days 4-7 | Days 8-14 | Days 15-21 | Day 22+ |
| ----- | -------- | -------- | --------- | ---------- | ------- |
| Slow | 2/day | 5/day | 10/day | 15/day | 20/day |
| Normal | 5/day | 10/day | 15/day | 20/day | 20/day |
| Fast | 10/day | 15/day | 20/day | 20/day | 20/day |

You can change speed at any time from the Warming dashboard. The daily limit adjusts immediately based on the new speed and the current warmup day.

Recommended: start with Normal for most new domains. Use Slow if you are migrating an existing domain with a reputation to protect. Use Fast only for brand-new domains where you need to start sending campaigns quickly.

## Health score

Your warmup health score (0-100%) is a composite of three signals measured across recent warmup emails:

- **Inbox placement (60% weight)** - what percentage of warmup emails landed in the inbox rather than spam.
- **Open rate (20% weight)** - how many warmup emails were opened by the platform accounts.
- **Reply rate (20% weight)** - how many warmup emails received a reply.

| Score | Status | What to do |
| ----- | ------ | ---------- |
| 80-100% | Healthy | Continue warmup at current or faster speed. |
| 50-79% | Warning | Pause real sending, check DNS records, consider slowing warmup speed. |
| 0-49% | Critical | Pause warmup, audit domain reputation, verify DNS is correct. |

The score updates daily as new warmup emails are processed. A freshly started mailbox begins at 100% and moves up or down based on real engagement.

Programmatic access: \`GET https://api.mailmark.dev/v1/warmup\`.

## Best practices

- **Do not send bulk campaigns during warmup.** Keep real outbound sending under 20 emails/day while warmup is active. Sudden volume spikes counteract the reputation you are building.
- **Keep DNS records intact.** Removing or changing SPF, DKIM, or DMARC records mid-warmup will hurt your score.
- **Let it finish naturally.** Pausing and resuming frequently resets momentum. A run finishes on its own at day 30.
- **Monitor the health score weekly.** A declining score early in warmup is a signal to investigate.
- **One mailbox at a time per domain.** Running several mailboxes through warmup on the same domain is fine, but if the health score drops across all of them, pause them all and investigate domain-level issues first.

## Next steps

- [Domain Setup](/docs/domain-setup) - verify SPF, DKIM, and DMARC before starting warmup.
- [Email Campaigns](/docs/email-campaigns) - start sending campaigns once warmup is complete.
`,

  "/docs/sequences": `Automate multi-step email follow-up campaigns that send the right message at the right time.

## What are sequences?

A sequence is an ordered list of email steps and time delays. Once a contact is enrolled, Mailmark sends each email step automatically, waiting the configured delay before moving on to the next one.

Common use cases:

- Cold outreach with automatic follow-ups if there is no reply
- Onboarding drips that guide new users through your product
- Re-engagement campaigns for inactive contacts
- Post-purchase follow-up and upsell flows

Unlike a one-off campaign, sequences are contact-centric: each enrolled contact progresses through the steps at their own pace. If a contact replies, the enrollment is marked as replied and no further steps are sent.

## Creating a sequence

Sequences are created from the Mailbox view. Open any mailbox, navigate to the Sequences tab, and click New Sequence.

A sequence is built from two types of steps:

| Type | Purpose | Required fields |
| ---- | ------- | --------------- |
| send_email | Send an email to the enrolled contact | subject, html body |
| delay | Wait before running the next step | delayMs (milliseconds) |

The first step of every sequence must be a \`send_email\` step. You cannot start a sequence with a delay.

Example sequence structure:

\`\`\`text
Step 1: send_email  -- Initial outreach (sent immediately on enrollment)
Step 2: delay       -- Wait 3 days  (3 * 24 * 60 * 60 * 1000 ms)
Step 3: send_email  -- First follow-up
Step 4: delay       -- Wait 5 days
Step 5: send_email  -- Second follow-up (final)
\`\`\`

You can add as many alternating send/delay steps as needed. There is no hard limit on sequence length.

## Enrolling contacts

After creating a sequence, enroll contacts one at a time or in bulk via CSV import from the Sequences tab. Via the API: \`POST https://api.mailmark.dev/v1/sequences/{id}/enroll\` (max 100 contacts per request).

Enrollment rules:

- A contact can only be enrolled in the same sequence once at a time. Enrolling a contact already in \`active\` status returns an error.
- A contact who previously completed or was cancelled from a sequence can be re-enrolled.
- Enrollment starts immediately: the first \`send_email\` step is scheduled as soon as the contact is enrolled.

Enrollment statuses:

| Status | Meaning |
| ------ | ------- |
| active | Contact is progressing through the sequence |
| completed | All steps have been sent successfully |
| replied | Contact replied to one of the sequence emails |
| cancelled | Manually removed from the sequence |
| bounced | An email step bounced; sequence stopped for this contact |

## Merge fields

Personalise sequence emails with contact-specific data by passing merge fields at enrollment time. Merge fields are arbitrary key-value pairs interpolated into the email subject and body when each step runs.

\`\`\`text
Subject: Hey {{firstName}}, quick question
Body:
<p>Hi {{firstName}},</p>
<p>I noticed {{company}} recently expanded into {{market}}.</p>
<p>We help companies like yours with email deliverability...</p>
\`\`\`

Supply the values when enrolling the contact. Any key used in the template must be present in the merge fields object, otherwise the placeholder is left as-is.

\`\`\`json
{
  "contactEmail": "alice@acme.com",
  "mergeFields": {
    "firstName": "Alice",
    "company": "Acme Corp",
    "market": "Southeast Asia"
  }
}
\`\`\`

Merge fields are stored per enrollment and applied at the time each step runs, so every recipient of a bulk-enrolled sequence gets their own personalised version of the email.

## Managing sequences

| Status | Effect |
| ------ | ------ |
| active | New contacts can be enrolled; scheduled steps continue to send. |
| paused | No new steps are sent. Existing scheduled jobs are held until resumed. |
| completed | Sequence is archived. No new enrollments allowed. |

Pausing a sequence prevents pending steps from firing. When you resume, scheduled steps continue from where they left off; contacts do not restart from the beginning.

Marking a sequence as completed immediately cancels all active enrollments. This cannot be undone.

Step content (subject, body) can be edited while a sequence is active. Changes apply to future step runs only. Pausing the sequence before significant edits is recommended.

## Next steps

- [Email Campaigns](/docs/email-campaigns) - send one-off bulk campaigns to a list of recipients.
- [API Reference](/docs/api) - integrate sequences and sending into your own application.
`,

  "/docs/troubleshooting": `Common issues and how to resolve them.

## Emails not sending

If an API call returns an error or emails never arrive, work through this checklist:

- **API key is valid and not revoked.** Go to Dashboard -> Developer and confirm the key is listed and not revoked. If you lost the key, revoke it and create a new one; keys are shown only once.
- **The sender address exists as a mailbox.** The \`from\` address must be a real mailbox on the domain the API key is scoped to. Check Dashboard -> Mailboxes.
- **Domain is verified and active.** An unverified domain cannot send email. The domain status must be Active in Dashboard -> Domains.
- **API key is scoped to the correct domain.** Each domain-scoped API key is tied to exactly one domain. If the \`from\` address is on a different domain, the request is rejected with a 403.
- **scheduledAt is not in the past.** If you passed \`scheduledAt\`, it must be a future Unix millisecond timestamp.
- **Either html or text is provided.** The send endpoint requires at least one of \`html\` or \`text\`. An empty body returns 400.

A 401 Unauthorized means the API key is invalid or revoked. A 403 Forbidden means the sender address does not belong to the key's domain.

## Domain verification issues

- **DNS record not found.** After adding a TXT record, confirm it is visible with \`dig TXT yourdomain.com\` or MXToolbox. If it is not, check that you saved the record at your DNS provider.
- **Record added to the wrong subdomain.** The verification TXT record belongs on the root domain (\`@\`) unless Mailmark instructs otherwise.
- **Multiple conflicting SPF records.** A domain can only have one SPF TXT record. Merge them: \`v=spf1 include:amazonses.com include:other-provider.com ~all\`.
- **TTL caching delay.** DNS records are cached for their TTL. Wait for it to expire before re-verifying; a common TTL is 3600 seconds.
- **Domain registrar propagation.** Some registrars are slow. If dig shows the record but Mailmark still shows unverified, click Verify now again; Mailmark re-checks on demand.

## Bounces & rejections

A hard bounce means the recipient address does not exist or the server permanently rejected the email. A soft bounce is a temporary failure (mailbox full, server temporarily unavailable).

- **Check the recipient address.** The most common cause of bounces is a typo in the \`to\` field.
- **Your domain is not warmed up.** Start with small volumes and increase gradually, or use [warmup](/docs/warmup). A large blast from a brand-new domain triggers spam filters and rejections.
- **SPF or DKIM is not configured.** Receiving servers check both before accepting email. Verify your DNS setup in [Domain Setup](/docs/domain-setup#spf-dkim).
- **Recipient marked you as spam.** Their provider may automatically reject future sends. Remove unengaged recipients regularly.
- **Content triggers spam filters.** Avoid excessive caps, suspicious links, and spam trigger words. Test with the [spam score tester](/tools/spam-score-tester) before sending to a large list.

Repeated hard bounces damage your domain's sending reputation. Remove bounced addresses from your recipient lists immediately. Query them with \`GET https://api.mailmark.dev/v1/bounces\`.

## Still stuck?

Support typically responds within 2 hours on business days: [contact support](/contact).
`,
};
