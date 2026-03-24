import type { Metadata } from "next";
import Link from "next/link";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

export const metadata: Metadata = {
  title: "Email Campaigns - Mailmark Docs",
  description: "Create, personalise, schedule, and analyse bulk email campaigns with Mailmark.",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-gray-100 py-12 dark:border-gray-800">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        {children}
      </div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-gray-900 px-5 py-4 text-sm text-gray-100 dark:bg-gray-950">
      <code>{children}</code>
    </pre>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
      {children}
    </div>
  );
}

const NAV = [
  { id: "creating-campaign", label: "Creating a campaign" },
  { id: "mail-merge", label: "Mail merge & personalization" },
  { id: "scheduling", label: "Scheduling & auto follow-ups" },
  { id: "analytics", label: "Campaign analytics" },
];

export default function EmailCampaignsPage() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <Header />

      <div className="mx-auto max-w-7xl px-6 py-12 lg:flex lg:gap-12">
        {/* Sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-24 space-y-1">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">On this page</p>
            {NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-violet-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-violet-400"
              >
                {item.label}
              </a>
            ))}
          </div>
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <nav className="mb-6 flex items-center gap-2 text-sm text-gray-400">
            <Link href="/docs" className="hover:text-violet-600">Docs</Link>
            <span>/</span>
            <span className="text-gray-700 dark:text-gray-200">Email Campaigns</span>
          </nav>

          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Email Campaigns
          </h1>
          <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">
            Campaigns send individual, personalised emails to a list of recipients, all tracked under a shared batch ID.
          </p>

          <Section id="creating-campaign" title="Creating a campaign">
            <p>
              A <strong>campaign send</strong> (type: <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">&quot;campaign&quot;</code>) sends one individual email per recipient rather than a single email to all recipients together.
              Each send is tracked with a shared <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">batchId</code>.
            </p>

            <p className="font-semibold text-gray-900 dark:text-white">Via the API</p>
            <Code>{`import { Mailmark } from 'mailmark-sdk';

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
  type: 'campaign',   // ← key difference from transactional
});

console.log(result.batchId);    // shared batch ID
console.log(result.messageIds); // one messageId per recipient`}</Code>

            <p className="font-semibold text-gray-900 dark:text-white">Transactional vs. Campaign</p>
            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500"></th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Transactional</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Campaign</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {[
                    ["Emails sent", "1 (all recipients in To)", "1 per recipient"],
                    ["Recipients see each other", "Yes (in To header)", "No"],
                    ["batchId returned", "No", "Yes"],
                    ["messageIds returned", "No (single messageId)", "Yes (one per recipient)"],
                    ["Best for", "Notifications, receipts", "Newsletters, outreach"],
                  ].map(([label, trans, camp]) => (
                    <tr key={label as string}>
                      <td className="px-4 py-2.5 text-xs font-semibold text-gray-700 dark:text-gray-300">{label}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400">{trans}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400">{camp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="mail-merge" title="Mail merge & personalization">
            <p>
              Because each campaign email is rendered and sent individually, you can personalise the HTML body per recipient before calling <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">client.send()</code>.
            </p>
            <p>
              Mailmark does not yet have a built-in template engine. Personalisation is done in your application code before you call the API.
              A simple pattern using a helper function:
            </p>
            <Code>{`import { Mailmark } from 'mailmark-sdk';

const client = new Mailmark('dm_live_your_api_key');

const recipients = [
  { email: 'alice@example.com', name: 'Alice' },
  { email: 'bob@example.com',   name: 'Bob' },
];

// Send one personalised email per recipient
for (const { email, name } of recipients) {
  await client.send({
    from: 'hello@acme.com',
    to: email,
    subject: \`Hey \${name}, check this out\`,
    html: \`<p>Hi \${name},</p><p>We have something just for you!</p>\`,
    type: 'campaign',
  });
}`}</Code>

            <InfoBox>
              For large lists, batch the sends and add a small delay between requests to avoid hitting rate limits.
            </InfoBox>
          </Section>

          <Section id="scheduling" title="Scheduling & auto follow-ups">
            <p>
              Use the <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">scheduledAt</code> field to schedule a campaign for a future time.
              Pass a Unix millisecond timestamp. The value must be in the future.
            </p>
            <Code>{`const ONE_HOUR = 60 * 60 * 1000;

await client.send({
  from: 'newsletter@acme.com',
  to: ['alice@example.com', 'bob@example.com'],
  subject: 'Scheduled newsletter',
  html: '<p>This was scheduled!</p>',
  type: 'campaign',
  scheduledAt: Date.now() + ONE_HOUR, // send in 1 hour
});

// status will be "scheduled" instead of "queued"`}</Code>

            <p className="font-semibold text-gray-900 dark:text-white">Auto follow-ups</p>
            <p>
              Automatic follow-up sequences can be implemented in your own application by scheduling subsequent sends with increasing <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">scheduledAt</code> values:
            </p>
            <Code>{`const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

// Initial email
await client.send({ ..., scheduledAt: now + DAY });

// Follow-up 3 days later
await client.send({
  ...,
  subject: 'Following up!',
  scheduledAt: now + 4 * DAY,
});`}</Code>
          </Section>

          <Section id="analytics" title="Campaign analytics">
            <p>
              Each campaign send returns a <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">batchId</code> and an array of <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">messageIds</code> (one per recipient).
              Use these to track delivery in the dashboard.
            </p>
            <p>
              Navigate to <strong>Dashboard → Campaigns</strong> and enter your <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">batchId</code> to see:
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Total recipients</li>
              <li>Delivery status per message (queued, sent, bounced)</li>
              <li>Open and click tracking (on supported plans)</li>
              <li>Bounce and complaint rates</li>
            </ul>
            <InfoBox>
              Open and click tracking requires a tracking domain to be configured. This is available on the Pro plan and above.
            </InfoBox>
          </Section>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {[
              { href: "/docs/api#send-email", title: "API: Send Email", desc: "Full send endpoint reference with all options." },
              { href: "/docs/mailboxes", title: "Mailboxes", desc: "Create the mailboxes you send campaigns from." },
            ].map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="rounded-xl border border-gray-100 p-5 transition hover:border-violet-200 hover:shadow-sm dark:border-gray-700 dark:hover:border-violet-700"
              >
                <p className="font-semibold text-gray-900 dark:text-white">{card.title} →</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{card.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
