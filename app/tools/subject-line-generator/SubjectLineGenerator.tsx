"use client";

import { useState, useRef } from "react";
import Link from "next/link";

interface SubjectLine {
  line: string;
  tip: string;
}

const tones = [
  { value: "casual", label: "Casual" },
  { value: "professional", label: "Professional" },
  { value: "direct", label: "Direct" },
  { value: "friendly", label: "Friendly" },
  { value: "urgent", label: "Urgent" },
];

const faqItems = [
  {
    q: "What makes a good cold email subject line?",
    a: "The best cold email subject lines are short (under 60 characters), create curiosity, feel personal, and avoid spammy words like 'FREE' or 'ACT NOW'. They should make the recipient want to open the email without feeling tricked.",
  },
  {
    q: "How long should a cold email subject line be?",
    a: "Keep it under 60 characters. Most email clients truncate longer subject lines, especially on mobile. The sweet spot is 30-50 characters where the full line is visible at a glance.",
  },
  {
    q: "Should I use personalization in subject lines?",
    a: "Yes. Subject lines that include the recipient's name, company, or a specific detail about their business see significantly higher open rates. Even something as simple as mentioning their industry makes a difference.",
  },
  {
    q: "How many subject lines should I test?",
    a: "Test at least 3-5 variations per campaign. A/B testing subject lines is one of the highest-ROI activities in cold email. Small changes in wording can swing open rates by 20-30%.",
  },
  {
    q: "What subject line words trigger spam filters?",
    a: "Avoid all-caps, excessive punctuation (!!!), and words like 'guaranteed', 'winner', 'urgent', 'act now', 'limited time', and 'free money'. These are red flags for spam filters and will hurt your deliverability.",
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not available
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 transition-all hover:border-violet-300 hover:text-violet-600 dark:border-gray-600 dark:text-gray-400 dark:hover:border-violet-600 dark:hover:text-violet-400"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export default function SubjectLineGenerator() {
  const [industry, setIndustry] = useState("");
  const [offer, setOffer] = useState("");
  const [tone, setTone] = useState("professional");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SubjectLine[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const canSubmit = industry.trim() && offer.trim() && !loading;

  async function handleGenerate() {
    if (!canSubmit) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const res = await fetch("/api/tools/generate-subject-lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: industry.trim(),
          offer: offer.trim(),
          tone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        if (data.generationsRemaining !== undefined) {
          setRemaining(data.generationsRemaining);
        }
        return;
      }

      setResults(data.subjectLines);
      if (data.generationsRemaining !== undefined) {
        setRemaining(data.generationsRemaining);
      }
      setTimeout(() => {
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch {
      setError("Failed to connect. Please check your internet and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Hero + Inputs */}
      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-20 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400">
            <Link href="/tools" className="hover:underline">
              Tools
            </Link>
            <span>/</span>
            <span className="text-gray-500 dark:text-gray-400">
              Subject Line Generator
            </span>
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Write Subject Lines That Actually Get Opened
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            Tired of your cold emails getting ignored? Our AI generates subject
            lines proven to boost open rates. Tailored to your industry, your
            offer, and the tone you want to set.
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Free, instant, no signup required.
          </p>

          {/* Form */}
          <div className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="industry"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Your industry or niche
              </label>
              <input
                id="industry"
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. SaaS, Real Estate, Marketing Agency"
                maxLength={200}
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:ring-violet-900/30"
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="offer"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                What are you offering?
              </label>
              <input
                id="offer"
                type="text"
                value={offer}
                onChange={(e) => setOffer(e.target.value)}
                placeholder="e.g. Free SEO audit, demo of our CRM, partnership opportunity"
                maxLength={200}
                className="mt-1.5 w-full rounded-xl border border-gray-200 px-4 py-3 text-base outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:ring-violet-900/30"
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="tone"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Tone
              </label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {tones.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTone(t.value)}
                    disabled={loading}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                      tone === t.value
                        ? "bg-violet-600 text-white shadow-sm"
                        : "border border-gray-200 bg-white text-gray-600 hover:border-violet-300 hover:text-violet-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-violet-600"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!canSubmit}
              className="w-full rounded-full bg-violet-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-violet-200 transition-all hover:bg-violet-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:shadow-violet-900/30"
            >
              {loading ? "Generating..." : "Generate Subject Lines"}
            </button>

            {remaining !== null && remaining > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {remaining} free generation{remaining !== 1 ? "s" : ""} remaining
                today
              </p>
            )}

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            {loading && (
              <div className="flex items-center gap-3">
                <svg
                  className="h-5 w-5 animate-spin text-violet-600 dark:text-violet-400"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  Writing your subject lines...
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Results */}
      {results.length > 0 && (
        <section
          ref={resultRef}
          className="bg-white px-6 py-16 dark:bg-gray-900"
        >
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Your Subject Lines
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Click to copy any subject line and use it in your next campaign.
            </p>

            <div className="mt-6 space-y-3">
              {results.map((item, i) => (
                <div
                  key={i}
                  className="group flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-5 transition-all hover:border-violet-200 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:hover:border-violet-700"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {item.line}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {item.tip}
                    </p>
                  </div>
                  <CopyButton text={item.line} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Banner */}
      <section className="bg-gradient-to-r from-violet-600 to-purple-700 px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-white">
            Great subject lines deserve great deliverability
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-violet-100">
            What good is a perfect subject line if your email lands in spam?
            Mailmark makes sure your emails reach the inbox with automated
            domain setup, inbox warming, and blacklist monitoring.
          </p>
          <Link
            href="https://mailmark.dev"
            className="mt-6 inline-flex rounded-full bg-white px-8 py-3.5 text-base font-semibold text-violet-700 shadow-lg transition-all hover:bg-violet-50 hover:shadow-xl"
          >
            Get Started Free
          </Link>
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
