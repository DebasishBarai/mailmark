import CTAButton from "./CTAButton";

export default function Hero() {
  // Old background: bg-gradient-to-b from-violet-50 to-white
  // dark:from-violet-950/30 dark:to-gray-900. Replaced with the flat base
  // paper tone (gray-50, #ece7df) so the hero matches the page.
  return (
    <section className="relative overflow-hidden bg-gray-50 px-6 py-24 dark:bg-gray-900 md:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-12 md:grid-cols-2">
          {/* Text */}
          <div className="flex flex-col items-center text-center md:items-start md:text-left">
            {/* Old badge: Email Campaign Platform */}
            <span className="mb-4 inline-block rounded-full bg-violet-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              Built for multi-product developers
            </span>
            {/* Old headline: Send campaigns that land in inboxes, not spam. */}
            {/* Old headline: One dashboard for every product's email. */}
            <h1 className="font-display text-4xl leading-[1.06] text-gray-900 dark:text-white md:text-5xl lg:text-6xl">
              One email system for{" "}
              <em className="italic text-violet-600">every</em> product you
              ship.
            </h1>
            {/* Old subhead: Run email campaigns from your own domain... */}
            {/* Old subhead: Stop juggling ten domains, dozens of mailboxes... */}
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-gray-600 dark:text-gray-400">
              Every app needs its own domain. Every domain needs its own
              mailboxes just to talk to users. Run four products and you&rsquo;re
              maintaining{" "}
              <strong className="font-semibold text-gray-900 dark:text-gray-100">
                four domains, a dozen mailboxes, and five separate tools
              </strong>
              , before you&rsquo;ve sent a single email. Mailmark is all of it,
              once.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <CTAButton className="inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-200 transition-all hover:bg-violet-700 hover:shadow-xl dark:shadow-violet-900/30">
                Start Building Free
              </CTAButton>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-full border border-gray-300 px-8 py-3.5 text-base font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                See How It Works
              </a>
            </div>
            {/* Old line: Built-in deliverability. No third-party tools needed. */}
            <p className="mt-8 text-sm font-medium text-gray-500 dark:text-gray-400">
              One login for every product.{" "}
              <span className="text-gray-800 dark:text-gray-200">No more tool sprawl.</span>
            </p>
          </div>

          {/* Hero visual - email UI mockup */}
          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
              {/* Title bar */}
              <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
                <span className="ml-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                  Mailmark | all your products
                </span>
              </div>
              <div className="flex">
                {/* Sidebar */}
                <div className="hidden w-48 border-r border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900 sm:block">
                  <div className="mb-3 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white">
                    Compose
                  </div>
                  <div className="space-y-1">
                    {["Inbox", "Sent", "Outbox", "Drafts", "Campaigns"].map(
                      (item, i) => (
                        <div
                          key={item}
                          className={`flex items-center justify-between rounded-md px-3 py-1.5 text-xs ${
                            i === 0
                              ? "bg-violet-50 font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                              : "text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          <span>{item}</span>
                          {i === 0 && (
                            <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] text-white">
                              12
                            </span>
                          )}
                        </div>
                      )
                    )}
                  </div>
                  <div className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
                    <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      Your products
                    </p>
                    <div className="space-y-1">
                      {["hello@app-one.com", "support@app-two.io", "team@app-three.co"].map(
                        (mb, i) => (
                          <div
                            key={mb}
                            className={`truncate rounded-md px-2 py-1 text-[10px] ${
                              i === 0
                                ? "bg-violet-50 font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                                : "text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            {mb}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
                {/* Email list */}
                <div className="flex-1 p-3">
                  <div className="space-y-2">
                    {[
                      {
                        from: "John Smith",
                        subject: "Re: Partnership proposal",
                        preview: "Sounds great, let's schedule a call...",
                        time: "2m",
                        unread: true,
                      },
                      {
                        from: "Emily Davis",
                        subject: "Campaign results Q4",
                        preview: "Here are the numbers from last...",
                        time: "1h",
                        unread: true,
                      },
                      {
                        from: "Alex Turner",
                        subject: "Invoice #1042",
                        preview: "Please find attached the invoice...",
                        time: "3h",
                        unread: false,
                      },
                      {
                        from: "Campaign: v2.0 is live",
                        subject: "Sent to 1,284 users on app-one.com",
                        preview: "Open rate: 42% · Click rate: 12%...",
                        time: "5h",
                        unread: false,
                      },
                    ].map((email) => (
                      <div
                        key={email.subject}
                        className={`rounded-lg border px-3 py-2 ${
                          email.unread
                            ? "border-violet-100 bg-violet-50/50 dark:border-violet-800/50 dark:bg-violet-900/20"
                            : "border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs ${email.unread ? "font-semibold text-gray-900 dark:text-gray-100" : "text-gray-600 dark:text-gray-400"}`}
                          >
                            {email.from}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {email.time}
                          </span>
                        </div>
                        <p
                          className={`text-xs ${email.unread ? "font-medium text-gray-800 dark:text-gray-200" : "text-gray-600 dark:text-gray-400"}`}
                        >
                          {email.subject}
                        </p>
                        <p className="truncate text-[10px] text-gray-400 dark:text-gray-500">
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
