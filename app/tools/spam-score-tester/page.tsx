import type { Metadata } from "next";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import SpamScoreTester from "./SpamScoreTester";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What triggers spam filters?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Spam filters look at multiple signals: trigger words (FREE, ACT NOW), excessive capitalization, too many links, missing unsubscribe links, poor sender reputation, and lack of authentication (SPF/DKIM/DMARC). A single issue rarely causes problems, but multiple red flags together will land you in spam.",
      },
    },
    {
      "@type": "Question",
      name: "How accurate is this spam score?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "This tool checks your email content against the most common spam filter rules. However, deliverability also depends on your sender reputation, domain authentication, and recipient engagement history.",
      },
    },
    {
      "@type": "Question",
      name: "What is a good spam score?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Aim for 80 or above. Scores between 50-79 mean your email has some issues that could hurt deliverability. Below 50 means your email has major spam signals and is likely to be filtered.",
      },
    },
    {
      "@type": "Question",
      name: "Do personalization tokens help deliverability?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Personalized emails (using the recipient's name, company, etc.) see higher open and reply rates. Email providers track engagement, so higher engagement improves your sender reputation over time.",
      },
    },
    {
      "@type": "Question",
      name: "Should I always include an unsubscribe link?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, for any bulk or marketing email. It is required by CAN-SPAM (US), GDPR (EU), and CASL (Canada). Even for cold outreach, including an unsubscribe option is a positive signal to spam filters.",
      },
    },
  ],
};

export const metadata: Metadata = {
  title: "Free Email Spam Score Tester - Check Before You Send",
  description:
    "Test your email for spam trigger words, formatting issues, and deliverability red flags. Get an instant spam risk score with actionable recommendations. Free, no signup required.",
  keywords: [
    "email spam score",
    "spam checker",
    "email spam tester",
    "spam filter test",
    "email deliverability test",
    "spam word checker",
    "email content checker",
    "spam trigger words",
  ],
};

export default function SpamScoreTesterPage() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <SpamScoreTester />
      <Footer />
    </main>
  );
}
