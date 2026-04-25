import type { Metadata } from "next";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import SubjectLineGenerator from "./SubjectLineGenerator";

export const metadata: Metadata = {
  title: "Free Cold Email Subject Line Generator - AI Powered",
  description:
    "Tired of your cold emails getting ignored? Generate high-converting subject lines with AI. Tailored to your industry and offer. Free, instant, no signup.",
  keywords: [
    "cold email subject lines",
    "email subject line generator",
    "best cold email subject lines",
    "how to write cold email subject lines",
    "AI subject line generator",
    "cold outreach subject lines",
    "email open rate",
  ],
};

export default function SubjectLineGeneratorPage() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <Header />
      <SubjectLineGenerator />
      <Footer />
    </main>
  );
}
