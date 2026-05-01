import type { Metadata } from "next";
import ContactClient from "./ContactClient";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the Mailmark team. Browse our help center, email support, or reach us on social media. Typical response time is under 2 hours on business days.",
};

export default function ContactPage() {
  return <ContactClient />;
}
