import Link from "next/link";

const codeSnippet = `import { Mailmark } from 'mailmark-sdk';

const mm = new Mailmark(process.env.MAILMARK_API_KEY);

// Fire a welcome email the moment someone signs up
await mm.send({
  from: 'founder@yourco.com',
  to: ['new.user@example.com'],
  subject: 'Welcome to v2',
  html: '<h1>v2 is live</h1><p>Here is what is new...</p>',
  type: 'campaign',
});`;

const capabilities = [
  {
    title: "Transactional + campaign sends",
    description: "One /v1/send call. Send a single transactional email, or an individually tracked email to every recipient under a shared batch.",
  },
  {
    title: "Scheduled + automated sequences",
    description: "Queue sends for later, or drive multi-step onboarding sequences with merge fields, all from the API.",
  },
  {
    title: "Domain-scoped API keys",
    description: "Give each product its own key, scoped to its domain. One key can't touch another product's mail.",
  },
  {
    title: "Deliverability data, programmatically",
    description: "Pull domain health, warmup status, bounce stats, and suppression lists so your own dashboards stay in sync.",
  },
];

export default function DeveloperAPI() {
  return (
    <section
      id="developers"
      className="border-b-2 border-black bg-pale-violet px-6 py-24"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Text */}
          <div>
            <span className="mb-4 inline-block rounded-full border-2 border-black bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-black">
              REST API + npm SDK
            </span>
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-black md:text-4xl">
              Send email straight from your code.
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-black/80">
              A dashboard is not enough when you are a developer. You need to
              fire a welcome email when someone signs up and a receipt when they
              pay. Mailmark ships a REST API and a typed npm SDK so any of your
              products can send in a few lines.
            </p>

            <ul className="mt-8 space-y-4">
              {capabilities.map((c) => (
                <li key={c.title} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-black bg-aquamarine text-black">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </span>
                  <span className="text-sm text-black">
                    <span className="font-extrabold">{c.title}.</span>{" "}
                    <span className="text-black/70">{c.description}</span>
                  </span>
                </li>
              ))}
            </ul>

            <Link
              href="/docs/api"
              className="mt-8 inline-flex items-center gap-2 rounded-md border-2 border-black bg-coral px-6 py-3 text-sm font-bold text-black shadow-[4px_4px_0px_#000] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#000]"
            >
              Read the API docs
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>

          {/* Code block */}
          <div className="rounded-xl border-2 border-black bg-white shadow-[8px_8px_0px_#000]">
            <div className="flex items-center gap-2 border-b-2 border-black bg-vivid-yellow px-4 py-3">
              <div className="h-3 w-3 rounded-full border border-black bg-coral" />
              <div className="h-3 w-3 rounded-full border border-black bg-vivid-yellow" />
              <div className="h-3 w-3 rounded-full border border-black bg-aquamarine" />
              <span className="ml-2 font-mono text-xs font-bold text-black">
                send-welcome.ts
              </span>
              <span className="ml-auto rounded border border-black bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-black">
                npm i mailmark-sdk
              </span>
            </div>
            <pre className="overflow-x-auto bg-[#0d0d0d] p-5 text-xs leading-relaxed text-gray-100">
              <code>{codeSnippet}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
