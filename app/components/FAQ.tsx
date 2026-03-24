"use client";

import { useState } from "react";

const faqs = [
  {
    question: "What is Mailmark?",
    answer:
      "Mailmark is an email campaign platform built around custom domains. You connect your own domain, create sender mailboxes, and run personalized campaigns with built-in deliverability, analytics, and automated follow-ups, all from a single dashboard.",
  },
  {
    question: "Can I use my own custom domain?",
    answer:
      "Yes. Mailmark is built around custom domains so your campaigns go out from addresses your recipients recognize and trust. You add your domain, configure the required DNS records (we provide step-by-step instructions), and you're campaign-ready in minutes. You can add multiple domains on paid plans.",
  },
  {
    question: "How many mailboxes can I create?",
    answer:
      "The Starter plan supports up to 3 sender mailboxes on a single domain. The Pro plan gives you unlimited mailboxes across 5 domains for running multiple campaigns, and the Business plan lifts all limits for full-scale outreach.",
  },
  {
    question: "What campaign features are included?",
    answer:
      "Every plan includes email campaigns. Compose rich HTML emails, import or build your recipient list, personalize with merge tags, schedule sends, and track opens, clicks, and deliverability in the built-in analytics dashboard. Multi-stage automated follow-up sequences are also included.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Yes. Every plan comes with a 7-day free trial with no credit card required. You get full access to all features during the trial. After 7 days, your account pauses until you choose a paid plan.",
  },
  {
    question: "How does billing work?",
    answer:
      "All plans are billed monthly after your 7-day free trial ends. You can upgrade, downgrade, or cancel at any time from your account settings. When you upgrade mid-cycle, we prorate the charge so you only pay for what you use.",
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer:
      "Absolutely. There are no long-term contracts or cancellation fees. You can cancel from your account settings at any time and your paid plan remains active until the end of the current billing period.",
  },
  {
    question: "What email clients or apps can I use with Mailmark?",
    answer:
      "Campaigns are managed through the built-in Mailmark web UI, which works in any modern browser. For managing replies, we also support IMAP and SMTP access, so you can connect your sender mailboxes to any standard email client such as Apple Mail, Thunderbird, or Outlook.",
  },
];

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 text-gray-500 transition-transform duration-200 dark:text-gray-400 ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  function toggle(index: number) {
    setOpenIndex((prev) => (prev === index ? null : index));
  }

  return (
    <section id="faq" className="bg-gray-50 px-6 py-24 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            Everything you need to know about Mailmark.
          </p>
        </div>

        <dl className="mt-16 divide-y divide-gray-200 dark:divide-gray-700">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={faq.question} className="py-6">
                <dt>
                  <button
                    onClick={() => toggle(index)}
                    className="flex w-full items-start justify-between text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="text-base font-semibold text-gray-900 dark:text-white">
                      {faq.question}
                    </span>
                    <span className="ml-6 flex h-7 items-center">
                      <ChevronIcon open={isOpen} />
                    </span>
                  </button>
                </dt>
                {isOpen && (
                  <dd className="mt-3 pr-12">
                    <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                      {faq.answer}
                    </p>
                  </dd>
                )}
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
