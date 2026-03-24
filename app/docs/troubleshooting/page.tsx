import type { Metadata } from "next";
import Link from "next/link";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

export const metadata: Metadata = {
  title: "Troubleshooting - Mailmark Docs",
  description: "Fix common Mailmark issues - emails not sending, domain verification failures, bounces, and rejections.",
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

function CheckItem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <svg className="mt-0.5 h-5 w-5 shrink-0 text-violet-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div>
        <p className="font-semibold text-gray-900 dark:text-white">{title}</p>
        <p className="mt-0.5 text-gray-600 dark:text-gray-300">{children}</p>
      </div>
    </div>
  );
}

function WarnBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
      {children}
    </div>
  );
}

const NAV = [
  { id: "emails-not-sending", label: "Emails not sending" },
  { id: "domain-verification", label: "Domain verification issues" },
  { id: "bounces", label: "Bounces & rejections" },
];

export default function TroubleshootingPage() {
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
            <span className="text-gray-700 dark:text-gray-200">Troubleshooting</span>
          </nav>

          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Troubleshooting
          </h1>
          <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">
            Common issues and how to resolve them.
          </p>

          <Section id="emails-not-sending" title="Emails not sending">
            <p>If an API call returns an error or emails never arrive, work through this checklist:</p>

            <div className="mt-4 space-y-5">
              <CheckItem title="API key is valid and not revoked">
                Go to <strong>Dashboard → Developer</strong> and confirm the key is listed and not revoked. If you&apos;ve lost the key, revoke it and create a new one - keys are shown only once.
              </CheckItem>
              <CheckItem title="The sender address exists as a mailbox">
                The <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">from</code> address must be a real mailbox on the domain the API key is scoped to.
                You cannot send from <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">random@example.com</code> unless that mailbox exists.
                Check <strong>Dashboard → Mailboxes</strong>.
              </CheckItem>
              <CheckItem title="Domain is verified and active">
                An unverified domain cannot send email. The domain status must be <strong>Active</strong> in <strong>Dashboard → Domains</strong>.
              </CheckItem>
              <CheckItem title="API key is scoped to the correct domain">
                Each API key is tied to exactly one domain. If the <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">from</code> address is on a different domain than the key&apos;s domain, the request will be rejected with a 403.
              </CheckItem>
              <CheckItem title="scheduledAt is not in the past">
                If you passed a <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">scheduledAt</code> value, make sure it is a future Unix millisecond timestamp. A value in the past will return a validation error.
              </CheckItem>
              <CheckItem title="Either html or text is provided">
                The send endpoint requires at least one of <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">html</code> or <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">text</code> in the request body. Sending an empty body will return 400.
              </CheckItem>
            </div>

            <WarnBox>
              If you receive a <strong>401 Unauthorized</strong>, your API key is invalid or has been revoked. A <strong>403 Forbidden</strong> means the sender address does not belong to the key&apos;s domain.
            </WarnBox>
          </Section>

          <Section id="domain-verification" title="Domain verification issues">
            <div className="space-y-5">
              <CheckItem title="DNS record not found">
                After adding a TXT record, use a DNS lookup tool (e.g. <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">dig TXT yourdomain.com</code> or MXToolbox) to confirm the record is visible. If it isn&apos;t, double-check you saved the record at your DNS provider.
              </CheckItem>
              <CheckItem title="Record added to the wrong subdomain">
                The verification TXT record should be added to the root domain (<code className="rounded bg-gray-100 px-1 dark:bg-gray-800">@</code>), not to a subdomain unless Mailmark specifically instructs otherwise.
              </CheckItem>
              <CheckItem title="Multiple conflicting SPF records">
                A domain can only have one SPF TXT record. If you have two records starting with <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">v=spf1</code>, merge them into one. For example:
                <br />
                <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">v=spf1 include:amazonses.com include:other-provider.com ~all</code>
              </CheckItem>
              <CheckItem title="TTL caching delay">
                DNS records are cached by your TTL (time-to-live) value. If you recently added or changed a record, wait for the TTL to expire before re-verifying. A common TTL is 3600 seconds (1 hour).
              </CheckItem>
              <CheckItem title="Domain registrar propagation">
                Some registrars take longer to propagate changes. If dig shows the record but Mailmark still shows unverified, click <strong>Verify now</strong> again - Mailmark re-checks on demand.
              </CheckItem>
            </div>
          </Section>

          <Section id="bounces" title="Bounces & rejections">
            <p>
              A <strong>hard bounce</strong> means the recipient address does not exist or the server permanently rejected the email.
              A <strong>soft bounce</strong> is a temporary failure (mailbox full, server temporarily unavailable).
            </p>

            <div className="mt-4 space-y-5">
              <CheckItem title="Check the recipient address">
                The most common cause of bounces is a typo in the recipient address. Double-check the <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">to</code> field.
              </CheckItem>
              <CheckItem title="Your domain is not warmed up">
                New domains and IP addresses need to be &quot;warmed up&quot; - start with small send volumes and gradually increase over days. Sending a large blast from a brand-new domain will trigger spam filters and rejections.
              </CheckItem>
              <CheckItem title="SPF or DKIM is not configured">
                Receiving servers check SPF and DKIM before accepting email. If either is missing or misconfigured, mail may be silently rejected or sent to spam. Verify your DNS setup in <Link href="/docs/domain-setup#spf-dkim" className="text-violet-600 hover:underline">Domain Setup → SPF & DKIM</Link>.
              </CheckItem>
              <CheckItem title="Recipient marked you as spam">
                If a recipient previously marked email from your domain as spam, their provider may automatically reject future sends. Remove unengaged recipients from your lists regularly.
              </CheckItem>
              <CheckItem title="Content triggers spam filters">
                Avoid excessive caps, suspicious links, or spam trigger words in subject lines and body content. Test your email content with a spam-checking tool (e.g. Mail-Tester) before sending to a large list.
              </CheckItem>
            </div>

            <WarnBox>
              Repeated hard bounces can negatively impact your domain&apos;s sending reputation. Remove bounced addresses from your recipient lists immediately.
            </WarnBox>
          </Section>

          {/* Contact */}
          <div className="mt-12 rounded-2xl border border-gray-100 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Still stuck?</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Our support team typically responds within 2 hours on business days.
            </p>
            <Link
              href="/contact"
              className="mt-5 inline-block rounded-full bg-violet-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700 dark:shadow-violet-900/30"
            >
              Contact support
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
