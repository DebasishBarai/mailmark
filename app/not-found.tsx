import type { Metadata } from "next";
import Link from "next/link";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { BASE_URL, routesInSection } from "../lib/site/routes";

export const metadata: Metadata = {
  title: "Page not found",
  description:
    "That page does not exist on Mailmark. Here is the sitemap, the docs index, and the machine-readable entry points.",
  robots: { index: false, follow: true },
};

/** The recovery links a person is most likely to want. */
const DESTINATIONS = [
  { href: "/docs", title: "Documentation", desc: "Setup, mailboxes, campaigns, API." },
  { href: "/tools", title: "Free tools", desc: "Deliverability, validation, spam score." },
  { href: "/blog", title: "Blog", desc: "Guides on deliverability and campaigns." },
  { href: "/contact", title: "Contact", desc: "Talk to the team." },
];

/**
 * The same recovery routes, as Markdown, for an agent that lands on a 404 with
 * a wildcard Accept header and reads the body rather than the links. Agents
 * that ask for `text/markdown` get the whole 404 as Markdown instead, from
 * app/md/[[...slug]]/route.ts.
 */
const AGENT_BODY = `# 404 - Page not found

This URL does not exist on ${BASE_URL}.

- [Sitemap](${BASE_URL}/sitemap.xml) - every public URL on this site
- [llms.txt](${BASE_URL}/llms.txt) - full product description in one file
- [Documentation](${BASE_URL}/docs) - setup, mailboxes, campaigns, API
- [OpenAPI](${BASE_URL}/openapi.json) - machine-readable API description
- [Free tools](${BASE_URL}/tools) | [Blog](${BASE_URL}/blog) | [Contact](${BASE_URL}/contact)

Any page here is available as Markdown: send \`Accept: text/markdown\`, or append \`.md\` to the URL.`;

export default function NotFound() {
  const docs = routesInSection("Docs").slice(0, 6);

  return (
    <main className="bg-white dark:bg-gray-900">
      <Header />

      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-24 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-violet-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            Error 404
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            This page does not exist
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-600 dark:text-gray-300">
            The link may be out of date, or the address mistyped. Everything the
            site does have is one of these.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Go to the home page
            </Link>
            <Link
              href="/docs"
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Read the docs
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DESTINATIONS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-gray-100 p-5 transition hover:border-violet-200 hover:bg-violet-50/40 dark:border-gray-800 dark:hover:border-violet-900 dark:hover:bg-violet-950/20"
              >
                <p className="font-semibold text-gray-900 dark:text-white">
                  {item.title} →
                </p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {item.desc}
                </p>
              </Link>
            ))}
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
                Popular documentation
              </h2>
              <ul className="mt-4 space-y-2">
                {docs.map((route) => (
                  <li key={route.path}>
                    <Link
                      href={route.path}
                      className="text-sm text-gray-600 hover:text-violet-600 dark:text-gray-400 dark:hover:text-violet-400"
                    >
                      {route.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
                For agents and crawlers
              </h2>
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                This response is a real HTTP 404. The same page is served as
                Markdown to any client that sends{" "}
                <code className="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-800">
                  Accept: text/markdown
                </code>
                .
              </p>
              <pre className="mt-4 overflow-x-auto rounded-xl bg-gray-900 px-5 py-4 text-xs leading-relaxed text-gray-100 dark:bg-gray-950">
                <code>{AGENT_BODY}</code>
              </pre>
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <li>
                  <a
                    href="/sitemap.xml"
                    className="text-violet-600 hover:underline dark:text-violet-400"
                  >
                    /sitemap.xml
                  </a>
                </li>
                <li>
                  <a
                    href="/llms.txt"
                    className="text-violet-600 hover:underline dark:text-violet-400"
                  >
                    /llms.txt
                  </a>
                </li>
                <li>
                  <a
                    href="/openapi.json"
                    className="text-violet-600 hover:underline dark:text-violet-400"
                  >
                    /openapi.json
                  </a>
                </li>
                <li>
                  <a
                    href="/robots.txt"
                    className="text-violet-600 hover:underline dark:text-violet-400"
                  >
                    /robots.txt
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
