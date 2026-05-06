import type { Metadata } from "next";
import Link from "next/link";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

export const metadata: Metadata = {
  title: "Sequences",
  description:
    "Automate multi-step email follow-up sequences in Mailmark. Learn how to create sequences, enroll contacts, personalise with merge fields, and manage sequence status.",
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
  { id: "what-are-sequences", label: "What are sequences?" },
  { id: "creating-sequences", label: "Creating a sequence" },
  { id: "adding-contacts", label: "Enrolling contacts" },
  { id: "merge-fields", label: "Merge fields" },
  { id: "managing-sequences", label: "Managing sequences" },
];

export default function SequencesDocsPage() {
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
            <span className="text-gray-700 dark:text-gray-200">Sequences</span>
          </nav>

          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Sequences
          </h1>
          <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">
            Automate multi-step email follow-up campaigns that send the right message at the right time -- without manual effort.
          </p>

          <Section id="what-are-sequences" title="What are sequences?">
            <p>
              A <strong className="text-gray-900 dark:text-white">sequence</strong> is an ordered list of email steps and
              time delays. Once a contact is enrolled, Mailmark sends each email step automatically, waiting the configured
              delay before moving on to the next one.
            </p>
            <p>Common use cases include:</p>
            <ul className="ml-4 list-disc space-y-1">
              <li>Cold outreach with automatic follow-ups if there is no reply</li>
              <li>Onboarding drips that guide new users through your product</li>
              <li>Re-engagement campaigns for inactive contacts</li>
              <li>Post-purchase follow-up and upsell flows</li>
            </ul>
            <p>
              Unlike a one-off campaign, sequences are contact-centric: each enrolled contact progresses through the
              steps at their own pace. If a contact replies, the sequence can be marked as replied and no further
              steps are sent.
            </p>
          </Section>

          <Section id="creating-sequences" title="Creating a sequence">
            <p>
              Sequences are created from the <strong className="text-gray-900 dark:text-white">Mailbox</strong> view.
              Open any mailbox, navigate to the <strong>Sequences</strong> tab, and click <strong>New Sequence</strong>.
            </p>

            <p className="font-semibold text-gray-900 dark:text-white">Step types</p>
            <p>A sequence is built from two types of steps:</p>

            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                    <th className="px-4 py-2.5 font-semibold text-gray-500">Type</th>
                    <th className="px-4 py-2.5 font-semibold text-gray-500">Purpose</th>
                    <th className="px-4 py-2.5 font-semibold text-gray-500">Required fields</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  <tr>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-violet-600 dark:text-violet-400">send_email</td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">Send an email to the enrolled contact</td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">subject, html body</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-violet-600 dark:text-violet-400">delay</td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">Wait before running the next step</td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">delayMs (milliseconds)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <InfoBox>
              The first step of every sequence must be a <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">send_email</code> step.
              You cannot start a sequence with a delay.
            </InfoBox>

            <p className="font-semibold text-gray-900 dark:text-white">Example sequence structure</p>
            <Code>{`Step 1: send_email  -- Initial outreach (sent immediately on enrollment)
Step 2: delay       -- Wait 3 days  (3 * 24 * 60 * 60 * 1000 ms)
Step 3: send_email  -- First follow-up
Step 4: delay       -- Wait 5 days
Step 5: send_email  -- Second follow-up (final)`}</Code>

            <p>
              You can add as many alternating send/delay steps as needed. There is no hard limit on sequence length.
            </p>
          </Section>

          <Section id="adding-contacts" title="Enrolling contacts">
            <p>
              After creating a sequence, enroll contacts one at a time or in bulk via CSV import from the
              <strong className="text-gray-900 dark:text-white"> Sequences</strong> tab.
            </p>

            <p className="font-semibold text-gray-900 dark:text-white">Enrollment rules</p>
            <ul className="ml-4 list-disc space-y-2">
              <li>
                A contact can only be enrolled in the same sequence once at a time. Attempting to enroll
                a contact already in <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">active</code> status returns an error.
              </li>
              <li>
                A contact who previously completed or was cancelled from a sequence can be re-enrolled.
              </li>
              <li>
                Enrollment starts immediately -- the first <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">send_email</code> step
                is scheduled as soon as the contact is enrolled.
              </li>
            </ul>

            <p className="font-semibold text-gray-900 dark:text-white">Enrollment statuses</p>

            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                    <th className="px-4 py-2.5 font-semibold text-gray-500">Status</th>
                    <th className="px-4 py-2.5 font-semibold text-gray-500">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {[
                    ["active", "Contact is progressing through the sequence"],
                    ["completed", "All steps have been sent successfully"],
                    ["replied", "Contact replied to one of the sequence emails"],
                    ["cancelled", "Manually removed from the sequence"],
                    ["bounced", "An email step bounced; sequence stopped for this contact"],
                  ].map(([status, desc]) => (
                    <tr key={status as string}>
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold text-violet-600 dark:text-violet-400">{status}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="merge-fields" title="Merge fields">
            <p>
              Personalise sequence emails with contact-specific data by passing <strong className="text-gray-900 dark:text-white">merge fields</strong> at
              enrollment time. Merge fields are arbitrary key-value pairs that get interpolated into the email subject
              and body when each step runs.
            </p>

            <p className="font-semibold text-gray-900 dark:text-white">Syntax</p>
            <p>
              Use double curly braces in your email subject or HTML body:
            </p>
            <Code>{`Subject: Hey {{firstName}}, quick question

Body:
<p>Hi {{firstName}},</p>
<p>I noticed {{company}} recently expanded into {{market}}.</p>
<p>We help companies like yours with email deliverability...</p>`}</Code>

            <p className="font-semibold text-gray-900 dark:text-white">Providing merge field values</p>
            <p>
              Supply the values when enrolling the contact. Any key used in the template must be present in the
              merge fields object, otherwise the placeholder is left as-is.
            </p>
            <Code>{`// Example enrollment with merge fields
{
  "contactEmail": "alice@acme.com",
  "mergeFields": {
    "firstName": "Alice",
    "company": "Acme Corp",
    "market": "Southeast Asia"
  }
}`}</Code>

            <InfoBox>
              Merge fields are stored per enrollment and are applied at the time each step runs, not at enrollment time.
              This means each recipient in a bulk-enrolled sequence gets their own personalised version of the email.
            </InfoBox>
          </Section>

          <Section id="managing-sequences" title="Managing sequences">
            <p className="font-semibold text-gray-900 dark:text-white">Sequence statuses</p>
            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                    <th className="px-4 py-2.5 font-semibold text-gray-500">Status</th>
                    <th className="px-4 py-2.5 font-semibold text-gray-500">Effect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {[
                    ["active", "New contacts can be enrolled; scheduled steps continue to send."],
                    ["paused", "No new steps are sent. Existing scheduled jobs are held until resumed."],
                    ["completed", "Sequence is archived. No new enrollments allowed."],
                  ].map(([status, effect]) => (
                    <tr key={status as string}>
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold text-violet-600 dark:text-violet-400">{status}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{effect}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="font-semibold text-gray-900 dark:text-white">Pausing and resuming</p>
            <p>
              Pausing a sequence prevents any pending steps from firing. When you resume, scheduled steps
              continue from where they left off -- contacts do not restart from the beginning.
            </p>

            <p className="font-semibold text-gray-900 dark:text-white">Completing a sequence</p>
            <p>
              Marking a sequence as <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">completed</code> immediately
              cancels all active enrollments. Use this when a campaign is permanently finished. This action
              cannot be undone.
            </p>

            <p className="font-semibold text-gray-900 dark:text-white">Editing steps</p>
            <p>
              Step content (subject, body) can be edited while a sequence is active. Changes apply to future
              step runs only -- emails that have already been sent are not affected. Pausing the sequence
              first is recommended before making significant edits.
            </p>
          </Section>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {[
              { href: "/docs/email-campaigns", title: "Email Campaigns", desc: "Send one-off bulk campaigns to a list of recipients." },
              { href: "/docs/api", title: "API Reference", desc: "Integrate sequences and sending into your own application." },
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
