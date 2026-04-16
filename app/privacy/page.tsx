import type { Metadata } from "next";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy - Mailmark",
  description: "Mailmark Privacy Policy. How we collect, use, and protect your data.",
};

const sections = [
  {
    title: "1. Information we collect",
    content: `We collect information you provide directly when you create an account, add a domain, create mailboxes, send emails, or contact us for support.

**Account data:** name, email address, password (hashed), billing information, and company name.

**Usage data:** log data including IP addresses, browser type, pages visited, features used, timestamps, and crash reports.

**Email data:** metadata and content of emails sent through or received by Mailmark (subject lines, sender/recipient addresses, timestamps). We process email content only to deliver the service and do not use it for advertising.

**Domain and DNS data:** domain names you add, DNS records we generate, and verification status.

**Payment data:** billing address and card details. Card numbers are processed directly by our payment processor (Polar) and never stored on our servers.`,
  },
  {
    title: "2. How we use your information",
    content: `We use collected information to:

- Provide, operate, and improve the Mailmark platform.
- Process transactions and send transactional emails (receipts, invoices, alerts).
- Respond to your support requests.
- Monitor for abuse, fraud, and violations of our Terms of Service.
- Send product updates, security alerts, and service announcements (you may opt out of non-essential communications).
- Comply with legal obligations.

We do not sell your personal data to third parties. We do not use your email content for advertising purposes.`,
  },
  {
    title: "3. Data sharing",
    content: `We share data only in the following circumstances:

**Service providers:** We share data with vendors who help us operate the service (e.g., AWS for cloud infrastructure and email processing, Convex for database hosting, Polar for payments, Clerk for authentication). These vendors are contractually obligated to protect your data and process it in accordance with applicable data protection laws.

**Legal compliance:** We may disclose data when required by law, court order, or governmental authority, or to protect the rights, property, and safety of Mailmark, our users, and the public.

**Business transfers:** If Mailmark is acquired or merges with another company, your data may be transferred as part of that transaction. We will notify you before your data is subject to a different Privacy Policy.

We do not share your email content with advertisers or analytics companies.`,
  },
  {
    title: "4. Infrastructure and data location",
    content: `Mailmark's infrastructure is hosted across the following providers and regions:

**Email processing and storage:** AWS ap-south-1 (Mumbai, India). All email sending, receiving, DKIM signing, and raw email storage (S3) are handled in this region.

**Database:** Convex cloud infrastructure (United States).

**Authentication:** Clerk (United States).

**Payments:** Polar (European Union).

This means your email data, including message content and metadata, is processed and stored in AWS data centers located in Mumbai, India. Account and authentication data is processed in the United States.

**International transfers:** If you are located outside India or the United States, your data will be transferred to and processed in these regions. We rely on standard contractual clauses and vendor data processing agreements to ensure your data is protected in accordance with GDPR and other applicable data protection regulations.

We are evaluating multi-region support to allow customers to choose their preferred data region in a future release. If data residency is a hard requirement for your organization, please contact us at privacy@mailmark.dev to discuss your needs.`,
  },
  {
    title: "5. Cookies and tracking",
    content: `We use cookies and similar technologies to:

- Keep you logged in (essential session cookies).
- Remember your preferences.
- Understand how users navigate the product (analytics).

You can control cookie settings through your browser. Disabling cookies may affect some product features. We do not use third-party advertising cookies.`,
  },
  {
    title: "6. Data retention",
    content: `We retain your data for as long as your account is active or as needed to provide services. If you delete your account:

- Account data is deleted within 30 days.
- Email data is deleted within 60 days (some may persist in backups for up to 90 days).
- Billing records are retained for 7 years as required by financial regulations.

You can request earlier deletion of specific data by contacting privacy@mailmark.dev.`,
  },
  {
    title: "7. Security",
    content: `We protect your data with:

- TLS/HTTPS encryption for all data in transit.
- AES-256 encryption for data at rest.
- Access controls limiting staff access to user data on a need-to-know basis.
- Regular security audits and penetration testing.
- Automatic backups with point-in-time recovery.

No method of transmission or storage is 100% secure. If you discover a security vulnerability, please report it to security@mailmark.dev.`,
  },
  {
    title: "8. Your rights",
    content: `Depending on your location, you may have the following rights:

- **Access:** Request a copy of personal data we hold about you.
- **Correction:** Request correction of inaccurate data.
- **Deletion:** Request deletion of your account and associated data.
- **Portability:** Request an export of your data in a machine-readable format.
- **Objection:** Object to certain processing activities.
- **Withdrawal of consent:** Where processing is based on consent, you may withdraw it at any time.

To exercise any of these rights, email privacy@mailmark.dev. We will respond within 30 days.

**EEA/UK residents:** Mailmark processes data under GDPR. Our legal bases include contract performance, legitimate interests, and consent.

**California residents:** Under CCPA, you have additional rights including the right to know what data is sold or shared (we do not sell personal data).`,
  },
  {
    title: "9. Children's privacy",
    content: `Mailmark is not directed at children under 16. We do not knowingly collect personal data from anyone under 16. If you believe a child has provided us with personal information, contact us at privacy@mailmark.dev and we will delete it promptly.`,
  },
  {
    title: "10. Changes to this policy",
    content: `We may update this Privacy Policy periodically. We will notify you of material changes by email and by posting a notice on our website at least 30 days before the change takes effect. Continued use of the service after changes take effect constitutes acceptance of the revised policy.`,
  },
  {
    title: "11. Contact us",
    content: `For privacy-related questions or to exercise your rights, contact:

**Mailmark Privacy Team**
privacy@mailmark.dev

We aim to respond to all privacy inquiries within 30 days.`,
  },
];

export default function PrivacyPage() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-20 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-3xl">
          <span className="inline-block rounded-full bg-violet-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            Legal
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Privacy Policy
          </h1>
          <p className="mt-4 text-gray-500 dark:text-gray-400">
            Last updated: <strong>April 16, 2026</strong>
          </p>
          <p className="mt-4 text-gray-600 dark:text-gray-300">
            Mailmark (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) is committed to protecting your privacy.
            This policy explains what information we collect, how we use it, and
            the choices you have.
          </p>
        </div>
      </section>

      <section className="bg-white px-6 py-12 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl">
          <div className="space-y-10">
            {sections.map((section) => (
              <div key={section.title} className="border-b border-gray-100 pb-10 last:border-0 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{section.title}</h2>
                <div className="mt-4 space-y-3">
                  {section.content.split("\n\n").map((para, i) => (
                    <p key={i} className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                      {para.split("**").map((part, j) =>
                        j % 2 === 1 ? (
                          <strong key={j} className="font-semibold text-gray-800 dark:text-gray-100">
                            {part}
                          </strong>
                        ) : (
                          part
                        )
                      )}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
