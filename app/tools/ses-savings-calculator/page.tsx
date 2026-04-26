import type { Metadata } from "next";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import SavingsCalculator from "./SavingsCalculator";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How much cheaper is AWS SES compared to Mailchimp or SendGrid?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "AWS SES charges $0.10 per 1,000 emails. At 50,000 emails per month that is $5 in sending costs versus roughly $299 on Mailchimp or $89.95 on SendGrid. Mailmark wraps SES in a complete platform — inbox warming, domain setup, analytics, and campaign tools — starting at $10/month, still a fraction of the cost of traditional providers.",
      },
    },
    {
      "@type": "Question",
      name: "What is included in a Mailmark plan?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Every Mailmark plan includes multi-domain management, 28-day inbox warming, automatic SPF/DKIM/DMARC setup, blacklist monitoring, open and click tracking, bounce suppression, a REST API, campaign analytics, and a built-in email client. You get a complete sending platform without managing AWS infrastructure yourself.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use AWS SES directly without Mailmark?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, you can use raw AWS SES at $0.10 per 1,000 emails. However, you would need to build and maintain your own infrastructure for authentication setup, bounce handling, suppression lists, campaign management, and deliverability monitoring. Mailmark provides all of that out of the box, saving significant engineering time.",
      },
    },
    {
      "@type": "Question",
      name: "Are these cost estimates accurate?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The estimates are based on publicly available pricing pages for each provider and are accurate as of April 2026. Actual costs can vary depending on your specific plan, billing region, add-ons, and usage patterns. Always verify current pricing directly with each provider before making a decision.",
      },
    },
    {
      "@type": "Question",
      name: "How do I switch from my current email provider to Mailmark?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Add your sending domain to Mailmark, update your DNS records (Mailmark generates them for you), and start sending. The process takes under 10 minutes for most setups. Mailmark also runs a 28-day inbox warming sequence on new domains to protect your sender reputation during the transition.",
      },
    },
  ],
};

export const metadata: Metadata = {
  title: "SES Savings Calculator - Compare Email Costs",
  description:
    "Calculate how much you could save by switching from Mailchimp, SendGrid, Instantly, or other email providers to Mailmark powered by AWS SES.",
  keywords: [
    "email cost calculator",
    "SES pricing calculator",
    "SendGrid vs SES cost",
    "Mailchimp alternative pricing",
    "email provider comparison",
    "AWS SES savings",
  ],
};

export default function SesSavingsCalculatorPage() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <SavingsCalculator />
      <Footer />
    </main>
  );
}
