import type { Metadata } from "next";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import SavingsCalculator from "./SavingsCalculator";

export const metadata: Metadata = {
  title: "SES Savings Calculator - Compare Email Costs | Mailmark",
  description:
    "Calculate how much you could save by switching from Mailchimp, SendGrid, Instantly, or other email providers to Mailmark powered by AWS SES.",
  keywords: [
    "email cost calculator",
    "SES pricing calculator",
    "SendGrid vs SES cost",
    "Mailchimp alternative pricing",
    "email provider comparison",
    "AWS SES savings",
  ],
};

export default function SesSavingsCalculatorPage() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <Header />
      <SavingsCalculator />
      <Footer />
    </main>
  );
}
