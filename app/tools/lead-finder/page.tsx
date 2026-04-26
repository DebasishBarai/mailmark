import type { Metadata } from "next";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import LeadFinder from "./LeadFinder";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I find leads for cold email?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Start by defining your ideal customer profile: industry, company size, job title, and location. Use a lead finder tool to search for contacts matching those criteria, then verify their email addresses before sending. Quality over quantity matters more in cold email than any other channel.",
      },
    },
    {
      "@type": "Question",
      name: "How many cold emails should I send per day?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Start with 20-30 per day on a new domain and gradually increase. A warmed-up domain can safely handle 100-200 emails per day. Going too fast too soon will damage your sender reputation and land you in spam folders.",
      },
    },
    {
      "@type": "Question",
      name: "What's a good cold email response rate?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A 5-10% reply rate is considered good for cold outreach. Top performers see 15-25% by combining highly targeted leads, personalized messaging, and proper deliverability setup. The quality of your leads matters as much as your copy.",
      },
    },
    {
      "@type": "Question",
      name: "Should I use a separate domain for cold email?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Always use a separate domain (e.g. yourbrand-mail.com) for cold outreach to protect your main domain's reputation. If something goes wrong, your primary domain stays clean.",
      },
    },
  ],
};

export const metadata: Metadata = {
  title: "Free B2B Lead Finder - Find Cold Email Leads",
  description:
    "Stop wasting hours searching for leads. Find verified B2B contacts by industry, job title, and company size. Export and start emailing in minutes.",
  keywords: [
    "B2B lead finder",
    "cold email leads",
    "find email addresses",
    "B2B contact database",
    "lead generation tool",
    "sales prospecting tool",
    "find business contacts",
  ],
};

export default function LeadFinderPage() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <LeadFinder />
      <Footer />
    </main>
  );
}
