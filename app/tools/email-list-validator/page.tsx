import type { Metadata } from "next";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import EmailListValidator from "./EmailListValidator";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Why should I validate my email list before sending?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sending to invalid emails causes hard bounces, which damage your sender reputation. A bounce rate above 2% can trigger spam filters and get your domain blacklisted. Validating your list removes bad addresses before they hurt your deliverability.",
      },
    },
    {
      "@type": "Question",
      name: "What counts as a risky email?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Role-based addresses (info@, admin@, support@) and free provider emails (Gmail, Yahoo) are flagged as risky. Role-based addresses are shared inboxes that often have stricter spam filtering. Free providers are fine for personal outreach but may indicate low-quality B2B leads.",
      },
    },
    {
      "@type": "Question",
      name: "How often should I clean my email list?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Clean your list every 3-6 months, or before any major campaign. Email addresses decay at roughly 2-3% per month as people change jobs, companies shut down, and domains expire. Regular cleaning keeps your bounce rate low.",
      },
    },
    {
      "@type": "Question",
      name: "What is the difference between syntax validation and MX record checking?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Syntax validation checks if the email format is correct (has an @ sign, valid characters, etc.). MX record checking verifies that the domain actually has mail servers configured to receive email. An email can have valid syntax but still be undeliverable if the domain has no mail server.",
      },
    },
    {
      "@type": "Question",
      name: "Can I upload a CSV file?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Upload a CSV file and we will extract email addresses from it automatically. We look for columns named email, Email, email_address, or similar. You can also paste emails directly into the text box, one per line.",
      },
    },
  ],
};

export const metadata: Metadata = {
  title: "Free Email List Validator - Verify Emails Before You Send",
  description:
    "Validate your email list for free. Check for invalid addresses, disposable emails, missing MX records, and risky contacts. Reduce bounces and protect your sender reputation.",
  keywords: [
    "email list validator",
    "email verifier",
    "verify email addresses",
    "email list cleaning",
    "email validation tool",
    "bounce rate reduction",
    "email hygiene",
    "bulk email verification",
  ],
};

export default function EmailListValidatorPage() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <EmailListValidator />
      <Footer />
    </main>
  );
}
