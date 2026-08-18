"use client";

import { useState } from "react";

const faqs = [
  {
    question: "What is Mailmark?",
    answer:
      "Mailmark is one email platform for developers running multiple products. You manage every product's domain and mailboxes from a single dashboard, send campaigns to your users with mail merge, and send transactional or campaign email programmatically through a REST API and npm SDK, with deliverability built in.",
  },
  {
    question: "Can I send email from my own app?",
    answer:
      "Yes. Mailmark ships a REST API and a typed npm SDK (mailmark-sdk). You can send transactional emails, run campaign sends where each recipient gets an individually tracked email, schedule sends for later, and drive automated sequences. You can also pull domain health, warmup status, bounce stats, and suppression lists. Each API key is scoped to a single domain, so one product's key cannot touch another product's mail.",
  },
  {
    question: "How does campaign sending keep recipients private?",
    answer:
      "Campaign sends use mail merge to generate a separate, individual email for every recipient. There is no shared CC or BCC, so nobody can see who else received the message. You can personalize each email with merge tags like {{firstName}}, so a product update goes out to your whole user base but still reads one to one.",
  },
  {
    question: "Can I manage more than one domain?",
    answer:
      "That is the whole point. Add a domain per product, verify DNS once (we walk you through MX, SPF, DKIM, and DMARC), and manage all of them from one dashboard. The Starter plan covers 1 domain, Pro covers 5, and Business is unlimited.",
  },
  {
    question: "How many mailboxes can I create?",
    answer:
      "Starter supports up to 3 mailboxes on a single domain. Pro gives you unlimited mailboxes across 5 domains, and Business lifts all limits so every product can have as many sender addresses as it needs.",
  },
  {
    question: "Does Mailmark handle deliverability?",
    answer:
      "Yes. New mailboxes get 28-day inbox warming that exchanges real emails with Gmail accounts and generates genuine engagement signals, so you build reputation from day one. On top of that, Mailmark continuously monitors SPF, DKIM, DMARC, and blacklist status and alerts you before problems reach your users. No Gmail connection is required from your side.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Starter and Pro come with a 7-day free trial, no credit card required. You get full access to every feature during the trial. After 7 days your account pauses until you choose a paid plan.",
  },
  {
    question: "Can I still use it for cold outreach?",
    answer:
      "Yes. While Mailmark is built for talking to your own users, the same tools work for sales outreach: list verification, seed-inbox placement testing, per-mailbox sending, and multi-step sequences are all included.",
  },
];

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 text-black transition-transform duration-200 ${open ? "rotate-180" : ""}`}
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
    <section id="faq" className="border-b-2 border-black bg-champagne px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <span className="mb-4 inline-block rounded-full border-2 border-black bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-black">
            FAQ
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-black md:text-4xl">
            Questions, answered
          </h2>
          <p className="mt-4 text-lg text-black/70">
            Everything you need to know about running your products&apos; email
            on Mailmark.
          </p>
        </div>

        <div className="mt-14 space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.question}
                className="rounded-xl border-2 border-black bg-white shadow-[4px_4px_0px_#000]"
              >
                <button
                  onClick={() => toggle(index)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-extrabold text-black">
                    {faq.question}
                  </span>
                  <span className="ml-6 flex h-7 items-center">
                    <ChevronIcon open={isOpen} />
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t-2 border-black px-5 py-4">
                    <p className="text-sm leading-relaxed text-black/70">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
