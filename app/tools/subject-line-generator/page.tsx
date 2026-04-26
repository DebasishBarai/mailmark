import type { Metadata } from "next";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import SubjectLineGenerator from "./SubjectLineGenerator";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What makes a good cold email subject line?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The best cold email subject lines are short (under 60 characters), create curiosity, feel personal, and avoid spammy words like 'FREE' or 'ACT NOW'. They should make the recipient want to open the email without feeling tricked.",
      },
    },
    {
      "@type": "Question",
      name: "How long should a cold email subject line be?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Keep it under 60 characters. Most email clients truncate longer subject lines, especially on mobile. The sweet spot is 30-50 characters where the full line is visible at a glance.",
      },
    },
    {
      "@type": "Question",
      name: "Should I use personalization in subject lines?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Subject lines that include the recipient's name, company, or a specific detail about their business see significantly higher open rates. Even something as simple as mentioning their industry makes a difference.",
      },
    },
    {
      "@type": "Question",
      name: "How many subject lines should I test?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Test at least 3-5 variations per campaign. A/B testing subject lines is one of the highest-ROI activities in cold email. Small changes in wording can swing open rates by 20-30%.",
      },
    },
    {
      "@type": "Question",
      name: "What subject line words trigger spam filters?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Avoid all-caps, excessive punctuation (!!!), and words like 'guaranteed', 'winner', 'urgent', 'act now', 'limited time', and 'free money'. These are red flags for spam filters and will hurt your deliverability.",
      },
    },
  ],
};

export const metadata: Metadata = {
  title: "Free Cold Email Subject Line Generator - AI Powered",
  description:
    "Tired of your cold emails getting ignored? Generate high-converting subject lines with AI. Tailored to your industry and offer. Free, instant, no signup.",
  keywords: [
    "cold email subject lines",
    "email subject line generator",
    "best cold email subject lines",
    "how to write cold email subject lines",
    "AI subject line generator",
    "cold outreach subject lines",
    "email open rate",
  ],
};

export default function SubjectLineGeneratorPage() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <SubjectLineGenerator />
      <Footer />
    </main>
  );
}
