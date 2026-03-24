import type { Metadata } from "next";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "Affiliate Program - Mailmark",
  description:
    "Earn 30% recurring commission for every customer you refer to Mailmark. Join our affiliate program today.",
};

const steps = [
  {
    step: "01",
    title: "Apply & get approved",
    description:
      "Fill out a short application. We review applications within 48 hours and accept anyone with an audience interested in email, SaaS, or business tools.",
  },
  {
    step: "02",
    title: "Share your unique link",
    description:
      "You'll get a custom referral link and a library of banners, email copy, and social posts you can use right away.",
  },
  {
    step: "03",
    title: "Earn recurring commissions",
    description:
      "For every paying customer you refer, earn 30% of their subscription every month for the lifetime of their account.",
  },
];

const faqs = [
  {
    q: "How much can I earn?",
    a: "You earn 30% of every payment made by referred customers — every month, for as long as they stay subscribed. A single Pro referral ($50/month) earns you $15/month indefinitely.",
  },
  {
    q: "When do I get paid?",
    a: "Payouts are processed on the 15th of each month for the previous month's commissions. We pay via PayPal or bank transfer (SWIFT/SEPA).",
  },
  {
    q: "Is there a minimum payout threshold?",
    a: "Yes — the minimum payout is $50. Earnings below this roll over to the next month.",
  },
  {
    q: "How long does a referral cookie last?",
    a: "90 days. If someone clicks your link and signs up within 90 days, you get credit.",
  },
  {
    q: "Can I promote Mailmark with paid ads?",
    a: "You may not bid on branded terms like 'Mailmark' in paid search. All other paid promotion is allowed.",
  },
];

const tiers = [
  { plan: "Starter", price: "$10/mo", commission: "$3.00/mo", note: "30% recurring" },
  { plan: "Pro", price: "$50/mo", commission: "$15/mo", note: "30% recurring", highlight: true },
  { plan: "Business", price: "$100/mo", commission: "$30/mo", note: "30% recurring", highlight: false },
];

export default function AffiliatePage() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-24 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-violet-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            Affiliate Program
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Earn 30% recurring commission
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-600 dark:text-gray-300">
            Recommend Mailmark to your audience and earn a 30% commission on every
            payment — forever, not just for one year.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <a
              href="/affiliate"
              className="rounded-full bg-violet-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-200 transition-colors hover:bg-violet-700 dark:shadow-violet-900/30"
            >
              Apply now — it&apos;s free
            </a>
            <a
              href="#how-it-works"
              className="rounded-full border border-gray-300 px-8 py-3.5 text-base font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Learn more
            </a>
          </div>
        </div>
      </section>

      {/* Commission table */}
      <section className="bg-white px-6 py-16 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white">
            What you earn
          </h2>
          <div className="mt-8 overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  <th className="px-6 py-4">Plan</th>
                  <th className="px-6 py-4">Customer pays</th>
                  <th className="px-6 py-4">You earn</th>
                  <th className="px-6 py-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((tier) => (
                  <tr
                    key={tier.plan}
                    className={`border-b border-gray-100 last:border-0 dark:border-gray-700 ${
                      tier.highlight ? "bg-violet-50 dark:bg-violet-900/20" : "bg-white dark:bg-gray-900"
                    }`}
                  >
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                      {tier.plan}
                      {tier.highlight && (
                        <span className="ml-2 rounded-full bg-violet-600 px-2 py-0.5 text-xs text-white">
                          Most popular
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{tier.price}</td>
                    <td className="px-6 py-4 font-semibold text-violet-700 dark:text-violet-400">{tier.commission}</td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{tier.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-gray-50 px-6 py-16 dark:bg-gray-800">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white">
            How it works
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.step} className="rounded-2xl border border-gray-100 bg-white p-8 dark:border-gray-700 dark:bg-gray-900">
                <span className="text-4xl font-extrabold text-violet-100 dark:text-violet-900">{s.step}</span>
                <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white px-6 py-16 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Common questions</h2>
          <div className="mt-8 space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q} className="border-b border-gray-100 pb-6 last:border-0 dark:border-gray-700">
                <p className="font-semibold text-gray-900 dark:text-white">{faq.q}</p>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-violet-600 px-6 py-16 dark:bg-violet-800">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-white">Ready to start earning?</h2>
          <p className="mt-3 text-violet-100">
            Join hundreds of creators, bloggers, and agencies already earning with Mailmark.
          </p>
          <Link
            href="/affiliate"
            className="mt-6 inline-block rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-violet-700 shadow-lg transition-colors hover:bg-violet-50"
          >
            Apply to the affiliate program →
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
