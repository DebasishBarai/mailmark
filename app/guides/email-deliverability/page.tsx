import type { Metadata } from "next";
import Link from "next/link";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

export const metadata: Metadata = {
  title: "Email Deliverability Guide - Mailmark",
  description:
    "A comprehensive guide to improving your email deliverability covering authentication, sender reputation, list hygiene, and content best practices.",
};

const tips = [
  {
    title: "Authenticate your domain",
    items: [
      "Set up SPF, DKIM, and DMARC records (see our DNS Setup Guide).",
      "Use a custom domain. Never send campaigns from @gmail.com or @yahoo.com.",
      "Start with DMARC policy p=none, then graduate to p=quarantine as you gain confidence.",
    ],
  },
  {
    title: "Warm up your sending IP",
    items: [
      "Start with small volumes (50-100/day) and increase by 30-50% every 3-5 days.",
      "Send to your most engaged contacts first. High open rates signal good sender reputation.",
      "Avoid sending large one-off blasts. Consistent daily volume is better than spikes.",
    ],
  },
  {
    title: "Maintain list hygiene",
    items: [
      "Remove hard bounces immediately and soft bounces after 3-5 attempts.",
      "Remove contacts who haven't engaged in 90+ days or run a re-engagement campaign first.",
      "Never purchase email lists. They contain spam traps and dramatically hurt deliverability.",
      "Use double opt-in for new subscribers.",
    ],
  },
  {
    title: "Write better email content",
    items: [
      "Avoid spam trigger words like 'FREE!!!', 'Act now', 'Guaranteed', 'No risk'.",
      "Maintain a healthy text-to-image ratio (more text than images).",
      "Always include a plain-text version of your email.",
      "Use a clear, recognisable sender name and reply-to address.",
    ],
  },
  {
    title: "Monitor your metrics",
    items: [
      "Keep open rate above 20% and click rate above 2%. Lower rates signal disengagement.",
      "Keep bounce rate below 2% and spam complaint rate below 0.1%.",
      "Monitor your domain's reputation with Google Postmaster Tools and Senderscore.org.",
      "Set up bounce and complaint webhook handlers to act on events in real time.",
    ],
  },
  {
    title: "Send at the right time",
    items: [
      "Tuesday to Thursday, 9 to 11 am recipient local time consistently outperform other windows.",
      "Avoid major holidays and Fridays for B2B audiences.",
      "Test send times with A/B splits and let data guide your decisions.",
    ],
  },
];

const metrics = [
  { label: "Open rate", target: "> 20%", color: "emerald" },
  { label: "Click rate", target: "> 2%", color: "violet" },
  { label: "Bounce rate", target: "< 2%", color: "amber" },
  { label: "Spam complaint rate", target: "< 0.1%", color: "red" },
  { label: "Unsubscribe rate", target: "< 0.5%", color: "blue" },
];

const colorMap: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700",
  violet: "bg-violet-100 text-violet-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
};

export default function EmailDeliverabilityPage() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-20 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400">
            <Link href="/docs" className="hover:underline">Documentation</Link>
            <span>/</span>
            <span className="text-gray-500 dark:text-gray-400">Email Deliverability</span>
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Email Deliverability Guide
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            Reaching the inbox is only half the battle. Learn how to build and
            maintain strong sender reputation so your emails land where they
            belong: in the inbox, not spam.
          </p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-violet-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              12 min read
            </span>
            <span>Updated Jan 2026</span>
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-12 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl">

          {/* Intro */}
          <p className="text-gray-600 leading-relaxed dark:text-gray-300">
            Email deliverability refers to the ability of your emails to reach
            subscribers&apos; inboxes. Major factors include domain authentication,
            sender reputation, email content, and list quality. Neglecting any
            one of these can result in emails being routed to spam or blocked
            entirely.
          </p>

          {/* Healthy metrics */}
          <div className="mt-10 rounded-2xl border border-gray-100 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white">Healthy benchmarks</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Aim to stay within these ranges for your industry:
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {metrics.map((m) => (
                <div key={m.label} className={`rounded-xl px-4 py-2 ${colorMap[m.color]}`}>
                  <p className="text-xs font-semibold">{m.label}</p>
                  <p className="text-base font-bold">{m.target}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tips sections */}
          <div className="mt-12 space-y-12">
            {tips.map((tip, i) => (
              <div key={tip.title}>
                <h2 className="flex items-center gap-3 text-xl font-bold text-gray-900 dark:text-white">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                    {i + 1}
                  </span>
                  {tip.title}
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {tip.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-gray-600 dark:text-gray-300">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span className="text-sm leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-14 rounded-2xl border border-violet-100 bg-violet-50 p-6 dark:border-violet-800 dark:bg-violet-900/20">
            <h3 className="font-semibold text-violet-900 dark:text-violet-200">Quick summary</h3>
            <p className="mt-2 text-sm leading-relaxed text-violet-800 dark:text-violet-300">
              Great deliverability comes down to three things: <strong>proving you are
              who you say you are</strong> (authentication), <strong>earning trust over time</strong>{" "}
              (sender reputation), and <strong>respecting your recipients</strong> (list hygiene
              and content quality). Mailmark handles the technical infrastructure. The
              rest is up to you.
            </p>
          </div>

          {/* Next steps */}
          <div className="mt-12 border-t border-gray-100 pt-10 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Related guides</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Link href="/guides/dns-setup" className="flex items-center justify-between rounded-xl border border-gray-100 p-4 transition-all hover:border-violet-200 hover:shadow-sm dark:border-gray-700 dark:hover:border-violet-700">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">DNS Setup Guide</span>
                <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
              <Link href="/docs" className="flex items-center justify-between rounded-xl border border-gray-100 p-4 transition-all hover:border-violet-200 hover:shadow-sm dark:border-gray-700 dark:hover:border-violet-700">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Campaign best practices</span>
                <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
