import type { Metadata } from "next";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Arithmetic from "./components/Arithmetic";
import VideoDemo from "./components/VideoDemo";
import Features from "./components/Features";
import FeatureShowcase from "./components/FeatureShowcase";
import DeveloperSection from "./components/DeveloperSection";
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
  title: "Mailmark - One Email Platform for All Your Products",
  description:
    "Built for developers running more than one product. Manage every product's domain and mailboxes, send update campaigns to your users, and send email from your code with a REST API and npm SDK, all in one dashboard.",
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
    "One email platform for developers running multiple products: multi-domain mailboxes, user campaigns, and a send API with npm SDK.",
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
      <Arithmetic />
      <FeatureShowcase />
      <DeveloperSection />
      <PersonalizationDemo />
      <Features />
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
