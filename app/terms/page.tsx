import type { Metadata } from "next";
import Header from "../components/Header";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "Terms of Service - Mailmark",
  description: "Mailmark Terms of Service — the rules and guidelines for using our platform.",
};

const sections = [
  {
    title: "1. Acceptance of terms",
    content: `By accessing or using Mailmark ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Service.

These Terms apply to all users, including free and paid account holders. We may update these Terms at any time. Continued use of the Service after changes are posted constitutes acceptance.`,
  },
  {
    title: "2. Description of service",
    content: `Mailmark provides email hosting, mailbox management, and email campaign tools. We allow you to connect your own domain, create mailboxes, and send and receive email via our infrastructure (powered by AWS SES and related services).

We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time, with or without notice. We will make reasonable efforts to notify users of significant changes.`,
  },
  {
    title: "3. Accounts",
    content: `**Eligibility:** You must be at least 16 years old to use the Service. By creating an account, you represent that you meet this requirement.

**Account security:** You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. Notify us immediately at support@mailmark.app if you suspect unauthorized access.

**Accurate information:** You agree to provide accurate and complete information when creating your account and to keep it up to date.

**One account per user:** You may not create multiple accounts to circumvent plan limits or suspensions.`,
  },
  {
    title: "4. Acceptable use",
    content: `You agree not to use the Service to:

- Send spam, unsolicited bulk email, or email to addresses obtained through scraping or purchased lists.
- Harass, threaten, or impersonate others.
- Send email containing malware, phishing content, or fraudulent material.
- Violate any applicable law or regulation, including the CAN-SPAM Act, GDPR, and CASL.
- Circumvent any technical measures we use to enforce these Terms.
- Resell or sublicense the Service without our written consent.
- Conduct high-volume sending that degrades service quality for other users.

Violation of these rules may result in immediate suspension or termination of your account without refund.`,
  },
  {
    title: "5. Email sending limits",
    content: `Your account is subject to the email volume limits of your chosen plan. Exceeding plan limits will result in emails being queued or throttled. We may charge for overages or require an upgrade to continue sending.

We reserve the right to limit sending from accounts that generate high bounce rates, spam complaints, or abuse reports, regardless of plan limits.`,
  },
  {
    title: "6. Payment and billing",
    content: `**Subscription fees:** Paid plans are billed monthly in advance. Prices are as stated on our Pricing page and may change with 30 days' notice.

**Payment:** We accept major credit cards via Stripe. By providing payment details, you authorise us to charge the applicable fees.

**Upgrades/downgrades:** Plan changes take effect at the start of the next billing cycle.

**Refunds:** We offer a 14-day money-back guarantee for new paid subscriptions. After 14 days, payments are non-refundable except where required by law.

**Failed payments:** If payment fails, we will attempt to charge again. After 7 days of failed payment, your account may be downgraded to the free plan and data may be at risk.`,
  },
  {
    title: "7. Intellectual property",
    content: `**Mailmark IP:** The Service, including all software, design, and content, is owned by Mailmark and protected by copyright and other intellectual property laws. You may not copy, modify, or distribute any part of the Service without our written permission.

**Your content:** You retain ownership of all content you upload, send, or store through the Service. By using the Service, you grant us a limited licence to process your content solely to provide the Service.

**Feedback:** If you provide feedback or suggestions, you grant us the right to use them without restriction or compensation.`,
  },
  {
    title: "8. Privacy",
    content: `Your use of the Service is also governed by our Privacy Policy, which is incorporated into these Terms by reference. Please read it carefully.`,
  },
  {
    title: "9. Disclaimer of warranties",
    content: `The Service is provided "as is" and "as available" without any warranties of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.

We do not warrant that the Service will be uninterrupted, error-free, or completely secure. Email delivery is dependent on factors outside our control, including recipient server configurations.`,
  },
  {
    title: "10. Limitation of liability",
    content: `To the maximum extent permitted by applicable law, Mailmark and its officers, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, arising out of or related to your use of the Service.

Our total liability for any claim relating to the Service shall not exceed the amount you paid us in the 12 months preceding the claim.`,
  },
  {
    title: "11. Termination",
    content: `**By you:** You may close your account at any time from the account settings page. Termination does not entitle you to a refund of any prepaid fees.

**By us:** We may suspend or terminate your account at any time if you violate these Terms, if your account is at risk of causing harm to other users or our infrastructure, or if we decide to discontinue the Service.

Upon termination, your data will be deleted in accordance with our Privacy Policy.`,
  },
  {
    title: "12. Governing law and disputes",
    content: `These Terms shall be governed by the laws of the State of Delaware, United States, without regard to conflict-of-law principles.

Any disputes arising from these Terms or the Service shall first be resolved through good-faith negotiation. If negotiation fails, disputes shall be resolved through binding arbitration under the rules of JAMS. Class action lawsuits are waived.`,
  },
  {
    title: "13. Contact",
    content: `For questions about these Terms, contact us at legal@mailmark.app or by mail at:

Mailmark Inc.
Legal Department
[Address on file with Delaware Secretary of State]`,
  },
];

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="mt-4 text-gray-500 dark:text-gray-400">
            Last updated: <strong>January 15, 2026</strong>
          </p>
          <p className="mt-4 text-gray-600 dark:text-gray-300">
            Please read these terms carefully before using Mailmark. They
            describe the rules for using our platform and your rights and
            responsibilities as a user.
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
