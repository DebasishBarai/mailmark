import type { Metadata } from "next";
import Header from "./components/Header";
import Hero from "./components/Hero";
import VideoDemo from "./components/VideoDemo";
import Features from "./components/Features";
import FeatureShowcase from "./components/FeatureShowcase";
import PersonalizationDemo from "./components/PersonalizationDemo";
import FeatureGrid from "./components/FeatureGrid";
import Testimonials from "./components/Testimonials";
import PlatformStats from "./components/PlatformStats";
import PoweredBy from "./components/PoweredBy";
import Pricing from "./components/Pricing";
import FAQ from "./components/FAQ";
import CTABanner from "./components/CTABanner";
import Footer from "./components/Footer";

export const metadata: Metadata = {
  title: "Mailmark - Email Hosting & Campaigns for Your Domain",
  description:
    "Add your domain, create unlimited mailboxes, and run powerful email campaigns. A complete email platform with inbox, sent, outbox, and built-in campaign tools.",
  openGraph: {
    type: "website",
    url: "https://www.mailmark.dev",
  },
  alternates: {
    canonical: "https://www.mailmark.dev",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Mailmark",
  url: "https://www.mailmark.dev",
  logo: "https://www.mailmark.dev/og-image.png",
  description:
    "Add your domain, create unlimited mailboxes, and run powerful email campaigns.",
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Mailmark",
  url: "https://www.mailmark.dev",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <Header />
      <Hero />
      <VideoDemo />
      <Features />
      <FeatureShowcase />
      <PersonalizationDemo />
      <FeatureGrid />
      <PlatformStats />
      <Testimonials />
      <PoweredBy />
      <Pricing />
      <FAQ />
      <CTABanner />
      <Footer />
    </div>
  );
}
