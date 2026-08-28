import type { Metadata } from "next";
import Link from "next/link";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

export const metadata: Metadata = {
  title: "Email Warmup",
  description:
    "Gradually build your domain's sending reputation with Mailmark's automated email warmup. Learn how warmup works, speed options, health scores, and best practices.",
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

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
      {children}
    </div>
  );
}

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50 px-5 py-4 text-sm text-violet-800 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-300">
      {children}
    </div>
  );
}

const NAV = [
  { id: "what-is-warmup", label: "What is warmup?" },
  { id: "requirements", label: "Requirements" },
  { id: "speed-plans", label: "Speed plans" },
  { id: "health-score", label: "Health score" },
  { id: "best-practices", label: "Best practices" },
];

export default function WarmupDocsPage() {
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
            <span className="text-gray-700 dark:text-gray-200">Email Warmup</span>
          </nav>

          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Email Warmup
          </h1>
          <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">
            Gradually build your mailbox&apos;s sending reputation so your emails reliably reach the inbox instead of spam.
          </p>

          <Section id="what-is-warmup" title="What is email warmup?">
            <p>
              When a mailbox is brand new, email providers have no reputation data for it. Sending a large volume of emails
              from a cold mailbox triggers spam filters, causing your messages to land in junk folders -- or get blocked entirely.
            </p>
            <p>
              <strong className="text-gray-900 dark:text-white">Warmup</strong> fixes this by automatically exchanging real
              emails between your mailbox and Mailmark&apos;s network of platform accounts. These exchanges simulate genuine
              human email activity: messages are sent, opened, sometimes replied to, and rescued from spam folders. Over
              several weeks your domain accumulates positive engagement signals that inbox providers use to establish trust.
            </p>
            <p>
              A warmup run lasts <strong className="text-gray-900 dark:text-white">30 days</strong>. On day 30 the mailbox is
              marked complete and stops sending warmup email. Reputation is not permanent: it fades when a mailbox goes
              quiet, so keep sending real mail from it afterwards, and start warmup again if the mailbox sits idle for a
              while or its deliverability slips.
            </p>
            <p>
              Warmup runs fully in the background -- you do not need to do anything once it is started. The Warming page in
              your dashboard shows live progress, health scores, and recent activity.
            </p>
          </Section>

          <Section id="requirements" title="Requirements">
            <p>Before you can start warmup, the following must be true for the mailbox&apos;s domain:</p>
            <ul className="ml-4 list-disc space-y-2">
              <li>
                <strong className="text-gray-900 dark:text-white">SPF verified</strong> -- your SPF record authorises Mailmark&apos;s sending servers.
              </li>
              <li>
                <strong className="text-gray-900 dark:text-white">DKIM verified</strong> -- your domain&apos;s DKIM keys are published and confirmed by AWS SES.
              </li>
              <li>
                <strong className="text-gray-900 dark:text-white">DMARC verified</strong> -- a DMARC policy exists for your domain.
              </li>
            </ul>
            <InfoBox>
              All three DNS records must show <strong>Verified</strong> on the Domains page before the Start Warmup button becomes active.
              See the <Link href="/docs/domain-setup#spf-dkim" className="underline hover:text-amber-900 dark:hover:text-amber-200">Domain Setup guide</Link> if any records are pending.
            </InfoBox>
          </Section>

          <Section id="speed-plans" title="Speed plans">
            <p>
              Choose a speed when you start warmup. Slower speeds are safer for domains that need to maintain a pristine
              reputation; faster speeds suit new domains where you need to reach sending volume sooner.
            </p>

            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                    <th className="px-4 py-2.5 font-semibold text-gray-500">Speed</th>
                    <th className="px-4 py-2.5 font-semibold text-gray-500">Days 1-3</th>
                    <th className="px-4 py-2.5 font-semibold text-gray-500">Days 4-7</th>
                    <th className="px-4 py-2.5 font-semibold text-gray-500">Days 8-14</th>
                    <th className="px-4 py-2.5 font-semibold text-gray-500">Days 15-21</th>
                    <th className="px-4 py-2.5 font-semibold text-gray-500">Day 22+</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {[
                    ["Slow", "2/day", "5/day", "10/day", "15/day", "20/day"],
                    ["Normal", "5/day", "10/day", "15/day", "20/day", "20/day"],
                    ["Fast", "10/day", "15/day", "20/day", "20/day", "20/day"],
                  ].map(([speed, ...days]) => (
                    <tr key={speed}>
                      <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{speed}</td>
                      {days.map((d, i) => (
                        <td key={i} className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{d}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p>
              You can change speed at any time from the Warming dashboard. The daily limit adjusts immediately based on
              the new speed and the current warmup day.
            </p>

            <TipBox>
              <strong>Recommended:</strong> Start with <strong>Normal</strong> for most new domains. Use <strong>Slow</strong> if you
              are migrating an existing domain with a reputation to protect. Use <strong>Fast</strong> only for brand-new domains
              where you need to start sending campaigns quickly.
            </TipBox>
          </Section>

          <Section id="health-score" title="Health score">
            <p>
              Your warmup health score (0-100%) is a composite of three signals measured across recent warmup emails:
            </p>
            <ul className="ml-4 list-disc space-y-2">
              <li>
                <strong className="text-gray-900 dark:text-white">Inbox placement (60% weight)</strong> -- what percentage of warmup emails landed in the inbox rather than spam.
              </li>
              <li>
                <strong className="text-gray-900 dark:text-white">Open rate (20% weight)</strong> -- how many warmup emails were opened by the platform accounts.
              </li>
              <li>
                <strong className="text-gray-900 dark:text-white">Reply rate (20% weight)</strong> -- how many warmup emails received a reply.
              </li>
            </ul>

            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                    <th className="px-4 py-2.5 font-semibold text-gray-500">Score</th>
                    <th className="px-4 py-2.5 font-semibold text-gray-500">Status</th>
                    <th className="px-4 py-2.5 font-semibold text-gray-500">What to do</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {[
                    ["80-100%", "Healthy", "Continue warmup at current or faster speed."],
                    ["50-79%", "Warning", "Pause real sending, check DNS records, consider slowing warmup speed."],
                    ["0-49%", "Critical", "Pause warmup, audit domain reputation, verify DNS is correct."],
                  ].map(([score, status, action]) => (
                    <tr key={score as string}>
                      <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{score}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{status}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p>
              The score updates daily as new warmup emails are processed. A freshly started mailbox begins at 100% and
              moves up or down based on real engagement.
            </p>
          </Section>

          <Section id="best-practices" title="Best practices">
            <ul className="ml-4 list-disc space-y-3">
              <li>
                <strong className="text-gray-900 dark:text-white">Do not send bulk campaigns during warmup.</strong> Keep real
                outbound sending minimal (under 20 emails/day) while warmup is active. Sudden volume spikes can
                counteract the reputation you are building.
              </li>
              <li>
                <strong className="text-gray-900 dark:text-white">Keep DNS records intact.</strong> Removing or changing SPF,
                DKIM, or DMARC records mid-warmup will hurt your score. Only modify DNS records if instructed to do
                so during troubleshooting.
              </li>
              <li>
                <strong className="text-gray-900 dark:text-white">Let it finish naturally.</strong> Pausing and resuming
                warmup frequently resets momentum. If you need to pause, keep it brief and resume as soon as possible.
                A run finishes on its own at day 30.
              </li>
              <li>
                <strong className="text-gray-900 dark:text-white">Monitor the health score weekly.</strong> A declining score
                early in warmup is a signal to investigate before it becomes a lasting reputation problem.
              </li>
              <li>
                <strong className="text-gray-900 dark:text-white">One mailbox at a time per domain.</strong> Running multiple
                mailboxes through warmup simultaneously on the same domain is fine, but if your health score drops
                across all of them, pause all warmup sessions and investigate domain-level issues first.
              </li>
            </ul>
          </Section>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {[
              { href: "/docs/domain-setup", title: "Domain Setup", desc: "Verify SPF, DKIM, and DMARC before starting warmup." },
              { href: "/docs/email-campaigns", title: "Email Campaigns", desc: "Start sending campaigns once warmup is complete." },
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
