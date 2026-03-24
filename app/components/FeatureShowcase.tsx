const showcaseItems = [
  {
    title: "Connect Your Domain",
    description:
      "Add your own domain so campaigns go out from addresses your recipients recognize. Mailmark walks you through DNS setup step by step, including MX, SPF, DKIM, and DMARC for maximum deliverability.",
    bullets: [
      "Guided DNS configuration wizard",
      "Auto-verify MX, SPF, DKIM & DMARC",
      "Campaign-ready deliverability from day one",
    ],
    visual: (
      <div className="space-y-3">
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-700">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Add your domain</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-600 dark:text-gray-200">
              yourcompany.com
            </div>
            <div className="rounded-md bg-violet-600 px-4 py-2 text-xs font-semibold text-white">
              Verify
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-700">
          <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">DNS Records</p>
          <div className="space-y-1.5">
            {[
              { type: "MX", status: true },
              { type: "SPF", status: true },
              { type: "DKIM", status: true },
              { type: "DMARC", status: false },
            ].map((r) => (
              <div key={r.type} className="flex items-center justify-between text-xs">
                <span className="font-mono text-gray-600 dark:text-gray-400">{r.type}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${r.status ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"}`}>
                  {r.status ? "Verified" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    gradient: "from-green-100 via-emerald-50 to-teal-100 dark:from-green-950/50 dark:via-emerald-950/50 dark:to-teal-950/50",
  },
  {
    title: "Create Sender Mailboxes",
    description:
      "Spin up dedicated mailboxes for each campaign type: outreach@, sales@, newsletters@. Each has its own inbox to manage replies. Switch between them instantly.",
    bullets: [
      "One-click mailbox creation",
      "Per-mailbox sender signatures",
      "Separate inboxes for campaign replies",
    ],
    visual: (
      <div className="space-y-2">
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-700">
          <p className="mb-3 text-xs font-semibold text-gray-700 dark:text-gray-300">Your Mailboxes | yourcompany.com</p>
          {[
            { email: "sales@yourcompany.com", count: 24, active: true },
            { email: "support@yourcompany.com", count: 8, active: false },
            { email: "info@yourcompany.com", count: 3, active: false },
            { email: "ceo@yourcompany.com", count: 1, active: false },
          ].map((mb) => (
            <div key={mb.email} className={`mb-1.5 flex items-center justify-between rounded-md px-3 py-2 text-xs ${mb.active ? "bg-violet-50 ring-1 ring-violet-200 dark:bg-violet-900/30 dark:ring-violet-700" : "bg-gray-50 dark:bg-gray-600"}`}>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${mb.active ? "bg-violet-500" : "bg-gray-300 dark:bg-gray-500"}`} />
                <span className={mb.active ? "font-semibold text-violet-700 dark:text-violet-300" : "text-gray-600 dark:text-gray-400"}>{mb.email}</span>
              </div>
              <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-gray-500 dark:text-gray-300">{mb.count}</span>
            </div>
          ))}
          <div className="mt-2 flex items-center gap-1 text-[10px] text-violet-600 dark:text-violet-400">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            Add mailbox
          </div>
        </div>
      </div>
    ),
    gradient: "from-violet-100 via-purple-50 to-fuchsia-100 dark:from-violet-950/50 dark:via-purple-950/50 dark:to-fuchsia-950/50",
  },
  {
    title: "Manage Replies in One Place",
    description:
      "Every campaign reply lands in a familiar email UI: Inbox, Sent, Outbox, Drafts, and Trash. Respond to leads, manage conversations, and search across everything.",
    bullets: [
      "Gmail-like inbox for campaign replies",
      "Rich text composer with attachments",
      "Full-text search across all mail",
    ],
    visual: (
      <div className="rounded-lg bg-white shadow-sm dark:bg-gray-700">
        <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-600">
          <div className="flex gap-1">
            <div className="h-2 w-2 rounded-full bg-red-400" />
            <div className="h-2 w-2 rounded-full bg-yellow-400" />
            <div className="h-2 w-2 rounded-full bg-green-400" />
          </div>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">support@yourcompany.com</span>
        </div>
        <div className="flex">
          <div className="w-20 border-r border-gray-100 p-2 dark:border-gray-600">
            {["Inbox", "Sent", "Outbox", "Drafts", "Trash"].map((f, i) => (
              <div key={f} className={`rounded px-2 py-1 text-[9px] ${i === 0 ? "bg-violet-50 font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" : "text-gray-500 dark:text-gray-400"}`}>{f}</div>
            ))}
          </div>
          <div className="flex-1 space-y-1 p-2">
            {[
              { from: "Client A", subj: "Need help with setup", bold: true },
              { from: "Client B", subj: "Re: Billing question", bold: true },
              { from: "Client C", subj: "Thanks for the quick fix!", bold: false },
            ].map((e) => (
              <div key={e.subj} className={`rounded border px-2 py-1.5 ${e.bold ? "border-violet-100 bg-violet-50/30 dark:border-violet-800/50 dark:bg-violet-900/20" : "border-gray-100 dark:border-gray-600"}`}>
                <p className={`text-[10px] ${e.bold ? "font-semibold text-gray-800 dark:text-gray-200" : "text-gray-600 dark:text-gray-400"}`}>{e.from}</p>
                <p className="truncate text-[9px] text-gray-500 dark:text-gray-400">{e.subj}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    gradient: "from-blue-100 via-sky-50 to-cyan-100 dark:from-blue-950/50 dark:via-sky-950/50 dark:to-cyan-950/50",
  },
  {
    title: "Launch and Track Campaigns",
    description:
      "Pick a sender mailbox, upload your contact list, personalize with merge tags, and launch. Set up automated follow-up sequences and track opens, clicks, and replies in real time.",
    bullets: [
      "Mail merge with CSV or Google Sheets",
      "Multi-stage automated follow-ups",
      "Real-time open, click & reply tracking",
    ],
    visual: (
      <div className="space-y-2">
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-700">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Campaign: Product Launch</p>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">Sending</span>
          </div>
          <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">From: sales@yourcompany.com</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[
              { label: "Sent", value: "1,247" },
              { label: "Opened", value: "623" },
              { label: "Clicked", value: "184" },
              { label: "Replied", value: "47" },
            ].map((s) => (
              <div key={s.label} className="rounded-md bg-gray-50 p-2 text-center dark:bg-gray-600">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{s.value}</p>
                <p className="text-[9px] text-gray-500 dark:text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-700">
          <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">Follow-up Sequence</p>
          <div className="flex items-center gap-2">
            {["Stage 1", "Stage 2", "Stage 3"].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`rounded-full px-2 py-1 text-[10px] font-medium ${i < 2 ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" : "bg-gray-100 text-gray-500 dark:bg-gray-600 dark:text-gray-400"}`}>{s}</div>
                {i < 2 && <svg className="h-3 w-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    gradient: "from-amber-100 via-orange-50 to-yellow-100 dark:from-amber-950/50 dark:via-orange-950/50 dark:to-yellow-950/50",
  },
];

export default function FeatureShowcase() {
  return (
    <section id="how-it-works" className="bg-gray-50 px-6 py-24 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
            How Mailmark works
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
            From domain setup to your first campaign in four simple steps.
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
                <div className={`rounded-2xl bg-gradient-to-br ${item.gradient} p-8 shadow-lg`}>
                  {item.visual}
                </div>
              </div>

              {/* Text */}
              <div className="w-full md:w-1/2">
                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
                  {index + 1}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-gray-400">
                  {item.description}
                </p>
                <ul className="mt-6 space-y-3">
                  {item.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-center gap-3">
                      <svg
                        className="h-5 w-5 shrink-0 text-violet-600"
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
                      <span className="text-sm text-gray-700 dark:text-gray-300">{bullet}</span>
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
