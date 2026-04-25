import type { Metadata } from "next";
import BlogPageContent from "./BlogPageContent";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Tips, guides, and product updates from the Mailmark team on email hosting, deliverability, and campaigns.",
};

export default function BlogPage() {
  return <BlogPageContent />;
}
