import type { Metadata } from "next";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import DeliverabilityChecker from "./DeliverabilityChecker";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Why are my emails going to spam?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The most common reasons are missing authentication records (SPF, DKIM, DMARC), a poor sender reputation, being listed on email blacklists, or sending to unengaged contacts. Our free test checks all of these instantly so you know exactly what to fix.",
      },
    },
    {
      "@type": "Question",
      name: "What is an email deliverability test?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "An email deliverability test checks whether your domain is properly configured to send emails that reach the inbox instead of spam. It verifies your sender authentication, checks if you're on any blacklists, and gives you a health score so you can see where you stand.",
      },
    },
    {
      "@type": "Question",
      name: "How do I improve my email open rates?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Start by fixing your domain authentication. Missing SPF, DKIM, or DMARC records are the #1 reason emails get filtered to spam. After that, warm up your domain gradually, clean your contact list, and avoid spam trigger words in your subject lines.",
      },
    },
    {
      "@type": "Question",
      name: "What do SPF, DKIM, and DMARC actually do?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "They prove to email providers that you are who you say you are. SPF lists which servers can send on your behalf. DKIM adds a cryptographic signature to verify your emails weren't tampered with. DMARC tells providers what to do if those checks fail. Together, they are the foundation of inbox placement.",
      },
    },
    {
      "@type": "Question",
      name: "How often should I test my email deliverability?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Test after any DNS changes, before launching a new campaign, and at least once a month as a routine check. Blacklist status and DNS records can change without warning, so regular testing helps you catch problems before they tank your open rates.",
      },
    },
    {
      "@type": "Question",
      name: "Is this tool really free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, completely free with no signup required. Run as many checks as you need. If you want automated monitoring, inbox warming, and full campaign infrastructure, Mailmark handles all of that.",
      },
    },
  ],
};

export const metadata: Metadata = {
  title: "Free Email Deliverability Test - Are Your Emails Landing in Spam?",
  description:
    "Struggling with low open rates? Your emails might be landing in spam. Test your domain's email deliverability for free and get actionable fixes to reach the inbox.",
  keywords: [
    "email deliverability test",
    "emails going to spam",
    "email spam checker",
    "why are my emails going to spam",
    "email deliverability checker",
    "inbox placement test",
    "email blacklist checker",
    "low email open rates",
  ],
};

export default function EmailDeliverabilityCheckerPage() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <DeliverabilityChecker />
      <Footer />
    </main>
  );
}
