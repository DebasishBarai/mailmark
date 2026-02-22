import Header from "./components/Header";
import Hero from "./components/Hero";
import Features from "./components/Features";
import FeatureShowcase from "./components/FeatureShowcase";
import FeatureGrid from "./components/FeatureGrid";
import Testimonials from "./components/Testimonials";
import CTABanner from "./components/CTABanner";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <Hero />
      <Features />
      <FeatureShowcase />
      <FeatureGrid />
      <Testimonials />
      <CTABanner />
      <Footer />
    </div>
  );
}
