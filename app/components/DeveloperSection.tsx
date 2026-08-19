"use client";

import { useState } from "react";

const SNIPPETS = {
  npm: `import { Mailmark } from 'mailmark-sdk';

const client = new Mailmark(process.env.MAILMARK_API_KEY);

// Transactional: welcome a new signup from your app
await client.send({
  from: 'hello@app-one.com',
  to: [user.email],
  subject: 'Welcome to App One',
  html: '<h1>You are in.</h1><p>Thanks for signing up.</p>',
});

// Campaign: tell every user v2 shipped, one email each
await client.send({
  from: 'hello@app-one.com',
  to: userEmails,
  subject: 'v2.0 is live',
  html: releaseNotesHtml,
  type: 'campaign',
});`,
  curl: `curl -X POST https://api.mailmark.dev/v1/send \\
  -H "Authorization: Bearer dm_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "from": "hello@app-one.com",
    "to": ["user@example.com"],
    "subject": "Welcome to App One",
    "html": "<h1>You are in.</h1>",
    "type": "transactional"
  }'`,
};

const bullets = [
  "One API key per domain, scoped to that product",
  "Transactional sends and campaign sends from the same endpoint",
  "Schedule sends, run sequences, and pull delivery stats programmatically",
  "Fully typed mailmark-sdk package for TypeScript and JavaScript",
];

export default function DeveloperSection() {
  const [tab, setTab] = useState<"npm" | "curl">("npm");
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(SNIPPETS[tab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section id="developers" className="border-t border-gray-200 bg-gray-100 px-6 py-24 dark:border-gray-700 dark:bg-gray-800">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Copy */}
          <div>
            {/* Old eyebrow: a "For developers" pill badge */}
            <div className="mb-6 flex items-center gap-4">
              <span className="font-mono text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                06 / For your code
              </span>
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            </div>
            {/* Old headline: Send email straight from your code */}
            <h2 className="font-display text-3xl text-gray-900 dark:text-white md:text-4xl">
              Send email straight from your apps.
            </h2>
            {/* Old subhead: Every mailbox you create is reachable over a REST API... */}
            <p className="mt-4 text-lg leading-relaxed text-gray-600 dark:text-gray-400">
              One API key per domain, scoped to that product. Transactional and
              campaign sends hit the same endpoint, from the same reputation
              you&rsquo;ve been warming.
            </p>

            <div className="mt-6 rounded-lg bg-gray-900 px-4 py-3 font-mono text-sm text-gray-100 dark:bg-gray-950">
              <span className="text-gray-500">$</span> bun add mailmark-sdk
            </div>

            <ul className="mt-8 space-y-3">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <svg
                    className="mt-0.5 h-5 w-5 shrink-0 text-violet-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{b}</span>
                </li>
              ))}
            </ul>

            <a
              href="/docs/api"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
            >
              Read the API docs
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>

          {/* Code */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-950 shadow-2xl dark:border-gray-700">
            <div className="flex items-center justify-between gap-3 border-b border-gray-800 px-4 py-2.5">
              <div className="hidden shrink-0 gap-1.5 sm:flex">
                <span className="h-2.5 w-2.5 rounded-full bg-gray-100/25" />
                <span className="h-2.5 w-2.5 rounded-full bg-gray-100/25" />
                <span className="h-2.5 w-2.5 rounded-full bg-gray-100/25" />
              </div>
              <div className="mr-auto flex gap-1 rounded-lg bg-gray-800/60 p-1">
                {(["npm", "curl"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      tab === t
                        ? "bg-gray-700 text-white"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {t === "npm" ? "mailmark-sdk" : "cURL"}
                  </button>
                ))}
              </div>
              <button
                onClick={copy}
                className="rounded px-2 py-1 text-xs font-medium text-gray-400 transition-colors hover:text-white"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="overflow-x-auto p-5 text-xs leading-relaxed text-gray-100">
              <code>{SNIPPETS[tab]}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
