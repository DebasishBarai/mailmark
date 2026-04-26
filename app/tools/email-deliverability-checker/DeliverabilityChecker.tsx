"use client";

import { useState, useRef } from "react";
import Link from "next/link";

interface CheckResult {
  domain: string;
  score: number;
  reputationStatus: "healthy" | "warning" | "critical";
  checks: {
    spf: { valid: boolean; record: string | null; details: string };
    dkim: { valid: boolean; selectors: string[]; details: string };
    dmarc: {
      valid: boolean;
      record: string | null;
      policy: string | null;
      details: string;
    };
    mx: {
      valid: boolean;
      records: { priority: number; exchange: string }[];
      details: string;
    };
    blacklist: {
      clean: boolean;
      listed: string[];
      checked: string[];
      details: string;
    };
  };
  recommendations: string[];
  checkedAt: string;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : score >= 50
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  const bgRing =
    score >= 80
      ? "border-emerald-200 dark:border-emerald-800"
      : score >= 50
        ? "border-amber-200 dark:border-amber-800"
        : "border-red-200 dark:border-red-800";

  return (
    <div
      className={`flex h-32 w-32 flex-col items-center justify-center rounded-full border-4 ${bgRing}`}
    >
      <span className={`text-4xl font-extrabold ${color}`}>{score}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400">out of 100</span>
    </div>
  );
}

function ReputationBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; dot: string }> = {
    healthy: {
      bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
      dot: "bg-emerald-500",
    },
    warning: {
      bg: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      dot: "bg-amber-500",
    },
    critical: {
      bg: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
      dot: "bg-red-500",
    },
  };
  const c = config[status] ?? config.warning;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${c.bg}`}
    >
      <span className={`h-2 w-2 rounded-full ${c.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function CheckCard({
  title,
  valid,
  details,
  children,
}: {
  title: string;
  valid: boolean;
  details: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full ${valid ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-red-100 dark:bg-red-900/40"}`}
        >
          {valid ? (
            <svg
              className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          ) : (
            <svg
              className="h-4 w-4 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <p
            className={`text-sm ${valid ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
          >
            {valid ? "Pass" : "Fail"}
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        {details}
      </p>
      {children}
    </div>
  );
}

const loadingSteps = [
  "Checking sender authentication...",
  "Verifying email signing...",
  "Analyzing domain policies...",
  "Looking up mail servers...",
  "Scanning spam blacklists...",
];

const faqItems = [
  {
    q: "Why are my emails going to spam?",
    a: "The most common reasons are missing authentication records (SPF, DKIM, DMARC), a poor sender reputation, being listed on email blacklists, or sending to unengaged contacts. Our free test checks all of these instantly so you know exactly what to fix.",
  },
  {
    q: "What is an email deliverability test?",
    a: "An email deliverability test checks whether your domain is properly configured to send emails that reach the inbox instead of spam. It verifies your sender authentication, checks if you're on any blacklists, and gives you a health score so you can see where you stand.",
  },
  {
    q: "How do I improve my email open rates?",
    a: "Start by fixing your domain authentication. Missing SPF, DKIM, or DMARC records are the #1 reason emails get filtered to spam. After that, warm up your domain gradually, clean your contact list, and avoid spam trigger words in your subject lines.",
  },
  {
    q: "What do SPF, DKIM, and DMARC actually do?",
    a: "They prove to email providers that you are who you say you are. SPF lists which servers can send on your behalf. DKIM adds a cryptographic signature to verify your emails weren't tampered with. DMARC tells providers what to do if those checks fail. Together, they are the foundation of inbox placement.",
  },
  {
    q: "How often should I test my email deliverability?",
    a: "Test after any DNS changes, before launching a new campaign, and at least once a month as a routine check. Blacklist status and DNS records can change without warning, so regular testing helps you catch problems before they tank your open rates.",
  },
  {
    q: "Is this tool really free?",
    a: "Yes, completely free with no signup required. Run as many checks as you need. If you want automated monitoring, inbox warming, and full campaign infrastructure, Mailmark handles all of that.",
  },
];

export default function DeliverabilityChecker() {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  async function handleCheck() {
    const trimmed = domain.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setLoadingStep(0);

    const stepInterval = setInterval(() => {
      setLoadingStep((prev) =>
        prev < loadingSteps.length - 1 ? prev + 1 : prev
      );
    }, 800);

    try {
      const res = await fetch("/api/tools/check-deliverability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setResult(data);
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch {
      setError("Failed to connect. Please check your internet and try again.");
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
    }
  }

  return (
    <>
      {/* Hero + Input */}
      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-20 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400">
            <Link href="/tools" className="hover:underline">
              Tools
            </Link>
            <span>/</span>
            <span className="text-gray-500 dark:text-gray-400">
              Email Deliverability Test
            </span>
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Free Email Deliverability Test: Check If Your Emails Land in Spam
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            Struggling with low open rates? Your emails might be landing in
            spam. Test your domain in seconds to check your sender reputation,
            blacklist status, and authentication setup. Get a health score and
            actionable fixes to start reaching the inbox.
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Free, instant, no signup required.
          </p>

          <div className="mt-8">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCheck();
              }}
              className="flex flex-col gap-3 sm:flex-row"
            >
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
                className="flex-1 rounded-full border border-gray-200 px-5 py-3 text-base outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:ring-violet-900/30"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !domain.trim()}
                className="rounded-full bg-violet-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-violet-200 transition-all hover:bg-violet-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-violet-900/30"
              >
                {loading ? "Testing..." : "Test My Deliverability"}
              </button>
            </form>

            {error && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            {loading && (
              <div className="mt-6 flex items-center gap-3">
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
                  {loadingSteps[loadingStep]}
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* What This Tool Checks */}
      <section className="bg-gray-50 px-6 py-12 dark:bg-gray-800/50">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            What This Tool Checks
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Enter any domain and our checker runs five live DNS and reputation tests in seconds.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              {
                label: "SPF Record",
                desc: "Verifies that a valid Sender Policy Framework record exists, listing servers authorized to send email from your domain.",
              },
              {
                label: "DKIM Signature",
                desc: "Checks for DomainKeys Identified Mail selectors so receiving servers can verify your emails haven't been altered in transit.",
              },
              {
                label: "DMARC Policy",
                desc: "Confirms a DMARC record is in place and reports what policy (none, quarantine, or reject) is applied to failing messages.",
              },
              {
                label: "MX Records",
                desc: "Looks up your mail exchange records to confirm your domain is properly set up to send and receive email.",
              },
              {
                label: "Blacklist Status",
                desc: "Cross-references your domain against major spam blacklists including Spamhaus, Barracuda, and SORBS to flag any listings.",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {item.label}
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Results */}
      {result && (
        <section
          ref={resultRef}
          className="bg-white px-6 py-16 dark:bg-gray-900"
        >
          <div className="mx-auto max-w-3xl">
            {/* Score + Reputation */}
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Results for{" "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {result.domain}
                </span>
              </p>
              <ScoreBadge score={result.score} />
              <ReputationBadge status={result.reputationStatus} />
            </div>

            {/* Check Cards */}
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <CheckCard
                title="SPF"
                valid={result.checks.spf.valid}
                details={result.checks.spf.details}
              >
                {result.checks.spf.record && (
                  <code className="mt-2 block break-all rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                    {result.checks.spf.record}
                  </code>
                )}
              </CheckCard>

              <CheckCard
                title="DKIM"
                valid={result.checks.dkim.valid}
                details={result.checks.dkim.details}
              >
                {result.checks.dkim.selectors.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {result.checks.dkim.selectors.map((s) => (
                      <span
                        key={s}
                        className="rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </CheckCard>

              <CheckCard
                title="DMARC"
                valid={result.checks.dmarc.valid}
                details={result.checks.dmarc.details}
              >
                {result.checks.dmarc.record && (
                  <code className="mt-2 block break-all rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                    {result.checks.dmarc.record}
                  </code>
                )}
              </CheckCard>

              <CheckCard
                title="MX Records"
                valid={result.checks.mx.valid}
                details={result.checks.mx.details}
              >
                {result.checks.mx.records.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {result.checks.mx.records.map((r) => (
                      <div
                        key={`${r.priority}-${r.exchange}`}
                        className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"
                      >
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-500 dark:bg-gray-700">
                          {r.priority}
                        </span>
                        <span className="font-mono">{r.exchange}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CheckCard>

              <CheckCard
                title="Blacklist"
                valid={result.checks.blacklist.clean}
                details={result.checks.blacklist.details}
              >
                <div className="mt-2 space-y-1">
                  {result.checks.blacklist.checked.map((bl) => (
                    <div
                      key={bl}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${result.checks.blacklist.listed.includes(bl) ? "bg-red-500" : "bg-emerald-500"}`}
                      />
                      <span className="text-gray-600 dark:text-gray-400">
                        {bl}
                      </span>
                    </div>
                  ))}
                </div>
              </CheckCard>
            </div>

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div className="mt-8 rounded-2xl border border-amber-100 bg-amber-50 p-6 dark:border-amber-900/50 dark:bg-amber-900/20">
                <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                  Recommendations
                </h3>
                <ul className="mt-3 space-y-2.5">
                  {result.recommendations.map((rec) => (
                    <li
                      key={rec}
                      className="flex items-start gap-2.5 text-sm text-amber-800 dark:text-amber-300"
                    >
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                        />
                      </svg>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-3 text-sm">
                  <Link
                    href="/guides/dns-setup"
                    className="text-amber-700 underline hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
                  >
                    DNS Setup Guide
                  </Link>
                  <Link
                    href="/guides/email-deliverability"
                    className="text-amber-700 underline hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
                  >
                    Email Deliverability Guide
                  </Link>
                </div>
              </div>
            )}

            {/* Checked timestamp */}
            <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
              Checked at {new Date(result.checkedAt).toLocaleString()}
            </p>
          </div>
        </section>
      )}

      {/* CTA Banner */}
      <section className="bg-gradient-to-r from-violet-600 to-purple-700 px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-white">
            Fix Your Email Deliverability — Automated Domain Setup, Inbox Warming &amp; Monitoring
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-violet-100">
            Mailmark fixes your deliverability on autopilot. Automated domain
            authentication, 28-day inbox warming, blacklist monitoring, and
            full campaign infrastructure -- all powered by AWS SES at a
            fraction of what other tools charge.
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
