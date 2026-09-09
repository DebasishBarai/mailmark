import type { Metadata } from "next";
import ApplyClient from "./ApplyClient";

export const metadata: Metadata = {
  // The canonical URL keeps every listing of this page pointing at one
  // address on www, instead of splitting signals across variants.
  alternates: {
    canonical: "https://www.mailmark.dev/careers/apply",
    // The same page as Markdown, for agents that read it that way.
    types: { "text/markdown": "https://www.mailmark.dev/careers/apply.md" },
  },
  title: "Apply",
  description:
    "Apply to join the Mailmark team. Tell us about yourself, share your work, and we will get back to you.",
};

// The role comes in on the query string from whichever Apply button was
// clicked. Read here rather than with useSearchParams so the form needs no
// Suspense boundary, and validated in the client against the openings list:
// a link naming a role we do not have falls back to the empty selection.
export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string | string[] }>;
}) {
  const { role } = await searchParams;
  return <ApplyClient initialRole={typeof role === "string" ? role : ""} />;
}
