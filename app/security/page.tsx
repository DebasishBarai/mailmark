import type { Metadata } from "next";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "Security - Mailmark",
  description:
    "How Mailmark protects your data and email infrastructure with enterprise-grade security practices.",
};

const practices = [
  {
    title: "Encryption in transit",
    description:
      "All data between your browser and Mailmark is encrypted using TLS 1.3. All email sent through our infrastructure uses STARTTLS and SMTP over TLS to encrypt messages in transit.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
  {
    title: "Encryption at rest",
    description:
      "All stored data - including email content, attachments, and account information - is encrypted at rest using AES-256. Database backups are also encrypted.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 8.485-7.5 11.25-7.5 11.25S5.25 14.86 5.25 6.375a7.5 7.5 0 1115 0z" />
      </svg>
    ),
  },
  {
    title: "Infrastructure",
    description:
      "Mailmark runs on AWS in multiple availability zones for high availability. We use AWS SES for email delivery, S3 for storage, and follow AWS security best practices including least-privilege IAM policies.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
      </svg>
    ),
  },
  {
    title: "Authentication & access control",
    description:
      "User authentication is managed by Clerk, a SOC 2 Type II certified identity provider. We support multi-factor authentication (MFA). Staff access to customer data is strictly limited on a need-to-know basis and logged.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: "Backup & recovery",
    description:
      "We take automated daily backups of all customer data with point-in-time recovery capability. Backups are stored in a separate AWS region and tested regularly.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 8.485-7.5 11.25-7.5 11.25S5.25 14.86 5.25 6.375a7.5 7.5 0 1115 0z" />
      </svg>
    ),
  },
  {
    title: "Monitoring & incident response",
    description:
      "We use 24/7 automated monitoring and alerting. Our incident response plan includes defined escalation paths, communication protocols, and post-incident reviews. Security incidents are disclosed to affected users within 72 hours.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    ),
  },
];

export default function SecurityPage() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-24 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-violet-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            Security
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Your data is safe with us
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-600 dark:text-gray-300">
            Security isn&apos;t a feature - it&apos;s the foundation. Here&apos;s
            how we protect your email infrastructure and data.
          </p>
        </div>
      </section>

      {/* Security practices */}
      <section className="bg-white px-6 py-16 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {practices.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border border-gray-100 p-6 transition-all hover:border-violet-200 hover:shadow-md dark:border-gray-700 dark:hover:border-violet-700"
              >
                <div className="inline-flex rounded-xl bg-violet-100 p-2.5 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
                  {p.icon}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Email security */}
      <section className="bg-gray-50 px-6 py-16 dark:bg-gray-800">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Email security standards</h2>
          <p className="mt-3 text-gray-600 dark:text-gray-300">
            Mailmark automatically configures your domain with the industry-standard email authentication suite:
          </p>
          <div className="mt-6 space-y-4">
            {[
              { name: "SPF", desc: "Specifies which mail servers are authorised to send email for your domain, reducing spoofing." },
              { name: "DKIM", desc: "Adds a cryptographic signature to every outgoing email, verifying it hasn't been tampered with." },
              { name: "DMARC", desc: "Tells receiving servers what to do when an email fails SPF or DKIM checks, and sends you forensic reports." },
              { name: "MTA-STS", desc: "Enforces TLS for all email sent to your domain, preventing downgrade attacks." },
            ].map((item) => (
              <div key={item.name} className="flex gap-4 rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                <span className="shrink-0 rounded-lg bg-violet-100 px-3 py-1 text-sm font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                  {item.name}
                </span>
                <p className="text-sm text-gray-600 dark:text-gray-300">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bug bounty / disclosure */}
      <section className="bg-white px-6 py-16 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Responsible disclosure</h2>
          <p className="mt-4 text-gray-600 dark:text-gray-300">
            We believe security researchers play an important role in keeping the internet
            safe. If you discover a vulnerability in Mailmark, please disclose it to us
            responsibly.
          </p>
          <div className="mt-6 rounded-2xl border border-violet-100 bg-violet-50 p-6 dark:border-violet-800 dark:bg-violet-900/20">
            <p className="font-semibold text-violet-900 dark:text-violet-200">Report a vulnerability</p>
            <p className="mt-2 text-sm text-violet-800 dark:text-violet-300">
              Email: <a href="mailto:security@mailmark.dev" className="font-medium underline">security@mailmark.dev</a>
            </p>
            <p className="mt-1 text-sm text-violet-800 dark:text-violet-300">
              Please include: a description of the vulnerability, steps to reproduce, potential impact, and your contact details.
            </p>
            <p className="mt-3 text-sm text-violet-700 dark:text-violet-400">
              We will acknowledge your report within 48 hours, investigate promptly, and notify you when the issue is resolved. We do not take legal action against researchers who report vulnerabilities in good faith.
            </p>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="bg-gray-50 px-6 py-16 dark:bg-gray-800">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Security questions?</h2>
          <p className="mt-3 text-gray-600 dark:text-gray-300">
            For any security-related questions, contact our security team directly at{" "}
            <a href="mailto:security@mailmark.dev" className="font-medium text-violet-600 hover:underline dark:text-violet-400">
              security@mailmark.dev
            </a>
            .
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
