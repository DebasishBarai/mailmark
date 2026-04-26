"use client";

import { useState } from "react";
import Link from "next/link";

interface Provider {
  name: string;
  note: string;
  calculate: (volume: number) => number;
}

const providers: Record<string, Provider> = {
  mailchimp: {
    name: "Mailchimp",
    note: "Standard plan pricing, estimated by contact/email volume tiers.",
    calculate: (v) => {
      if (v <= 500) return 20;
      if (v <= 2500) return 34;
      if (v <= 5000) return 59;
      if (v <= 10000) return 87;
      if (v <= 25000) return 170;
      if (v <= 50000) return 299;
      if (v <= 100000) return 450;
      return 450 + Math.ceil((v - 100000) / 10000) * 40;
    },
  },
  sendgrid: {
    name: "SendGrid",
    note: "Essentials plan up to 100K, Pro plan above.",
    calculate: (v) => {
      if (v <= 5000) return 19.95;
      if (v <= 10000) return 19.95;
      if (v <= 25000) return 19.95;
      if (v <= 50000) return 19.95;
      if (v <= 100000) return 89.95;
      return 89.95 + Math.ceil((v - 100000) / 10000) * 10;
    },
  },
  instantly: {
    name: "Instantly",
    note: "Growth plan ($30/mo for 5K emails), Hypergrowth ($77.6/mo for 100K).",
    calculate: (v) => {
      if (v <= 5000) return 30;
      if (v <= 25000) return 77.6;
      if (v <= 100000) return 286.3;
      return 286.3 + Math.ceil((v - 100000) / 10000) * 25;
    },
  },
  lemlist: {
    name: "Lemlist",
    note: "Email Starter ($39/mo), Email Pro ($69/mo), Multichannel Expert ($99/mo).",
    calculate: (v) => {
      if (v <= 5000) return 39;
      if (v <= 15000) return 69;
      if (v <= 50000) return 99;
      if (v <= 100000) return 159;
      return 159 + Math.ceil((v - 100000) / 10000) * 15;
    },
  },
  mailgun: {
    name: "Mailgun",
    note: "Foundation plan ($35/mo for 50K), Scale plan ($90/mo for 100K).",
    calculate: (v) => {
      if (v <= 5000) return 35;
      if (v <= 50000) return 35;
      if (v <= 100000) return 90;
      return 90 + Math.ceil((v - 100000) / 10000) * 10;
    },
  },
  postmark: {
    name: "Postmark",
    note: "$15/mo for 10K emails, $1.50 per additional 1K.",
    calculate: (v) => {
      if (v <= 10000) return 15;
      return 15 + Math.ceil((v - 10000) / 1000) * 1.5;
    },
  },
  brevo: {
    name: "Brevo",
    note: "Starter ($9/mo for 5K), Business ($18/mo for 20K), scales by volume.",
    calculate: (v) => {
      if (v <= 5000) return 9;
      if (v <= 20000) return 18;
      if (v <= 40000) return 35;
      if (v <= 60000) return 49;
      if (v <= 100000) return 65;
      return 65 + Math.ceil((v - 100000) / 10000) * 7;
    },
  },
  ses_raw: {
    name: "Amazon SES (raw)",
    note: "$0.10 per 1,000 emails. Does not include dev/ops cost to build and maintain your own sending infrastructure.",
    calculate: (v) => v * 0.0001,
  },
};

const faqItems = [
  {
    q: "How much cheaper is AWS SES compared to Mailchimp or SendGrid?",
    a: "AWS SES charges $0.10 per 1,000 emails. At 50,000 emails per month that is $5 in sending costs versus roughly $299 on Mailchimp or $89.95 on SendGrid. Mailmark wraps SES in a complete platform — inbox warming, domain setup, analytics, and campaign tools — starting at $10/month, still a fraction of the cost of traditional providers.",
  },
  {
    q: "What is included in a Mailmark plan?",
    a: "Every Mailmark plan includes multi-domain management, 28-day inbox warming, automatic SPF/DKIM/DMARC setup, blacklist monitoring, open and click tracking, bounce suppression, a REST API, campaign analytics, and a built-in email client. You get a complete sending platform without managing AWS infrastructure yourself.",
  },
  {
    q: "Can I use AWS SES directly without Mailmark?",
    a: "Yes, you can use raw AWS SES at $0.10 per 1,000 emails. However, you would need to build and maintain your own infrastructure for authentication setup, bounce handling, suppression lists, campaign management, and deliverability monitoring. Mailmark provides all of that out of the box, saving significant engineering time.",
  },
  {
    q: "Are these cost estimates accurate?",
    a: "The estimates are based on publicly available pricing pages for each provider and are accurate as of April 2026. Actual costs can vary depending on your specific plan, billing region, add-ons, and usage patterns. Always verify current pricing directly with each provider before making a decision.",
  },
  {
    q: "How do I switch from my current email provider to Mailmark?",
    a: "Add your sending domain to Mailmark, update your DNS records (Mailmark generates them for you), and start sending. The process takes under 10 minutes for most setups. Mailmark also runs a 28-day inbox warming sequence on new domains to protect your sender reputation during the transition.",
  },
];

function getMailmarkPlan(volume: number): { name: string; price: number } {
  if (volume <= 1000) return { name: "Starter", price: 10 };
  if (volume <= 25000) return { name: "Pro", price: 50 };
  if (volume <= 100000) return { name: "Business", price: 100 };
  return {
    name: "Business+",
    price: 100 + Math.ceil((volume - 100000) / 1000) * 0.1,
  };
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

const volumeStops = [
  1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000,
];

export default function SavingsCalculator() {
  const [volumeIndex, setVolumeIndex] = useState(3);
  const [providerId, setProviderId] = useState("mailchimp");

  const volume = volumeStops[volumeIndex];
  const provider = providers[providerId];
  const currentCost = provider.calculate(volume);
  const mailmark = getMailmarkPlan(volume);
  const monthlySavings = currentCost - mailmark.price;
  const annualSavings = monthlySavings * 12;
  const savingsPercent =
    currentCost > 0 ? Math.round((monthlySavings / currentCost) * 100) : 0;
  const hasSavings = monthlySavings > 0;

  return (
    <>
      {/* Hero + Controls */}
      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-20 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400">
            <Link href="/tools" className="hover:underline">
              Tools
            </Link>
            <span>/</span>
            <span className="text-gray-500 dark:text-gray-400">
              SES Savings Calculator
            </span>
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Email Cost Calculator: Compare SendGrid, Mailchimp &amp; AWS SES Pricing
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            See how much you could save by switching to Mailmark, powered by AWS
            SES. Select your current provider and email volume to get an instant
            comparison.
          </p>

          {/* Controls */}
          <div className="mt-10 space-y-6">
            {/* Provider Select */}
            <div>
              <label
                htmlFor="provider"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Current email provider
              </label>
              <select
                id="provider"
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:ring-violet-900/30"
              >
                {Object.entries(providers).map(([id, p]) => (
                  <option key={id} value={id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Volume Slider */}
            <div>
              <label
                htmlFor="volume"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Monthly email volume
              </label>
              <p className="mt-1 text-3xl font-bold text-violet-600 dark:text-violet-400">
                {formatNumber(volume)} emails/mo
              </p>
              <input
                id="volume"
                type="range"
                min={0}
                max={volumeStops.length - 1}
                step={1}
                value={volumeIndex}
                onChange={(e) => setVolumeIndex(Number(e.target.value))}
                className="mt-3 w-full accent-violet-600"
              />
              <div className="mt-1 flex justify-between text-xs text-gray-400 dark:text-gray-500">
                <span>1K</span>
                <span>10K</span>
                <span>100K</span>
                <span>500K</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="bg-white px-6 py-16 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl">
          {/* Savings Banner */}
          {hasSavings ? (
            <div className="rounded-2xl bg-emerald-50 p-6 text-center dark:bg-emerald-900/20">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                You could save
              </p>
              <p className="mt-1 text-4xl font-extrabold text-emerald-700 dark:text-emerald-300">
                {formatCurrency(annualSavings)}/year
              </p>
              <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">
                That&apos;s {savingsPercent}% less than {provider.name}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-gray-50 p-6 text-center dark:bg-gray-800">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {providerId === "ses_raw"
                  ? "Raw SES is cheaper but requires you to build and maintain everything yourself. Mailmark gives you a complete platform at a small premium."
                  : `${provider.name} is competitively priced at this volume. Mailmark still offers a full-featured platform with built-in deliverability tools.`}
              </p>
            </div>
          )}

          {/* Comparison Cards */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {/* Current Provider */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Current provider
              </p>
              <h3 className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                {provider.name}
              </h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Monthly
                  </span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(currentCost)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between border-t border-gray-100 pt-3 dark:border-gray-700">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Annual
                  </span>
                  <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                    {formatCurrency(currentCost * 12)}
                  </span>
                </div>
              </div>
            </div>

            {/* Mailmark */}
            <div className="rounded-2xl border-2 border-violet-200 bg-violet-50 p-6 dark:border-violet-800 dark:bg-violet-900/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-violet-600 dark:text-violet-400">
                    With Mailmark
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                    {mailmark.name} Plan
                  </h3>
                </div>
                {hasSavings && (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    Save {savingsPercent}%
                  </span>
                )}
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-violet-600 dark:text-violet-400">
                    Monthly
                  </span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(mailmark.price)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between border-t border-violet-100 pt-3 dark:border-violet-800">
                  <span className="text-sm text-violet-600 dark:text-violet-400">
                    Annual
                  </span>
                  <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                    {formatCurrency(mailmark.price * 12)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* What's Included */}
          <div className="mt-8 rounded-2xl border border-gray-100 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Included with every Mailmark plan
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                "Multi-domain management",
                "Inbox warming (28 days)",
                "SPF/DKIM/DMARC setup",
                "Blacklist monitoring",
                "Open & click tracking",
                "Bounce suppression",
                "REST API + SDK",
                "Campaign analytics",
                "Built-in email client",
              ].map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"
                >
                  <svg
                    className="h-4 w-4 shrink-0 text-violet-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {feature}
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Note */}
          <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
            Pricing is approximate based on publicly available data as of April
            2026. Actual costs may vary by plan, region, and usage.
          </p>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-gradient-to-r from-violet-600 to-purple-700 px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-white">
            Cut Your Email Bill by Up to 90% — Switch to AWS SES with Mailmark
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-violet-100">
            Get enterprise-grade email infrastructure at AWS SES pricing.
            No DevOps required. Set up in minutes.
          </p>
          <Link
            href="https://www.mailmark.dev"
            className="mt-6 inline-flex rounded-full bg-white px-8 py-3.5 text-base font-semibold text-violet-700 shadow-lg transition-all hover:bg-violet-50 hover:shadow-xl"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Provider Pricing Details */}
      <section className="bg-white px-6 py-16 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Provider Pricing Reference
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            How we estimate costs for each provider. All prices are based on
            publicly available pricing pages.
          </p>
          <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    Provider
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    Pricing Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {Object.values(providers).map((p) => (
                  <tr key={p.name}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {p.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {p.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white px-6 py-16 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Frequently Asked Questions
          </h2>
          <div className="mt-8 space-y-6">
            {faqItems.map((item) => (
              <div key={item.q}>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {item.q}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
