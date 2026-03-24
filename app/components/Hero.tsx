import CTAButton from "./CTAButton";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-violet-50 to-white px-6 py-24 dark:from-violet-950/30 dark:to-gray-900 md:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-12 md:grid-cols-2">
          {/* Text */}
          <div className="flex flex-col items-center text-center md:items-start md:text-left">
            <span className="mb-4 inline-block rounded-full bg-violet-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
              Email Campaign Platform
            </span>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-gray-900 dark:text-white md:text-5xl lg:text-6xl">
              Send campaigns{" "}
              <span className="text-violet-600">that land in inboxes,</span>{" "}
              not spam.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-gray-600 dark:text-gray-400">
              Run email campaigns from your own domain with built-in
              mail merge, automated follow-ups, and real-time analytics.
              Connect your domain, create sender mailboxes, and start
              reaching inboxes in minutes.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <CTAButton className="inline-flex items-center justify-center gap-2 rounded-full bg-violet-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-200 transition-all hover:bg-violet-700 hover:shadow-xl dark:shadow-violet-900/30">
                Start Free Trial
              </CTAButton>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-full border border-gray-300 px-8 py-3.5 text-base font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                See How It Works
              </a>
            </div>
            <p className="mt-8 text-sm font-medium text-gray-500 dark:text-gray-400">
              Built-in deliverability.{" "}
              <span className="text-gray-800 dark:text-gray-200">No third-party tools needed.</span>
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
                  Mailmark | sales@yourco.com
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
                      Mailboxes
                    </p>
                    <div className="space-y-1">
                      {["sales@yourco.com", "support@yourco.com", "info@yourco.com"].map(
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
                        from: "Campaign: Welcome Series",
                        subject: "Stage 2 sent, 847 recipients",
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
