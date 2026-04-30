"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";

const faqItems = [
  {
    q: "Why should I validate my email list before sending?",
    a: "Sending to invalid emails causes hard bounces, which damage your sender reputation. A bounce rate above 2% can trigger spam filters and get your domain blacklisted. Validating your list removes bad addresses before they hurt your deliverability.",
  },
  {
    q: "What counts as a 'risky' email?",
    a: "Role-based addresses (info@, admin@, support@) and free provider emails (Gmail, Yahoo) are flagged as risky. Role-based addresses are shared inboxes that often have stricter spam filtering. Free providers are fine for personal outreach but may indicate low-quality B2B leads.",
  },
  {
    q: "How often should I clean my email list?",
    a: "Clean your list every 3-6 months, or before any major campaign. Email addresses decay at roughly 2-3% per month as people change jobs, companies shut down, and domains expire. Regular cleaning keeps your bounce rate low.",
  },
  {
    q: "What's the difference between syntax validation and MX record checking?",
    a: "Syntax validation checks if the email format is correct (has an @ sign, valid characters, etc.). MX record checking verifies that the domain actually has mail servers configured to receive email. An email can have valid syntax but still be undeliverable if the domain has no mail server.",
  },
  {
    q: "Can I upload a CSV file?",
    a: "Yes. Upload a CSV file and we will extract email addresses from it automatically. We look for columns named 'email', 'Email', 'email_address', or similar. You can also paste emails directly into the text box, one per line.",
  },
];

interface ValidationResult {
  email: string;
  status: "valid" | "risky" | "invalid";
  reason: string;
  checks: {
    syntax: boolean;
    mxRecord: boolean;
    disposable: boolean;
    roleBased: boolean;
    freeProvider: boolean;
  };
}

interface ValidationSummary {
  total: number;
  valid: number;
  risky: number;
  invalid: number;
}

function parseCSV(text: string): string[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
  const emailColIndex = headers.findIndex((h) =>
    ["email", "email_address", "emailaddress", "e-mail", "mail"].includes(h)
  );

  if (emailColIndex !== -1 && lines.length > 1) {
    return lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/['"]/g, ""));
      return cols[emailColIndex] ?? "";
    }).filter(Boolean);
  }

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails: string[] = [];
  for (const line of lines) {
    const matches = line.match(emailRegex);
    if (matches) emails.push(...matches);
  }
  return emails;
}

function StatusBadge({ status }: { status: "valid" | "risky" | "invalid" }) {
  const styles = {
    valid: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
    risky: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    invalid: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function SummaryCard({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{count}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">{pct}% of total</p>
    </div>
  );
}

function CheckIcon({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      title={label}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs ${
        ok
          ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          : "bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400"
      }`}
    >
      {ok ? (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {label}
    </span>
  );
}

export default function EmailListValidator() {
  const [emailInput, setEmailInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "valid" | "risky" | "invalid">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const emailCount = emailInput
    .split(/[\n,;]+/)
    .map((e) => e.trim())
    .filter((e) => e.includes("@")).length;

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (file.name.endsWith(".csv")) {
        const emails = parseCSV(text);
        setEmailInput(emails.join("\n"));
      } else {
        setEmailInput(text);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  async function handleValidate() {
    setError(null);

    const emails = emailInput
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));

    if (emails.length === 0) {
      setError("Enter at least one email address.");
      return;
    }

    if (emails.length > 100) {
      setError("Maximum 100 emails per validation. Please reduce your list.");
      return;
    }

    setLoading(true);
    setHasValidated(false);
    setResults([]);
    setSummary(null);

    try {
      const res = await fetch("/api/tools/validate-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setHasValidated(true);
        return;
      }

      setResults(data.results);
      setSummary(data.summary);
      setHasValidated(true);
    } catch {
      setError("Failed to connect. Please check your internet and try again.");
      setHasValidated(true);
    } finally {
      setLoading(false);
    }
  }

  function handleExportCSV() {
    if (results.length === 0) return;
    const headers = "email,status,reason\n";
    const rows = results.map((r) => `${r.email},${r.status},"${r.reason}"`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "email-validation-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredResults = filter === "all" ? results : results.filter((r) => r.status === filter);

  return (
    <>
      {/* Hero + Input */}
      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-20 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400">
            <Link href="/tools" className="hover:underline">
              Tools
            </Link>
            <span>/</span>
            <span className="text-gray-500 dark:text-gray-400">
              Email List Validator
            </span>
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Free Email List Validator - Verify Emails Before You Send
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            Check your email list for invalid addresses, disposable emails, and
            risky contacts. Reduce bounces and protect your sender reputation.
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Paste up to 100 emails or upload a CSV. Free, no signup required.
          </p>

          {/* Input area */}
          <div className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email Addresses
              </label>
              <textarea
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder={"john@company.com\njane@example.com\ninfo@business.org"}
                rows={6}
                disabled={loading}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 font-mono text-sm outline-none transition-all placeholder:text-gray-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-600 dark:focus:ring-violet-900/30"
              />
              <div className="mt-1.5 flex items-center justify-between">
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  One email per line, or comma/semicolon separated. Max 100.
                </p>
                {emailCount > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {emailCount} email{emailCount !== 1 ? "s" : ""} detected
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                Upload CSV
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <span className="text-xs text-gray-400 dark:text-gray-500">
                .csv or .txt files supported
              </span>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleValidate}
              disabled={loading || emailCount === 0}
              className="rounded-full bg-violet-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-violet-200 transition-all hover:bg-violet-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-violet-900/30"
            >
              {loading ? "Validating..." : "Validate Emails"}
            </button>
          </div>

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
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Validating {emailCount} email{emailCount !== 1 ? "s" : ""}... Checking syntax, MX records, and reputation.
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Results */}
      {hasValidated && !loading && (
        <section className="bg-white px-6 py-16 dark:bg-gray-900">
          <div className="mx-auto max-w-4xl">
            {results.length === 0 && !error ? (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-800">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No results to display.
                </p>
              </div>
            ) : results.length > 0 && (
              <>
                {/* Summary cards */}
                {summary && (
                  <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <SummaryCard label="Total" count={summary.total} total={summary.total} color="text-gray-900 dark:text-white" />
                    <SummaryCard label="Valid" count={summary.valid} total={summary.total} color="text-green-600 dark:text-green-400" />
                    <SummaryCard label="Risky" count={summary.risky} total={summary.total} color="text-amber-600 dark:text-amber-400" />
                    <SummaryCard label="Invalid" count={summary.invalid} total={summary.total} color="text-red-600 dark:text-red-400" />
                  </div>
                )}

                {/* Filter + export */}
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex gap-2">
                    {(["all", "valid", "risky", "invalid"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                          filter === f
                            ? "bg-violet-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                        }`}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                        {f !== "all" && summary ? ` (${summary[f]})` : ""}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleExportCSV}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Export CSV
                  </button>
                </div>

                {/* Desktop Table */}
                <div className="hidden overflow-hidden rounded-2xl border border-gray-200 md:block dark:border-gray-700">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                        <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Email</th>
                        <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Status</th>
                        <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Reason</th>
                        <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Checks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filteredResults.map((result, i) => (
                        <tr key={i} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-4 py-3 font-mono text-sm text-gray-900 dark:text-white">
                            {result.email}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={result.status} />
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {result.reason}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5">
                              <CheckIcon ok={result.checks.syntax} label="Syntax" />
                              <CheckIcon ok={result.checks.mxRecord} label="MX" />
                              <CheckIcon ok={!result.checks.disposable} label="Not disposable" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="space-y-3 md:hidden">
                  {filteredResults.map((result, i) => (
                    <div key={i} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                      <div className="flex items-start justify-between gap-3">
                        <p className="break-all font-mono text-sm font-medium text-gray-900 dark:text-white">
                          {result.email}
                        </p>
                        <StatusBadge status={result.status} />
                      </div>
                      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{result.reason}</p>
                      <div className="mt-2 flex gap-2">
                        <CheckIcon ok={result.checks.syntax} label="Syntax" />
                        <CheckIcon ok={result.checks.mxRecord} label="MX" />
                        <CheckIcon ok={!result.checks.disposable} label="Not disposable" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="mt-8 rounded-2xl border border-violet-200 bg-violet-50 p-6 text-center dark:border-violet-800 dark:bg-violet-900/20">
                  <h3 className="font-semibold text-violet-900 dark:text-violet-200">
                    List is clean. Ready to send?
                  </h3>
                  <p className="mt-2 text-sm text-violet-700 dark:text-violet-300">
                    Use Mailmark to send email campaigns with automated domain setup,
                    inbox warming, and deliverability monitoring. All powered by AWS SES.
                  </p>
                  <Link
                    href="https://www.mailmark.dev"
                    className="mt-4 inline-flex rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-violet-700 hover:shadow-md"
                  >
                    Get Started Free
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* CTA Banner */}
      <section className="bg-gradient-to-r from-violet-600 to-purple-700 px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-white">
            Stop Bouncing. Start Landing in the Inbox.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-violet-100">
            Mailmark gives you everything to go from a clean email list to landing
            in the inbox: domain setup, inbox warming, campaign sending, and
            deliverability monitoring. All powered by AWS SES.
          </p>
          <Link
            href="https://www.mailmark.dev"
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
