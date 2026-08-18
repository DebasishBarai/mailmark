const showcaseItems = [
  {
    title: "Add your product domains",
    description:
      "Point acme.com, yourco.com, and every other product at Mailmark. It walks you through DNS step by step and verifies MX, SPF, DKIM, and DMARC so each domain is ready to send.",
    bullets: [
      "Guided DNS setup for every domain",
      "Auto-verify MX, SPF, DKIM & DMARC",
      "One place for all ten of them",
    ],
    visual: (
      <div className="space-y-3">
        <div className="rounded-lg border-2 border-black bg-white p-4">
          <p className="text-xs font-bold text-black">Add a domain</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 rounded-md border-2 border-black bg-white px-3 py-2 text-sm text-black">
              acme.com
            </div>
            <div className="rounded-md border-2 border-black bg-coral px-4 py-2 text-xs font-bold text-black shadow-[2px_2px_0px_#000]">
              Verify
            </div>
          </div>
        </div>
        <div className="rounded-lg border-2 border-black bg-white p-4">
          <p className="mb-2 text-xs font-bold text-black">DNS Records</p>
          <div className="space-y-1.5">
            {[
              { type: "MX", status: true },
              { type: "SPF", status: true },
              { type: "DKIM", status: true },
              { type: "DMARC", status: false },
            ].map((r) => (
              <div key={r.type} className="flex items-center justify-between text-xs">
                <span className="font-mono font-semibold text-black">{r.type}</span>
                <span className={`rounded-full border border-black px-2 py-0.5 text-[10px] font-bold text-black ${r.status ? "bg-aquamarine" : "bg-vivid-yellow"}`}>
                  {r.status ? "Verified" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    panel: "bg-aquamarine",
  },
  {
    title: "Create mailboxes per product",
    description:
      "Spin up founder@, support@, and updates@ on any of your domains. Each mailbox has its own inbox, and you switch between all of them without logging in and out of anything.",
    bullets: [
      "One-click mailbox creation",
      "Per-mailbox sender signatures",
      "Every product's inbox in one login",
    ],
    visual: (
      <div className="rounded-lg border-2 border-black bg-white p-4">
        <p className="mb-3 text-xs font-bold text-black">Your Mailboxes</p>
        {[
          { email: "founder@yourco.com", count: 24, active: true },
          { email: "support@acme.com", count: 8, active: false },
          { email: "updates@yourco.com", count: 3, active: false },
          { email: "hello@thirdapp.com", count: 1, active: false },
        ].map((mb) => (
          <div key={mb.email} className={`mb-1.5 flex items-center justify-between rounded-md border-2 border-black px-3 py-2 text-xs ${mb.active ? "bg-lavender-rose" : "bg-white"}`}>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full border border-black ${mb.active ? "bg-coral" : "bg-white"}`} />
              <span className={mb.active ? "font-bold text-black" : "font-semibold text-black/70"}>{mb.email}</span>
            </div>
            <span className="rounded-full border border-black bg-white px-1.5 py-0.5 text-[10px] font-bold text-black">{mb.count}</span>
          </div>
        ))}
        <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-black">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Add mailbox
        </div>
      </div>
    ),
    panel: "bg-lavender-rose",
  },
  {
    title: "One inbox for every reply",
    description:
      "When users reply, it all lands in a familiar email UI: Inbox, Sent, Outbox, Drafts, and Trash. Read, respond, and search across every product without a dozen browser tabs.",
    bullets: [
      "Gmail-style inbox for every mailbox",
      "Rich composer with attachments",
      "Full-text search across all mail",
    ],
    visual: (
      <div className="rounded-lg border-2 border-black bg-white">
        <div className="flex items-center gap-2 border-b-2 border-black bg-vivid-yellow px-3 py-2">
          <div className="flex gap-1">
            <div className="h-2 w-2 rounded-full border border-black bg-coral" />
            <div className="h-2 w-2 rounded-full border border-black bg-vivid-yellow" />
            <div className="h-2 w-2 rounded-full border border-black bg-aquamarine" />
          </div>
          <span className="text-[10px] font-bold text-black">support@acme.com</span>
        </div>
        <div className="flex">
          <div className="w-20 border-r-2 border-black p-2">
            {["Inbox", "Sent", "Outbox", "Drafts", "Trash"].map((f, i) => (
              <div key={f} className={`rounded px-2 py-1 text-[9px] font-semibold ${i === 0 ? "border-2 border-black bg-aquamarine text-black" : "text-black/60"}`}>{f}</div>
            ))}
          </div>
          <div className="flex-1 space-y-1 p-2">
            {[
              { from: "Early user", subj: "Loving the v2 update", bold: true },
              { from: "Trial signup", subj: "Re: Billing question", bold: true },
              { from: "Customer", subj: "Thanks for the quick fix!", bold: false },
            ].map((e) => (
              <div key={e.subj} className={`rounded border-2 border-black px-2 py-1.5 ${e.bold ? "bg-aquamarine/40" : "bg-white"}`}>
                <p className={`text-[10px] ${e.bold ? "font-bold text-black" : "font-semibold text-black/70"}`}>{e.from}</p>
                <p className="truncate text-[9px] text-black/60">{e.subj}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    panel: "bg-aquamarine",
  },
  {
    title: "Email your users, privately",
    description:
      "Upload or sync your list, personalize with merge tags, and send. Every recipient gets an individual email with no visible CC or BCC, so \"v2 is live\" reaches your whole user base and still feels one to one.",
    bullets: [
      "Mail merge from CSV or Google Sheets",
      "Individual sends, never a visible blast",
      "Real-time open, click & reply tracking",
    ],
    visual: (
      <div className="space-y-2">
        <div className="rounded-lg border-2 border-black bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-black">Campaign: v2 Launch</p>
            <span className="rounded-full border border-black bg-aquamarine px-2 py-0.5 text-[10px] font-bold text-black">Sending</span>
          </div>
          <p className="mt-1 text-[10px] font-semibold text-black/60">From: updates@yourco.com</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[
              { label: "Sent", value: "1,842" },
              { label: "Opened", value: "811" },
              { label: "Clicked", value: "254" },
              { label: "Replied", value: "63" },
            ].map((s) => (
              <div key={s.label} className="rounded-md border-2 border-black bg-white p-2 text-center">
                <p className="text-sm font-extrabold text-black">{s.value}</p>
                <p className="text-[9px] font-semibold text-black/60">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border-2 border-black bg-white p-4">
          <p className="mb-2 text-xs font-bold text-black">Merged Preview</p>
          <div className="rounded-md border-2 border-black bg-champagne px-3 py-2 text-[10px] text-black">
            Hi <span className="rounded border border-black bg-vivid-yellow px-1 font-bold">{"{{firstName}}"}</span>, v2 is live. Here is what changed...
          </div>
        </div>
      </div>
    ),
    panel: "bg-vivid-yellow",
  },
];

export default function FeatureShowcase() {
  return (
    <section id="how-it-works" className="border-b-2 border-black bg-white px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <span className="mb-4 inline-block rounded-full border-2 border-black bg-coral px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-black">
            How it works
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-black md:text-4xl">
            From ten scattered domains to one dashboard
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-black/70">
            Four steps to bring every product&apos;s email under one roof.
          </p>
        </div>

        <div className="mt-20 flex flex-col gap-24">
          {showcaseItems.map((item, index) => (
            <div
              key={item.title}
              className={`flex flex-col items-center gap-12 md:flex-row ${
                index % 2 === 1 ? "md:flex-row-reverse" : ""
              }`}
            >
              {/* Visual */}
              <div className="w-full md:w-1/2">
                <div className={`rounded-xl border-2 border-black ${item.panel} p-8 shadow-[8px_8px_0px_#000]`}>
                  {item.visual}
                </div>
              </div>

              {/* Text */}
              <div className="w-full md:w-1/2">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md border-2 border-black bg-vivid-yellow text-base font-extrabold text-black shadow-[3px_3px_0px_#000]">
                  {index + 1}
                </div>
                <h3 className="text-2xl font-extrabold text-black">
                  {item.title}
                </h3>
                <p className="mt-4 text-base leading-relaxed text-black/70">
                  {item.description}
                </p>
                <ul className="mt-6 space-y-3">
                  {item.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-center gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-black bg-aquamarine">
                        <svg
                          className="h-3 w-3 text-black"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={3}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 12.75l6 6 9-13.5"
                          />
                        </svg>
                      </span>
                      <span className="text-sm font-medium text-black">{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
