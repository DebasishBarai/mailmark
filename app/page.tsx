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
    // The same page as Markdown, for agents that read it that way.
    types: { "text/markdown": "https://www.mailmark.dev/index.md" },
  },
};

// A search for the brand name has to resolve to this domain, so the entity is
// spelled out here rather than left to be inferred: an @id other pages can
// point at, the names people actually type, and the addresses that identify us.
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://www.mailmark.dev/#organization",
  name: "Mailmark",
  alternateName: ["Mailmark Email", "mailmark.dev"],
  url: "https://www.mailmark.dev",
  // The og-image is a social card with a headline on it, not a logo.
  // Schema.org wants the mark itself here, so point at the square PNG.
  logo: "https://www.mailmark.dev/logo-icon.png",
  image: "https://www.mailmark.dev/logo-icon.png",
  email: "support@mailmark.dev",
  slogan: "Email hosting and campaigns for your own domain.",
  description:
    "One email platform for developers running multiple products: multi-domain mailboxes, user campaigns, and a send API with npm SDK.",
  knowsAbout: [
    "custom domain email hosting",
    "email deliverability",
    "SPF, DKIM and DMARC",
    "email campaigns",
    "Amazon SES",
  ],
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "support@mailmark.dev",
      url: "https://www.mailmark.dev/contact",
      availableLanguage: ["English"],
    },
    {
      "@type": "ContactPoint",
      contactType: "security",
      email: "security@mailmark.dev",
      url: "https://www.mailmark.dev/security",
    },
  ],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://www.mailmark.dev/#website",
  name: "Mailmark",
  alternateName: "Mailmark - email hosting and campaigns for your domain",
  url: "https://www.mailmark.dev",
  inLanguage: "en",
  publisher: { "@id": "https://www.mailmark.dev/#organization" },
};

// The product itself, so a brand-name search has something to match beyond the
// company: what Mailmark is, what it costs, and where the free trial starts.
const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Mailmark",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Email hosting and campaigns",
  operatingSystem: "Web",
  url: "https://www.mailmark.dev",
  description:
    "Email hosting and campaigns for custom domains: mailboxes, campaigns, sequences, warmup, and a REST API.",
  publisher: { "@id": "https://www.mailmark.dev/#organization" },
  offers: [
    {
      "@type": "Offer",
      name: "Starter",
      price: "10",
      priceCurrency: "USD",
      url: "https://www.mailmark.dev/#pricing",
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "50",
      priceCurrency: "USD",
      url: "https://www.mailmark.dev/#pricing",
    },
    {
      "@type": "Offer",
      name: "Business",
      price: "100",
      priceCurrency: "USD",
      url: "https://www.mailmark.dev/#pricing",
    },
  ],
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
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
