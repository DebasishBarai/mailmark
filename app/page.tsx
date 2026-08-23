import type { Metadata } from "next";
import { ogImages, twitterImages } from "./og";
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

const title = "Mailmark - One Email Platform for All Your Products";
const description =
  "Built for developers running more than one product. Manage every product's domain and mailboxes, send update campaigns to your users, and send email from your code with a REST API and npm SDK, all in one dashboard.";

export const metadata: Metadata = {
  title,
  description,
  // This page's openGraph replaces the root layout's rather than merging with
  // it, so everything the card needs has to be restated here, images included.
  // Previously only `type` and `url` were, which left the home page with no
  // og:image and no og:site_name. The twitter block is restated for the same
  // reason: without it the card inherits the layout's title, which is not this
  // page's title.
  openGraph: {
    type: "website",
    siteName: "Mailmark",
    title,
    description,
    url: "https://www.mailmark.dev",
    images: ogImages,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: twitterImages,
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
  // The og-image is a social card with a headline on it, not a logo.
  // Schema.org wants the mark itself here, so point at the square PNG.
  logo: "https://www.mailmark.dev/logo-icon.png",
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
