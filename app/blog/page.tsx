import type { Metadata } from "next";
import BlogPageContent from "./BlogPageContent";

export const metadata: Metadata = {
  // The canonical URL keeps every listing of this page pointing at one
  // address on www, instead of splitting signals across variants.
  alternates: {
    canonical: "https://www.mailmark.dev/blog",
    // The same page as Markdown, for agents that read it that way.
    types: { "text/markdown": "https://www.mailmark.dev/blog.md" },
  },
  title: "Blog",
  description:
    "Tips, guides, and product updates from the Mailmark team on email hosting, deliverability, and campaigns.",
};

export default function BlogPage() {
  return <BlogPageContent />;
}
