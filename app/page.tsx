import type { Metadata } from "next";
import LandingHeader from "./components/LandingHeader";
import Hero from "./components/Hero";
import VideoDemo from "./components/VideoDemo";
import Features from "./components/Features";
import FeatureShowcase from "./components/FeatureShowcase";
import DeveloperAPI from "./components/DeveloperAPI";
import PersonalizationDemo from "./components/PersonalizationDemo";
// import FeatureGrid from "./components/FeatureGrid"; // Folded into <Features />; kept for reference.
import Testimonials from "./components/Testimonials";
import PlatformStats from "./components/PlatformStats";
import PoweredBy from "./components/PoweredBy";
import Pricing from "./components/Pricing";
import FAQ from "./components/FAQ";
import CTABanner from "./components/CTABanner";
import LandingFooter from "./components/LandingFooter";

export const metadata: Metadata = {
  title: "Mailmark - One Email Platform for Every Product You Ship",
  description:
    "Stop juggling ten tools to email your users. Manage every product's domains and mailboxes in one dashboard, send campaigns with mail merge, and send transactional email from your own apps with a REST API and npm SDK.",
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
    "One email platform for developers running multiple products. Multi-domain and mailbox management, campaigns with mail merge, and a REST API and npm SDK.",
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Mailmark",
  url: "https://www.mailmark.dev",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <LandingHeader />
      <Hero />
      <VideoDemo />
      <Features />
      <FeatureShowcase />
      <DeveloperAPI />
      <PersonalizationDemo />
      <PlatformStats />
      <Testimonials />
      <PoweredBy />
      <Pricing />
      <FAQ />
      <CTABanner />
      <LandingFooter />
    </div>
  );
}
