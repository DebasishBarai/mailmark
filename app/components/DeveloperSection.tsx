"use client";

import { useState, type ReactNode } from "react";
import SectionHeader from "./SectionHeader";

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

// Token colors from the design's code panel. They are fixed rather than themed:
// the panel is dark under every theme, and these warm hues belong to the same
// paper/ink family as the rest of the page.
const TOKEN_CLASS = {
  comment: "italic text-[#6f6959]",
  string: "text-[#9fbf8c]",
  keyword: "text-[#e39d7c]",
  fn: "text-[#dcc98a]",
} as const;

const TOKEN_KINDS = ["comment", "string", "keyword", "fn"] as const;

// A deliberately small highlighter. The two snippets are fixed and short, so
// this covers exactly the syntax they use rather than pulling a highlighting
// dependency into the bundle for one panel.
//
// Written with numbered groups and no lookbehind, because the project targets
// below ES2018 and Safari only gained lookbehind in 16.4.
//
// The leading URL alternative captures nothing, so it is emitted as plain text,
// but it consumes the https:// in the cURL snippet before the comment rule can
// mistake those slashes for a line comment. The keyword rule refuses a
// following colon, so the object key `from:` stays a plain key while the `from`
// of an import stays a keyword.
const TOKEN_PATTERN = new RegExp(
  [
    "[a-z][a-z0-9+.-]*://\\S*",
    "(//[^\\n]*)",
    "('[^'\\n]*'|\"[^\"\\n]*\")",
    "\\b(import|from|const|await|new|export|return|async|function|let)\\b(?!\\s*:)",
    "\\b([A-Za-z_$][\\w$]*)(?=\\()",
  ].join("|"),
  "g"
);

function highlight(source: string): ReactNode[] {
  const out: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  TOKEN_PATTERN.lastIndex = 0;
  while ((match = TOKEN_PATTERN.exec(source)) !== null) {
    const kindIndex = TOKEN_KINDS.findIndex(
      (_, i) => match?.[i + 1] !== undefined
    );
    // No capture group matched: this is the URL guard, so leave it as plain
    // text by not advancing the cursor past it.
    if (kindIndex === -1) continue;

    if (match.index > cursor) out.push(source.slice(cursor, match.index));
    out.push(
      <span key={key++} className={TOKEN_CLASS[TOKEN_KINDS[kindIndex]]}>
        {match[0]}
      </span>
    );
    cursor = match.index + match[0].length;
  }

  if (cursor < source.length) out.push(source.slice(cursor));
  return out;
}

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
    <section id="developers" className="bg-gray-50 px-6 py-24 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl">
        {/* Old eyebrow: a "For developers" pill badge */}
        {/* Old headline: Send email straight from your code */}
        <SectionHeader
          index="05"
          label="For your code"
          title="Send email straight from your apps"
          subtitle={
            <>
              One API key per domain, scoped to that product. Transactional and
              campaign sends hit the same endpoint, from the same reputation
              you&rsquo;ve been warming.
            </>
          }
        />
        <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Copy */}
          <div>
            <div className="rounded-lg bg-gray-900 px-4 py-3 font-mono text-sm text-gray-100 dark:bg-gray-950">
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
            <pre className="overflow-x-auto p-5 text-xs leading-relaxed text-[#e7e1d5]">
              <code>{highlight(SNIPPETS[tab])}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
