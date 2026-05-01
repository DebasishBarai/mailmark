import type { Metadata } from "next";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import SignatureGenerator from "./SignatureGenerator";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Will this signature work in all email clients?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. The generated HTML uses inline styles and table-based layout, which is compatible with all major email clients including Gmail, Outlook, Apple Mail, Yahoo Mail, and Thunderbird.",
      },
    },
    {
      "@type": "Question",
      name: "How do I add this signature to my email client?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Copy the HTML using the Copy HTML button. In Gmail: Settings > See all settings > General > Signature > paste. In Outlook: File > Options > Mail > Signatures > paste. In Apple Mail: Preferences > Signatures > paste.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use my own headshot image?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Paste a URL to your headshot image in the Image URL field. The image should be hosted somewhere publicly accessible. We recommend a square image of at least 160x160 pixels.",
      },
    },
    {
      "@type": "Question",
      name: "Why should I use an email signature?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A professional email signature builds trust, reinforces your brand, and makes it easy for recipients to find your contact details. For cold outreach, a signature with your name, title, and company legitimizes your email and can improve reply rates.",
      },
    },
    {
      "@type": "Question",
      name: "Is this generator free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Completely free with no limits. Generate as many signatures as you need. No signup, no watermark, no restrictions.",
      },
    },
  ],
};

export const metadata: Metadata = {
  title: "Free Email Signature Generator - Create Professional HTML Signatures",
  description:
    "Generate a professional HTML email signature in seconds. Choose from 3 styles, customize colors, add your photo and social links. Works with Gmail, Outlook, and Apple Mail. Free, no signup.",
  keywords: [
    "email signature generator",
    "HTML email signature",
    "professional email signature",
    "free signature generator",
    "email signature template",
    "Gmail signature",
    "Outlook signature",
    "business email signature",
  ],
};

export default function SignatureGeneratorPage() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <SignatureGenerator />
      <Footer />
    </main>
  );
}
