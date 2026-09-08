import type { Metadata } from "next";
import ContactClient from "./ContactClient";

export const metadata: Metadata = {
  // The canonical URL keeps every listing of this page pointing at one
  // address on www, instead of splitting signals across variants.
  alternates: {
    canonical: "https://www.mailmark.dev/contact",
    // The same page as Markdown, for agents that read it that way.
    types: { "text/markdown": "https://www.mailmark.dev/contact.md" },
  },
  title: "Contact Us",
  description:
    "Get in touch with the Mailmark team. Browse our help center, email support, or reach us on social media. Typical response time is under 2 hours on business days.",
};

export default function ContactPage() {
  return <ContactClient />;
}
