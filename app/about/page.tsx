import type { Metadata } from "next";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about Mailmark's mission to make professional email hosting and campaigns accessible to every business.",
};

const values = [
  {
    title: "Own your infrastructure",
    description:
      "We believe businesses should own their email infrastructure. Your domain, your data, your rules. No vendor lock-in.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    title: "Simplicity first",
    description:
      "DNS, SPF, DKIM. These shouldn't require a systems administrator to configure. We automate the hard parts so you can focus on communication.",
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
      "Whether you're a solo founder or a 50-person team, Mailmark scales with you. Shared inboxes, permissions, and collaboration baked in from day one.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
];

const stats = [
  { value: "All-in-one", label: "Hosting, inbox & campaigns" },
  { value: "Custom domains", label: "you@yourcompany.com" },
  { value: "Open source", label: "Transparent & extensible" },
  { value: "Self-hostable", label: "Your data, your server" },
];

export default function AboutPage() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-24 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-violet-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            About Mailmark
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Email that&apos;s truly yours
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-600 dark:text-gray-300">
            Mailmark was built out of frustration with paying three different
            services to host email, send campaigns, and manage inboxes. There
            had to be a better way.
          </p>
        </div>
      </section>

      {/* Highlights */}
      <section className="border-y border-gray-100 bg-white px-6 py-12 dark:border-gray-700 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl">
          <dl className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <dt className="text-2xl font-extrabold text-violet-600">{stat.value}</dt>
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
              Mailmark started in 2024 as a solo project born out of
              frustration with fragmented email tooling. After juggling Google
              Workspace, Postmark, Mailchimp, and half a dozen other tools
              just to send an email from a custom domain, there had to be a
              better way.
            </p>
            <p>
              The insight was simple: every business needs three things. A
              professional email address (you@yourcompany.com), a way to read
              and send email, and a way to reach customers at scale. These
              should not require three subscriptions, three dashboards, and
              three support teams.
            </p>
            <p>
              Mailmark is still early and growing. It&apos;s an open-source,
              indie project focused on getting the fundamentals right before
              chasing scale. If you value transparency and simplicity,
              you&apos;re in the right place.
            </p>
          </div>
        </div>
      </section>

      {/* Founder */}
      <section className="bg-gray-50 px-6 py-20 dark:bg-gray-800">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Built by
          </h2>
          <div className="mt-8 flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-2xl font-bold text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
              DB
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Debasish Barai
              </h3>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Founder & Solo Developer</p>
              <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                Full-stack developer who got tired of paying for three separate
                services just to send email from a custom domain. Mailmark is
                the all-in-one platform he wished existed -- built with a focus
                on developer experience, deliverability, and transparent
                pricing.
              </p>
              <div className="mt-4 flex gap-3">
                <a
                  href="https://github.com/DebasishBarai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  GitHub
                </a>
                <a
                  href="https://x.com/AiDebasish"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  Twitter / X
                </a>
              </div>
            </div>
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
            Ready to try Mailmark?
          </h2>
          <p className="mt-3 text-gray-600 dark:text-gray-300">
            Set up your custom domain email in minutes. No credit card
            required to get started.
          </p>
          <a
            href="/dashboard"
            className="mt-6 inline-block rounded-full bg-violet-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition-colors hover:bg-violet-700 dark:shadow-violet-900/30"
          >
            Get started for free
          </a>
        </div>
      </section>

      <Footer />
    </main>
  );
}
