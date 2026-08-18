import CTAButton from "./CTAButton";

const brutalBtn =
  "inline-flex items-center justify-center gap-2 rounded-md border-2 border-black bg-coral px-8 py-3.5 text-base font-bold text-black shadow-[4px_4px_0px_#000] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#000]";

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b-2 border-black bg-champagne px-6 py-20 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-12 md:grid-cols-2">
          {/* Text */}
          <div className="flex flex-col items-center text-center md:items-start md:text-left">
            <span className="mb-5 inline-block rounded-full border-2 border-black bg-pale-violet px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-black">
              Built for solo founders running multiple products
            </span>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-black md:text-5xl lg:text-6xl">
              Stop juggling ten tools just to{" "}
              <span className="relative inline-block">
                <span className="relative z-10">email your users.</span>
                <span className="absolute inset-x-0 bottom-1 z-0 h-4 -rotate-1 bg-vivid-yellow" />
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-black/80">
              Every product you ship needs its own domain and mailboxes just to
              talk to users. Across ten apps that is ten domains and dozens of
              inboxes spread over five disconnected tools. Mailmark puts every
              domain, every mailbox, campaign sends, and a send API in one
              dashboard.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <CTAButton className={brutalBtn}>Start Free Trial</CTAButton>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-md border-2 border-black bg-white px-8 py-3.5 text-base font-bold text-black shadow-[4px_4px_0px_#000] transition-all hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_#000]"
              >
                See How It Works
              </a>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-x-2 gap-y-1 text-sm font-semibold text-black md:justify-start">
              <span>Multi-domain</span>
              <span className="text-black/40">/</span>
              <span>Campaigns with mail merge</span>
              <span className="text-black/40">/</span>
              <span>REST API + npm SDK</span>
              <span className="text-black/40">/</span>
              <span>Built-in deliverability</span>
            </div>
          </div>

          {/* Hero visual - email UI mockup */}
          <div className="relative">
            <div className="overflow-hidden rounded-xl border-2 border-black bg-white shadow-[8px_8px_0px_#000]">
              {/* Title bar */}
              <div className="flex items-center gap-2 border-b-2 border-black bg-vivid-yellow px-4 py-3">
                <div className="h-3 w-3 rounded-full border border-black bg-coral" />
                <div className="h-3 w-3 rounded-full border border-black bg-vivid-yellow" />
                <div className="h-3 w-3 rounded-full border border-black bg-aquamarine" />
                <span className="ml-3 text-xs font-bold text-black">
                  Mailmark | 3 products, 1 dashboard
                </span>
              </div>
              <div className="flex">
                {/* Sidebar */}
                <div className="hidden w-52 border-r-2 border-black bg-champagne p-3 sm:block">
                  <div className="mb-3 rounded-md border-2 border-black bg-coral px-3 py-2 text-center text-xs font-bold text-black shadow-[2px_2px_0px_#000]">
                    Compose
                  </div>
                  <div className="space-y-1">
                    {["Inbox", "Sent", "Outbox", "Drafts", "Campaigns"].map(
                      (item, i) => (
                        <div
                          key={item}
                          className={`flex items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold ${
                            i === 0
                              ? "border-2 border-black bg-aquamarine text-black"
                              : "text-black/70"
                          }`}
                        >
                          <span>{item}</span>
                          {i === 0 && (
                            <span className="rounded-full border border-black bg-white px-1.5 py-0.5 text-[10px] text-black">
                              12
                            </span>
                          )}
                        </div>
                      )
                    )}
                  </div>
                  <div className="mt-4 border-t-2 border-black pt-3">
                    <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-black/50">
                      Mailboxes
                    </p>
                    <div className="space-y-1">
                      {[
                        "founder@yourco.com",
                        "support@acme.com",
                        "updates@yourco.com",
                      ].map((mb, i) => (
                        <div
                          key={mb}
                          className={`truncate rounded-md px-2 py-1 text-[10px] font-semibold ${
                            i === 0
                              ? "border-2 border-black bg-lavender-rose text-black"
                              : "text-black/60"
                          }`}
                        >
                          {mb}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Email list */}
                <div className="flex-1 bg-white p-3">
                  <div className="space-y-2">
                    {[
                      {
                        from: "Campaign: v2 is live",
                        subject: "Sent to 1,842 users",
                        preview: "Open rate: 44% · Individual sends, no BCC...",
                        time: "2m",
                        unread: true,
                      },
                      {
                        from: "Stripe",
                        subject: "New subscription on Acme",
                        preview: "founder@acme.com received a payment...",
                        time: "1h",
                        unread: true,
                      },
                      {
                        from: "API",
                        subject: "welcome email sent via SDK",
                        preview: "POST /v1/send · 202 queued...",
                        time: "3h",
                        unread: false,
                      },
                      {
                        from: "Warming: yourco.com",
                        subject: "Day 21 of 28 · inbox 98%",
                        preview: "Reputation healthy across Gmail + Outlook...",
                        time: "5h",
                        unread: false,
                      },
                    ].map((email) => (
                      <div
                        key={email.subject}
                        className={`rounded-md border-2 border-black px-3 py-2 ${
                          email.unread ? "bg-aquamarine/40" : "bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-black">
                            {email.from}
                          </span>
                          <span className="text-[10px] font-semibold text-black/50">
                            {email.time}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-black/80">
                          {email.subject}
                        </p>
                        <p className="truncate text-[10px] text-black/50">
                          {email.preview}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
