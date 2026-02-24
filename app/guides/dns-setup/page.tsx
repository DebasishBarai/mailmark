import type { Metadata } from "next";
import Link from "next/link";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

export const metadata: Metadata = {
  title: "DNS Setup Guide - DevMail",
  description:
    "Step-by-step guide to setting up MX, SPF, DKIM, and DMARC DNS records for your domain in DevMail.",
};

export default function DnsSetupGuidePage() {
  return (
    <main>
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2 text-sm text-violet-600">
            <Link href="/docs" className="hover:underline">Documentation</Link>
            <span>/</span>
            <span className="text-gray-500">DNS Setup Guide</span>
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            DNS Setup Guide
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Configure your domain&apos;s DNS records to send and receive email
            with DevMail. This takes about 10 minutes, plus DNS propagation time
            (up to 48 hours).
          </p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-violet-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              15 min read
            </span>
            <span>Updated Jan 2026</span>
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-12">
        <div className="mx-auto max-w-3xl">

          {/* Prerequisites */}
          <div className="mb-12 rounded-2xl border border-amber-100 bg-amber-50 p-6">
            <h2 className="flex items-center gap-2 font-semibold text-amber-900">
              <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              Before you begin
            </h2>
            <ul className="mt-3 space-y-1.5 text-sm text-amber-800">
              <li>• You must own the domain you want to configure.</li>
              <li>• You need access to your domain registrar&apos;s DNS settings (e.g., Namecheap, Cloudflare, GoDaddy).</li>
              <li>• DevMail will show you the exact values to copy — you don&apos;t need to calculate anything.</li>
            </ul>
          </div>

          {/* Step 1 */}
          <div className="mb-10">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-gray-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">1</span>
              Add your domain in DevMail
            </h2>
            <p className="mt-4 text-gray-600">
              Go to <strong>Dashboard → Domains → Add domain</strong> and enter your domain name (e.g., <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm text-violet-700">yourcompany.com</code>). DevMail will generate the DNS records you need to add.
            </p>
          </div>

          {/* Step 2: MX */}
          <div className="mb-10">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-gray-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">2</span>
              Add MX records (incoming email)
            </h2>
            <p className="mt-4 text-gray-600">
              MX (Mail Exchanger) records tell the internet where to deliver email for your domain. Add these two records at your DNS provider:
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Host / Name</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">TTL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-4 py-3 font-mono text-violet-700">MX</td>
                    <td className="px-4 py-3 font-mono">@</td>
                    <td className="px-4 py-3 font-mono text-xs">inbound.devmail.app</td>
                    <td className="px-4 py-3">10</td>
                    <td className="px-4 py-3">3600</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-violet-700">MX</td>
                    <td className="px-4 py-3 font-mono">@</td>
                    <td className="px-4 py-3 font-mono text-xs">inbound-alt.devmail.app</td>
                    <td className="px-4 py-3">20</td>
                    <td className="px-4 py-3">3600</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Step 3: SPF */}
          <div className="mb-10">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-gray-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">3</span>
              Add SPF record (sender authentication)
            </h2>
            <p className="mt-4 text-gray-600">
              SPF (Sender Policy Framework) tells receiving servers which services are authorised to send email on behalf of your domain. Add this TXT record:
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Host / Name</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">TTL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-3 font-mono text-violet-700">TXT</td>
                    <td className="px-4 py-3 font-mono">@</td>
                    <td className="px-4 py-3 font-mono text-xs">v=spf1 include:spf.devmail.app ~all</td>
                    <td className="px-4 py-3">3600</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-gray-500">
              <strong>Note:</strong> If you already have an SPF record, add <code className="rounded bg-gray-100 px-1 text-violet-700">include:spf.devmail.app</code> to it rather than creating a second TXT record. Domains can only have one SPF record.
            </p>
          </div>

          {/* Step 4: DKIM */}
          <div className="mb-10">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-gray-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">4</span>
              Add DKIM record (email signing)
            </h2>
            <p className="mt-4 text-gray-600">
              DKIM (DomainKeys Identified Mail) adds a cryptographic signature to your outgoing emails. DevMail generates a unique DKIM key for your domain — find it in <strong>Dashboard → Domains → [your domain] → DNS records</strong>.
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Host / Name</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">TTL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-3 font-mono text-violet-700">TXT</td>
                    <td className="px-4 py-3 font-mono text-xs">devmail._domainkey</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">v=DKIM1; k=rsa; p=&lt;your key from dashboard&gt;</td>
                    <td className="px-4 py-3">3600</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Step 5: DMARC */}
          <div className="mb-10">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-gray-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600">5</span>
              Add DMARC record (optional but recommended)
            </h2>
            <p className="mt-4 text-gray-600">
              DMARC (Domain-based Message Authentication) tells receiving servers what to do with emails that fail SPF or DKIM checks. Start with a monitoring-only policy:
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Host / Name</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">TTL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-3 font-mono text-violet-700">TXT</td>
                    <td className="px-4 py-3 font-mono">_dmarc</td>
                    <td className="px-4 py-3 font-mono text-xs">v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com</td>
                    <td className="px-4 py-3">3600</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Step 6: Verify */}
          <div className="mb-12">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-gray-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">6</span>
              Verify your domain
            </h2>
            <p className="mt-4 text-gray-600">
              Go back to <strong>Dashboard → Domains</strong> and click <strong>Verify domain</strong>. DevMail will check for all the records above. DNS changes typically propagate within minutes but can take up to 48 hours.
            </p>
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
              <p className="text-sm font-semibold text-emerald-800">
                ✓ Once verified, you&apos;re ready to create mailboxes and send email.
              </p>
            </div>
          </div>

          {/* Next steps */}
          <div className="border-t border-gray-100 pt-10">
            <h3 className="font-semibold text-gray-900">Next steps</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Link href="/docs" className="flex items-center justify-between rounded-xl border border-gray-100 p-4 transition-all hover:border-violet-200 hover:shadow-sm">
                <span className="text-sm font-medium text-gray-700">Create your first mailbox</span>
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
              <Link href="/guides/email-deliverability" className="flex items-center justify-between rounded-xl border border-gray-100 p-4 transition-all hover:border-violet-200 hover:shadow-sm">
                <span className="text-sm font-medium text-gray-700">Improve deliverability</span>
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
            </div>
          </div>

        </div>
      </section>

      <Footer />
    </main>
  );
}
