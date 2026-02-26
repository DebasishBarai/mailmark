import type { Metadata } from "next";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "About - DevMail",
  description:
    "Learn about DevMail's mission to make professional email hosting and campaigns accessible to every business.",
};

const values = [
  {
    title: "Own your infrastructure",
    description:
      "We believe businesses should own their email infrastructure. Your domain, your data, your rules — no vendor lock-in.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    title: "Simplicity first",
    description:
      "DNS, SPF, DKIM — these shouldn't require a systems administrator to configure. We automate the hard parts so you can focus on communication.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    title: "Transparent pricing",
    description:
      "No per-seat fees that punish growth. No surprise overages. You always know exactly what you're paying for and why.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
  {
    title: "Built for teams",
    description:
      "Whether you're a solo founder or a 50-person team, DevMail scales with you. Shared inboxes, permissions, and collaboration baked in from day one.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
];

const stats = [
  { value: "10k+", label: "Mailboxes created" },
  { value: "500+", label: "Domains hosted" },
  { value: "2M+", label: "Emails sent" },
  { value: "99.9%", label: "Uptime SLA" },
];

export default function AboutPage() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-24 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-violet-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            About DevMail
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Email that&apos;s truly yours
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-600 dark:text-gray-300">
            We built DevMail because we were tired of paying three different
            services to host email, send campaigns, and manage our team&apos;s
            inboxes. There had to be a better way.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-gray-100 bg-white px-6 py-12 dark:border-gray-700 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl">
          <dl className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <dt className="text-3xl font-extrabold text-violet-600">{stat.value}</dt>
                <dd className="mt-1 text-sm text-gray-500 dark:text-gray-400">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Story */}
      <section className="bg-white px-6 py-20 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Our story</h2>
          <div className="mt-6 space-y-5 text-gray-600 leading-relaxed dark:text-gray-300">
            <p>
              DevMail started in 2024 when our founders — a team of engineers
              frustrated by fragmented email tooling — decided to build the
              platform they always wanted. They had used Google Workspace,
              Postmark, Mailchimp, and half a dozen other tools, patching them
              together with APIs and custom scripts just to send an email from
              their company domain.
            </p>
            <p>
              The insight was simple: every business needs three things — a
              professional email address (you@yourcompany.com), a way to read
              and send email, and a way to reach customers at scale. These
              should not require three subscriptions, three dashboards, and
              three support teams.
            </p>
            <p>
              We launched DevMail&apos;s public beta in late 2025. Today,
              thousands of startups, agencies, and small teams use DevMail to
              run their entire email operation from a single dashboard. We&apos;re
              just getting started.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-gray-50 px-6 py-20 dark:bg-gray-800">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              What we stand for
            </h2>
            <p className="mt-3 text-gray-600 dark:text-gray-300">
              Four principles that guide every decision we make.
            </p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            {values.map((v) => (
              <div
                key={v.title}
                className="rounded-2xl border border-gray-100 bg-white p-8 transition-all hover:border-violet-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:hover:border-violet-700"
              >
                <div className="inline-flex rounded-xl bg-violet-100 p-2.5 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
                  {v.icon}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white px-6 py-20 dark:bg-gray-900">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Want to join us?
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-300">
            We&apos;re a small, remote-first team building in public. Check out
            our open roles.
          </p>
          <a
            href="/careers"
            className="mt-6 inline-block rounded-full bg-violet-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition-colors hover:bg-violet-700 dark:shadow-violet-900/30"
          >
            View open positions
          </a>
        </div>
      </section>

      <Footer />
    </main>
  );
}
