import type { Metadata } from "next";
import Link from "next/link";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

export const metadata: Metadata = {
  title: "Domain Setup - Mailmark Docs",
  description: "Verify your domain and configure DNS records including MX, SPF, DKIM, and DMARC for Mailmark.",
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

function DnsRow({ type, name, value, ttl }: { type: string; name: string; value: string; ttl?: string }) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      <td className="py-2 pr-4 font-mono text-xs text-gray-900 dark:text-gray-100">{type}</td>
      <td className="py-2 pr-4 font-mono text-xs text-gray-600 dark:text-gray-300">{name}</td>
      <td className="py-2 pr-4 font-mono text-xs text-gray-600 dark:text-gray-300 break-all">{value}</td>
      <td className="py-2 font-mono text-xs text-gray-400">{ttl ?? "3600"}</td>
    </tr>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
      {children}
    </div>
  );
}

const NAV = [
  { id: "verifying-domain", label: "Verifying your domain" },
  { id: "mx-records", label: "Configuring MX records" },
  { id: "spf-dkim", label: "Setting up SPF & DKIM" },
  { id: "dmarc", label: "DMARC configuration" },
];

export default function DomainSetupPage() {
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
            <span className="text-gray-700 dark:text-gray-200">Domain Setup</span>
          </nav>

          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Domain Setup
          </h1>
          <p className="mt-3 text-lg text-gray-600 dark:text-gray-300">
            Configure DNS records to verify your domain and ensure reliable email delivery.
          </p>

          <Section id="verifying-domain" title="Verifying your domain">
            <p>
              Domain verification proves to Mailmark (and to the internet) that you control the domain you want to send from.
              Until your domain is verified you cannot create mailboxes or send email from it.
            </p>
            <div className="mt-4 space-y-3">
              <p><strong>1.</strong> In the dashboard go to <strong>Domains → Add domain</strong>.</p>
              <p><strong>2.</strong> Enter your root domain, e.g. <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">acme.com</code>.</p>
              <p><strong>3.</strong> Mailmark generates a unique TXT record. Add it to your DNS provider.</p>
              <p><strong>4.</strong> Click <strong>Verify now</strong>. Mailmark polls for the record automatically every few minutes.</p>
            </div>
            <InfoBox>
              DNS changes can take anywhere from a few seconds to 48 hours to propagate worldwide. Most providers update within 5-15 minutes.
            </InfoBox>
            <p>
              Once verified, the domain status changes to <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Active</span> and you can start creating mailboxes.
            </p>
          </Section>

          <Section id="mx-records" title="Configuring MX records">
            <p>
              MX (Mail Exchanger) records tell other mail servers where to deliver inbound email for your domain.
              Add these records at your DNS provider to receive email in Mailmark.
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Type</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Name</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Value</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 px-4 dark:divide-gray-800">
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-900 dark:text-gray-100">MX</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-300">@</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-300">inbound-smtp.us-east-1.amazonaws.com</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-gray-300">10</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <InfoBox>
              If you already have MX records pointing to another mail provider (e.g. Google Workspace), replacing them will redirect all incoming email to Mailmark. Only make this change if you intend Mailmark to be your primary mail host.
            </InfoBox>
          </Section>

          <Section id="spf-dkim" title="Setting up SPF & DKIM">
            <p>
              SPF and DKIM are email authentication standards that prove your emails genuinely come from your domain,
              reducing the chance they land in spam.
            </p>

            <p className="mt-6 font-semibold text-gray-900 dark:text-white">SPF (Sender Policy Framework)</p>
            <p>
              SPF lists the servers authorised to send email on behalf of your domain.
              Add the following TXT record:
            </p>
            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Type</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Name</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <DnsRow type="TXT" name="@" value="v=spf1 include:amazonses.com ~all" />
                </tbody>
              </table>
            </div>
            <InfoBox>
              If you already have an SPF record, append <code className="rounded bg-blue-100 px-1 dark:bg-blue-900/40">include:amazonses.com</code> to it rather than creating a second TXT record. A domain can only have one SPF record.
            </InfoBox>

            <p className="mt-6 font-semibold text-gray-900 dark:text-white">DKIM (DomainKeys Identified Mail)</p>
            <p>
              DKIM adds a cryptographic signature to outgoing emails. Mailmark generates a DKIM key pair for each domain.
              The public key is shown in the dashboard - add it as a CNAME or TXT record:
            </p>
            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Type</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Name</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <DnsRow type="CNAME" name="mailmark._domainkey" value="mailmark._domainkey.amazonses.com" />
                </tbody>
              </table>
            </div>
            <p>The exact record values are displayed in <strong>Dashboard → Domains → your domain → DNS records</strong>.</p>
          </Section>

          <Section id="dmarc" title="DMARC configuration">
            <p>
              DMARC (Domain-based Message Authentication, Reporting & Conformance) tells receiving servers what to do
              when an email fails SPF or DKIM checks, and where to send reports.
            </p>
            <p>Add this TXT record to get started with a monitoring-only policy (no emails are rejected):</p>
            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Type</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Name</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <DnsRow type="TXT" name="_dmarc" value="v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com" />
                </tbody>
              </table>
            </div>

            <p className="font-semibold text-gray-900 dark:text-white">DMARC policy values</p>
            <ul className="ml-4 list-disc space-y-1">
              <li><code className="rounded bg-gray-100 px-1 dark:bg-gray-800">p=none</code> - monitor only, no action taken on failures.</li>
              <li><code className="rounded bg-gray-100 px-1 dark:bg-gray-800">p=quarantine</code> - suspicious emails go to spam.</li>
              <li><code className="rounded bg-gray-100 px-1 dark:bg-gray-800">p=reject</code> - failed emails are rejected outright (strictest).</li>
            </ul>
            <p>
              Start with <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">p=none</code> to observe reports, then gradually move to <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">p=quarantine</code> and <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">p=reject</code> once you are confident all legitimate email passes authentication.
            </p>
          </Section>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {[
              { href: "/docs/mailboxes", title: "Mailboxes", desc: "Create mailboxes on your verified domain." },
              { href: "/docs/troubleshooting#domain-verification", title: "Troubleshooting", desc: "Domain verification not working? See common fixes." },
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
