"use client";

import { useState } from "react";
import Link from "next/link";

const SPAM_WORDS = [
  "free", "act now", "limited time", "click here", "buy now", "order now",
  "guaranteed", "no obligation", "winner", "congratulations", "urgent",
  "exclusive deal", "risk free", "no cost", "special promotion", "double your",
  "earn money", "make money", "extra income", "cash bonus", "million dollars",
  "be your own boss", "work from home", "financial freedom", "get paid",
  "incredible deal", "lowest price", "bargain", "discount", "cheap",
  "credit card", "no fees", "no catch", "no strings attached",
  "apply now", "sign up free", "join millions", "act immediately",
  "don't miss out", "expires", "last chance", "only today",
  "once in a lifetime", "while supplies last", "time limited",
  "100% free", "100% satisfied", "0% risk", "zero risk",
  "no questions asked", "satisfaction guaranteed", "money back",
  "eliminate debt", "consolidate", "refinance", "pre-approved",
  "insurance", "lose weight", "weight loss", "miracle", "cure",
  "viagra", "pharmacy", "pills", "supplement",
  "click below", "click this", "open immediately", "read this",
  "as seen on", "been selected", "you have been chosen", "you're a winner",
  "dear friend", "dear sir", "dear madam",
  "nigerian", "prince", "inheritance", "beneficiary",
  "wire transfer", "western union", "bitcoin", "cryptocurrency",
  "unbelievable", "amazing offer", "best price", "lowest rates",
  "no experience", "no investment", "spam", "not spam",
  "opt in", "opt out", "bulk email", "mass email",
  "increase sales", "boost traffic", "seo", "search engine",
];

const EXCESSIVE_PUNCT_REGEX = /[!?$]{3,}|\.{4,}|[!]{2,}|[?]{2,}/g;
const URL_REGEX = /https?:\/\/[^\s]+/g;
const MERGE_FIELD_REGEX = /\{\{[^}]+\}\}|\{[a-z_]+\}/gi;

interface CheckResult {
  id: string;
  label: string;
  status: "pass" | "warning" | "fail";
  detail: string;
  deduction: number;
}

function analyzeSpam(subject: string, body: string): { score: number; checks: CheckResult[] } {
  const checks: CheckResult[] = [];
  let score = 100;

  // 1. Spam trigger words
  const combined = `${subject} ${body}`.toLowerCase();
  const foundWords: string[] = [];
  for (const word of SPAM_WORDS) {
    if (combined.includes(word)) {
      foundWords.push(word);
    }
  }
  if (foundWords.length === 0) {
    checks.push({ id: "spam-words", label: "Spam Trigger Words", status: "pass", detail: "No spam trigger words detected.", deduction: 0 });
  } else if (foundWords.length <= 2) {
    const ded = foundWords.length * 5;
    score -= ded;
    checks.push({ id: "spam-words", label: "Spam Trigger Words", status: "warning", detail: `Found ${foundWords.length} trigger word(s): "${foundWords.join('", "')}"`, deduction: ded });
  } else {
    const ded = Math.min(foundWords.length * 5, 30);
    score -= ded;
    checks.push({ id: "spam-words", label: "Spam Trigger Words", status: "fail", detail: `Found ${foundWords.length} trigger words: "${foundWords.slice(0, 5).join('", "')}${foundWords.length > 5 ? `" and ${foundWords.length - 5} more` : '"'}`, deduction: ded });
  }

  // 2. ALL CAPS ratio
  const words = combined.split(/\s+/).filter((w) => w.length > 1);
  const capsWords = words.filter((w) => w === w.toUpperCase() && /[A-Z]/.test(w));
  const capsRatio = words.length > 0 ? capsWords.length / words.length : 0;
  if (capsRatio <= 0.1) {
    checks.push({ id: "caps", label: "Capitalization", status: "pass", detail: "Text uses normal capitalization.", deduction: 0 });
  } else if (capsRatio <= 0.2) {
    const ded = 10;
    score -= ded;
    checks.push({ id: "caps", label: "Capitalization", status: "warning", detail: `${Math.round(capsRatio * 100)}% of words are ALL CAPS. Keep it under 10%.`, deduction: ded });
  } else {
    const ded = 20;
    score -= ded;
    checks.push({ id: "caps", label: "Capitalization", status: "fail", detail: `${Math.round(capsRatio * 100)}% of words are ALL CAPS. This is a major spam signal.`, deduction: ded });
  }

  // 3. Excessive punctuation
  const punctMatches = combined.match(EXCESSIVE_PUNCT_REGEX);
  if (!punctMatches) {
    checks.push({ id: "punct", label: "Punctuation", status: "pass", detail: "No excessive punctuation detected.", deduction: 0 });
  } else {
    const ded = Math.min(punctMatches.length * 5, 15);
    score -= ded;
    checks.push({ id: "punct", label: "Punctuation", status: punctMatches.length > 2 ? "fail" : "warning", detail: `Found ${punctMatches.length} instance(s) of excessive punctuation (e.g. "!!!", "???").`, deduction: ded });
  }

  // 4. Subject line length
  if (subject.length === 0) {
    score -= 15;
    checks.push({ id: "subject-len", label: "Subject Line Length", status: "fail", detail: "No subject line provided. Emails without a subject are often flagged as spam.", deduction: 15 });
  } else if (subject.length < 10) {
    score -= 10;
    checks.push({ id: "subject-len", label: "Subject Line Length", status: "warning", detail: `Subject is only ${subject.length} characters. Very short subjects can look suspicious.`, deduction: 10 });
  } else if (subject.length > 60) {
    score -= 5;
    checks.push({ id: "subject-len", label: "Subject Line Length", status: "warning", detail: `Subject is ${subject.length} characters. It will be truncated on mobile (keep under 60).`, deduction: 5 });
  } else {
    checks.push({ id: "subject-len", label: "Subject Line Length", status: "pass", detail: `Subject is ${subject.length} characters. Good length for inbox display.`, deduction: 0 });
  }

  // 5. Link density
  const urls = body.match(URL_REGEX) || [];
  if (urls.length === 0) {
    checks.push({ id: "links", label: "Link Density", status: "pass", detail: "No links detected. Clean for deliverability.", deduction: 0 });
  } else if (urls.length <= 3) {
    checks.push({ id: "links", label: "Link Density", status: "pass", detail: `${urls.length} link(s) found. Within safe range.`, deduction: 0 });
  } else if (urls.length <= 5) {
    const ded = 5;
    score -= ded;
    checks.push({ id: "links", label: "Link Density", status: "warning", detail: `${urls.length} links found. Consider reducing to 3 or fewer.`, deduction: ded });
  } else {
    const ded = 15;
    score -= ded;
    checks.push({ id: "links", label: "Link Density", status: "fail", detail: `${urls.length} links found. Too many links is a strong spam signal.`, deduction: ded });
  }

  // 6. Body length (image-to-text ratio hint)
  if (body.length === 0) {
    score -= 10;
    checks.push({ id: "body-len", label: "Body Content", status: "fail", detail: "No body content. Empty emails or image-only emails trigger spam filters.", deduction: 10 });
  } else if (body.length < 50) {
    score -= 5;
    checks.push({ id: "body-len", label: "Body Content", status: "warning", detail: "Body is very short. Emails with little text content are more likely to be flagged.", deduction: 5 });
  } else {
    checks.push({ id: "body-len", label: "Body Content", status: "pass", detail: "Body has sufficient text content.", deduction: 0 });
  }

  // 7. Unsubscribe link
  const hasUnsub = /unsubscribe/i.test(body);
  if (hasUnsub) {
    checks.push({ id: "unsub", label: "Unsubscribe Link", status: "pass", detail: "Unsubscribe mention detected. This is a positive signal for email providers.", deduction: 0 });
  } else {
    score -= 5;
    checks.push({ id: "unsub", label: "Unsubscribe Link", status: "warning", detail: "No unsubscribe option detected. Required by CAN-SPAM and improves deliverability.", deduction: 5 });
  }

  // 8. Personalization tokens
  const mergeFields = body.match(MERGE_FIELD_REGEX) || [];
  if (mergeFields.length > 0) {
    checks.push({ id: "personalization", label: "Personalization", status: "pass", detail: `${mergeFields.length} personalization token(s) detected (e.g. ${mergeFields[0]}). Personalized emails see higher engagement.`, deduction: 0 });
  } else {
    checks.push({ id: "personalization", label: "Personalization", status: "warning", detail: "No personalization tokens detected. Adding {{name}} or {{company}} improves open rates.", deduction: 0 });
  }

  return { score: Math.max(0, score), checks };
}

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 80 ? "text-green-500" : score >= 50 ? "text-amber-500" : "text-red-500";
  const bgColor = score >= 80 ? "stroke-green-500" : score >= 50 ? "stroke-amber-500" : "stroke-red-500";
  const trackColor = "stroke-gray-200 dark:stroke-gray-700";
  const label = score >= 80 ? "Low Risk" : score >= 50 ? "Medium Risk" : "High Risk";
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-36 w-36">
        <svg className="h-36 w-36 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" strokeWidth="8" className={trackColor} />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className={bgColor}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${color}`}>{score}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">/100</span>
        </div>
      </div>
      <p className={`mt-2 text-sm font-semibold ${color}`}>{label}</p>
    </div>
  );
}

function CheckItem({ check }: { check: CheckResult }) {
  const icons = {
    pass: (
      <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    fail: (
      <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  const bgColors = {
    pass: "bg-green-50 border-green-100 dark:bg-green-900/20 dark:border-green-900/40",
    warning: "bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/40",
    fail: "bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-900/40",
  };

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 ${bgColors[check.status]}`}>
      <div className="mt-0.5 shrink-0">{icons[check.status]}</div>
      <div>
        <p className="font-medium text-gray-900 dark:text-white">{check.label}</p>
        <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{check.detail}</p>
      </div>
      {check.deduction > 0 && (
        <span className="ml-auto shrink-0 text-sm font-medium text-red-500">-{check.deduction}</span>
      )}
    </div>
  );
}

const faqItems = [
  {
    q: "What triggers spam filters?",
    a: "Spam filters look at multiple signals: trigger words (FREE, ACT NOW), excessive capitalization, too many links, missing unsubscribe links, poor sender reputation, and lack of authentication (SPF/DKIM/DMARC). A single issue rarely causes problems, but multiple red flags together will land you in spam.",
  },
  {
    q: "How accurate is this spam score?",
    a: "This tool checks your email content against the most common spam filter rules. However, deliverability also depends on your sender reputation, domain authentication, and recipient engagement history. Use this alongside our Email Deliverability Checker for a complete picture.",
  },
  {
    q: "What is a good spam score?",
    a: "Aim for 80 or above. Scores between 50-79 mean your email has some issues that could hurt deliverability. Below 50 means your email has major spam signals and is likely to be filtered.",
  },
  {
    q: "Do personalization tokens help deliverability?",
    a: "Yes. Personalized emails (using the recipient's name, company, etc.) see higher open and reply rates. Email providers track engagement, so higher engagement improves your sender reputation over time.",
  },
  {
    q: "Should I always include an unsubscribe link?",
    a: "Yes, for any bulk or marketing email. It is required by CAN-SPAM (US), GDPR (EU), and CASL (Canada). Even for cold outreach, including an unsubscribe option is a positive signal to spam filters and shows professionalism.",
  },
];

export default function SpamScoreTester() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<{ score: number; checks: CheckResult[] } | null>(null);

  function handleCheck() {
    if (subject.trim().length === 0 && body.trim().length === 0) return;
    setResult(analyzeSpam(subject.trim(), body.trim()));
  }

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
            <span className="text-gray-500 dark:text-gray-400">Spam Score Tester</span>
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Free Email Spam Score Tester - Check Before You Send
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            Paste your email subject and body to instantly check for spam trigger
            words, formatting issues, and deliverability red flags. Fix problems
            before they reach a spam filter.
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Free, no signup required. Results are instant and never stored.
          </p>

          <div className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Subject Line
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter your email subject line"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-all placeholder:text-gray-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-600 dark:focus:ring-violet-900/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email Body
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={"Paste your email body here...\n\nInclude any links, merge fields like {{name}}, and your full email content for the most accurate score."}
                rows={10}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-all placeholder:text-gray-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-600 dark:focus:ring-violet-900/30"
              />
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleCheck}
              disabled={subject.trim().length === 0 && body.trim().length === 0}
              className="rounded-full bg-violet-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-violet-200 transition-all hover:bg-violet-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-violet-900/30"
            >
              Check Spam Score
            </button>
          </div>
        </div>
      </section>

      {/* Results */}
      {result && (
        <section className="bg-white px-6 py-16 dark:bg-gray-900">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 flex flex-col items-center">
              <ScoreGauge score={result.score} />
            </div>

            <div className="space-y-3">
              {result.checks.map((check) => (
                <CheckItem key={check.id} check={check} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Banner */}
      <section className="bg-gradient-to-r from-violet-600 to-purple-700 px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-white">
            Send Spam-Free Campaigns That Land in the Inbox
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-violet-100">
            Mailmark gives you built-in deliverability monitoring, domain
            authentication, and inbox warming so your emails reach the inbox
            every time. All powered by AWS SES.
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
