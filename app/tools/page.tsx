import type { Metadata } from "next";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "Free Email Tools",
  description:
    "Free tools to improve your email deliverability, reduce costs, and write better cold emails. No signup required.",
};

const tools = [
  {
    title: "Email Deliverability Checker",
    description:
      "Check your domain's SPF, DKIM, DMARC records, blacklist status, and get an overall health score. Instant results, no signup required.",
    href: "/tools/email-deliverability-checker",
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
      </svg>
    ),
    available: true,
  },
  {
    title: "SES Savings Calculator",
    description:
      "Find out how much you could save by switching from your current email provider to AWS SES with Mailmark.",
    href: "/tools/ses-savings-calculator",
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
        />
      </svg>
    ),
    available: true,
  },
  {
    title: "Cold Email Subject Line Generator",
    description:
      "Generate high-converting cold email subject lines using AI. Powered by Claude, tailored to your industry and offer.",
    href: "/tools/subject-line-generator",
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
        />
      </svg>
    ),
    available: true,
  },
  {
    title: "Cold Email Lead Finder",
    description:
      "Find verified B2B leads by industry, job title, and company size. Export and start emailing in minutes.",
    href: "/tools/lead-finder",
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
        />
      </svg>
    ),
    available: true,
  },
];

export default function ToolsPage() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <Header />

      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-20 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Free Email Tools
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-300">
            Everything you need to improve your email deliverability and cold
            outreach. No signup required.
          </p>
        </div>
      </section>

      <section className="bg-white px-6 py-16 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-6 sm:grid-cols-2">
            {tools.map((tool) => (
              <div key={tool.title} className="relative">
                {tool.available ? (
                  <Link
                    href={tool.href}
                    className="group flex h-full flex-col rounded-2xl border border-gray-100 bg-gray-50 p-8 transition-all hover:border-violet-200 hover:bg-violet-50 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-violet-700 dark:hover:bg-violet-900/20"
                  >
                    <div className="inline-flex self-start rounded-xl bg-violet-100 p-3 text-violet-600 group-hover:bg-violet-200 dark:bg-violet-900/40 dark:text-violet-400">
                      {tool.icon}
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                      {tool.title}
                    </h2>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                      {tool.description}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-violet-600 dark:text-violet-400">
                      Try it free
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.25 4.5l7.5 7.5-7.5 7.5"
                        />
                      </svg>
                    </span>
                  </Link>
                ) : (
                  <div className="flex h-full flex-col rounded-2xl border border-gray-100 bg-gray-50 p-8 opacity-60 dark:border-gray-700 dark:bg-gray-800">
                    <div className="inline-flex self-start rounded-xl bg-gray-200 p-3 text-gray-400 dark:bg-gray-700 dark:text-gray-500">
                      {tool.icon}
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                      {tool.title}
                    </h2>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                      {tool.description}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-gray-400 dark:text-gray-500">
                      Coming soon
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
