import type { Metadata } from "next";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import DeliverabilityChecker from "./DeliverabilityChecker";

export const metadata: Metadata = {
  title: "Free Email Deliverability Test - Are Your Emails Landing in Spam?",
  description:
    "Struggling with low open rates? Your emails might be landing in spam. Test your domain's email deliverability for free and get actionable fixes to reach the inbox.",
  keywords: [
    "email deliverability test",
    "emails going to spam",
    "email spam checker",
    "why are my emails going to spam",
    "email deliverability checker",
    "inbox placement test",
    "email blacklist checker",
    "low email open rates",
  ],
};

export default function EmailDeliverabilityCheckerPage() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <Header />
      <DeliverabilityChecker />
      <Footer />
    </main>
  );
}
