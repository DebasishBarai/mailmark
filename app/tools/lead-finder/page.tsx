import type { Metadata } from "next";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import LeadFinder from "./LeadFinder";

export const metadata: Metadata = {
  title: "Free B2B Lead Finder - Find Cold Email Leads | Mailmark",
  description:
    "Stop wasting hours searching for leads. Find verified B2B contacts by industry, job title, and company size. Export and start emailing in minutes.",
  keywords: [
    "B2B lead finder",
    "cold email leads",
    "find email addresses",
    "B2B contact database",
    "lead generation tool",
    "sales prospecting tool",
    "find business contacts",
  ],
};

export default function LeadFinderPage() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <Header />
      <LeadFinder />
      <Footer />
    </main>
  );
}
