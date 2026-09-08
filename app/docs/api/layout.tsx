import type { Metadata } from "next";

/**
 * The API reference page itself is a client component (it runs the live
 * playground), so it cannot export metadata. This layout carries the title,
 * description and canonical URL for it: without them the page inherited the
 * site-wide defaults and had no canonical of its own.
 */
export const metadata: Metadata = {
  title: "API Reference",
  description:
    "The Mailmark REST API: authentication, sending, mailboxes, sender groups, sequences, and analytics, with a live playground and an OpenAPI description.",
  alternates: {
    canonical: "https://www.mailmark.dev/docs/api",
    // The same page as Markdown, for agents that read it that way.
    types: { "text/markdown": "https://www.mailmark.dev/docs/api.md" },
  },
};

export default function ApiDocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
