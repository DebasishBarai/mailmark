import type { Metadata } from "next";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "Documentation - Mailmark",
  description:
    "Everything you need to set up and use Mailmark, from adding your first domain to running advanced email campaigns.",
};

const sections = [
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "Getting Started",
    href: "/docs/getting-started",
    color: "violet",
    articles: [
      { label: "Quick-start guide", href: "/docs/getting-started#quick-start" },
      { label: "Creating your account", href: "/docs/getting-started#creating-account" },
      { label: "Adding your first domain", href: "/docs/getting-started#adding-domain" },
      { label: "Sending your first email", href: "/docs/getting-started#sending-email" },
    ],
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
    title: "Domain Setup",
    href: "/docs/domain-setup",
    color: "blue",
    articles: [
      { label: "Choose your infrastructure", href: "/docs/domain-setup#choose-infra" },
      { label: "Verifying your domain", href: "/docs/domain-setup#verifying-domain" },
      { label: "Configuring MX records", href: "/docs/domain-setup#mx-records" },
      { label: "Setting up SPF & DKIM", href: "/docs/domain-setup#spf-dkim" },
      { label: "DMARC configuration", href: "/docs/domain-setup#dmarc" },
    ],
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
      </svg>
    ),
    title: "Bring your own AWS",
    href: "/docs/byo-aws",
    color: "indigo",
    articles: [
      { label: "When to use BYO-AWS", href: "/docs/byo-aws#when-to-use" },
      { label: "What gets provisioned", href: "/docs/byo-aws#what-gets-provisioned" },
      { label: "Step-by-step setup", href: "/docs/byo-aws#connect" },
      { label: "Disconnecting", href: "/docs/byo-aws#disconnect" },
      { label: "Troubleshooting", href: "/docs/byo-aws#troubleshooting" },
    ],
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
    title: "Mailboxes",
    href: "/docs/mailboxes",
    color: "emerald",
    articles: [
      { label: "Creating mailboxes", href: "/docs/mailboxes#creating-mailboxes" },
      { label: "Managing aliases", href: "/docs/mailboxes#managing-aliases" },
      { label: "Team mailbox permissions", href: "/docs/mailboxes#permissions" },
      { label: "Connecting an email client (IMAP)", href: "/docs/mailboxes#imap" },
    ],
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.25V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18V8.25m-18 0V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6v2.25m-18 0h18M5.25 6h.008v.008H5.25V6zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM8.25 6h.008v.008H8.25V6zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM11.25 6h.008v.008h-.008V6zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
    title: "Email Campaigns",
    href: "/docs/email-campaigns",
    color: "amber",
    articles: [
      { label: "Creating a campaign", href: "/docs/email-campaigns#creating-campaign" },
      { label: "Mail merge & personalization", href: "/docs/email-campaigns#mail-merge" },
      { label: "Scheduling & auto follow-ups", href: "/docs/email-campaigns#scheduling" },
      { label: "Campaign analytics", href: "/docs/email-campaigns#analytics" },
    ],
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
    title: "API Reference",
    href: "/docs/api",
    color: "pink",
    articles: [
      { label: "Authentication & API keys", href: "/docs/api#authentication" },
      { label: "Send emails via API", href: "/docs/api#send-email" },
      { label: "Manage mailboxes via API", href: "/docs/api#list-mailboxes" },
    ],
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
    ),
    title: "Troubleshooting",
    href: "/docs/troubleshooting",
    color: "gray",
    articles: [
      { label: "Emails not sending", href: "/docs/troubleshooting#emails-not-sending" },
      { label: "Domain verification issues", href: "/docs/troubleshooting#domain-verification" },
      { label: "Bounces & rejections", href: "/docs/troubleshooting#bounces" },
    ],
  },
];

const colorMap: Record<string, string> = {
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400",
  blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  indigo: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  pink: "bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400",
  gray: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

const borderMap: Record<string, string> = {
  violet: "hover:border-violet-200 dark:hover:border-violet-700",
  blue: "hover:border-blue-200 dark:hover:border-blue-700",
  indigo: "hover:border-indigo-200 dark:hover:border-indigo-700",
  emerald: "hover:border-emerald-200 dark:hover:border-emerald-700",
  amber: "hover:border-amber-200 dark:hover:border-amber-700",
  pink: "hover:border-pink-200 dark:hover:border-pink-700",
  gray: "hover:border-gray-300 dark:hover:border-gray-600",
};

export default function DocsPage() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-20 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-violet-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            Documentation
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            How can we help?
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            Everything you need to set up domains, create mailboxes, and run
            email campaigns with Mailmark.
          </p>
          {/* Static search bar */}
          <div className="relative mx-auto mt-8 max-w-xl">
            <svg
              className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Search docs…"
              className="w-full rounded-full border border-gray-200 bg-white py-3 pl-12 pr-6 text-sm shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-violet-500 dark:focus:ring-violet-900/30"
            />
          </div>
        </div>
      </section>

      {/* Doc sections grid */}
      <section className="bg-white px-6 py-16 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((section) => (
              <div
                key={section.title}
                className={`rounded-2xl border border-gray-100 p-6 transition-all hover:shadow-md dark:border-gray-700 ${borderMap[section.color]}`}
              >
                <div className={`inline-flex rounded-xl p-2.5 ${colorMap[section.color]}`}>
                  {section.icon}
                </div>
                <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                  {section.title}
                </h2>
                <ul className="mt-3 space-y-2">
                  {section.articles.map((article) => (
                    <li key={article.href}>
                      <Link
                        href={article.href}
                        className="flex items-center text-sm text-gray-600 transition-colors hover:text-violet-600 dark:text-gray-300 dark:hover:text-violet-400"
                      >
                        <svg className="mr-2 h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                        {article.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  href={section.href}
                  className="mt-5 inline-flex items-center text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                >
                  View all articles →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Help CTA */}
      <section className="bg-gray-50 px-6 py-16 dark:bg-gray-800">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Can&apos;t find what you&apos;re looking for?
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-300">
            Our support team typically responds within 2 hours on business days.
          </p>
          <a
            href="/contact"
            className="mt-6 inline-block rounded-full bg-violet-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition-colors hover:bg-violet-700 dark:shadow-violet-900/30"
          >
            Contact support
          </a>
        </div>
      </section>

      <Footer />
    </main>
  );
}
