import type { Metadata } from "next";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { jobOpenings, departmentColors, GENERAL_APPLICATION_SLUG } from "../../lib/jobs";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "Join the Mailmark team. We're a remote-first company building the future of professional email hosting and campaigns.",
};

const perks = [
  { label: "Remote-first", description: "Work from anywhere in the world. Async-friendly culture." },
  { label: "Competitive salary", description: "Top-of-market compensation based on skills and experience." },
  { label: "Equity", description: "Meaningful equity in an early-stage company with real traction." },
  { label: "Health & wellness", description: "$200/month stipend for health insurance or wellness expenses." },
  { label: "Home office budget", description: "$1,500 one-time budget to set up your ideal workspace." },
  { label: "Unlimited PTO", description: "We trust you to manage your time. Minimum 20 days encouraged." },
];

// Openings moved to lib/jobs.ts so the index, the /careers/[slug] detail
// pages, the apply form and the sitemap all read from one source.
// const openings = [
//   {
//     title: "Full-Stack Engineer",
//     department: "Engineering",
//     location: "Remote (Worldwide)",
//     type: "Full-time",
//     description:
//       "Help us build and scale the core Mailmark platform: Next.js frontend, Convex backend, AWS email infrastructure. You'll own features end-to-end.",
//   },
//   {
//     title: "DevOps / Infrastructure Engineer",
//     department: "Engineering",
//     location: "Remote (Worldwide)",
//     type: "Full-time",
//     description:
//       "Own our AWS infrastructure (SES, S3, Lambda), improve reliability, and help us scale email volume by 10×. Experience with email systems a big plus.",
//   },
//   {
//     title: "Product Designer",
//     department: "Design",
//     location: "Remote (Worldwide)",
//     type: "Full-time",
//     description:
//       "Design beautiful, intuitive product experiences across our inbox, campaign builder, and analytics surfaces. Own the design system end-to-end.",
//   },
//   {
//     title: "Content & SEO Writer",
//     department: "Marketing",
//     location: "Remote (Worldwide)",
//     type: "Part-time / Contract",
//     description:
//       "Create high-quality content including blog posts, docs, and email guides that drives organic growth and helps users get the most from Mailmark.",
//   },
// ];
const openings = jobOpenings;


// Replaced by departmentColors in lib/jobs.ts.
// const deptColors: Record<string, string> = {
//   Engineering: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
//   Design: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
//   Marketing: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
// };

export default function CareersPage() {
  return (
    <main className="bg-white dark:bg-gray-900">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-24 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-violet-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            Careers
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Build the future of email
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-gray-600 dark:text-gray-300">
            We&apos;re a small, passionate team on a mission to make professional
            email hosting and campaigns accessible to every business. Come help
            us build it.
          </p>
        </div>
      </section>

      {/* Perks */}
      <section className="bg-white px-6 py-16 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white">Why Mailmark</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {perks.map((perk) => (
              <div
                key={perk.label}
                className="rounded-2xl border border-gray-100 p-6 transition-all hover:border-violet-200 hover:shadow-md dark:border-gray-700 dark:hover:border-violet-700"
              >
                <p className="font-semibold text-gray-900 dark:text-white">{perk.label}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{perk.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open roles */}
      <section className="bg-gray-50 px-6 py-16 dark:bg-gray-800">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Open positions</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            {openings.length} open role{openings.length !== 1 ? "s" : ""} · All positions are remote
          </p>
          <div className="mt-8 space-y-4">
            {openings.map((job) => (
              <div
                key={job.slug}
                className="rounded-2xl border border-gray-100 bg-white p-6 transition-all hover:border-violet-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:hover:border-violet-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      <Link href={`/careers/${job.slug}`} className="hover:text-violet-700 dark:hover:text-violet-400">
                        {job.title}
                      </Link>
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${departmentColors[job.department]}`}>
                        {job.department}
                      </span>
                      <span className="rounded-full bg-gray-100 px-3 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {job.location}
                      </span>
                      <span className="rounded-full bg-gray-100 px-3 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {job.type}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/careers/${job.slug}`}
                    className="shrink-0 rounded-full border border-violet-600 px-5 py-2 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50 dark:border-violet-500 dark:text-violet-400 dark:hover:bg-violet-900/20"
                  >
                    View role
                  </Link>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{job.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-2xl border border-dashed border-gray-200 p-8 text-center dark:border-gray-600">
            <p className="font-medium text-gray-700 dark:text-gray-200">Don&apos;t see a perfect fit?</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              We&apos;re always interested in exceptional people. Send us a general
              application and we&apos;ll come back to you when a matching role opens.
            </p>
            <Link
              href={`/careers/${GENERAL_APPLICATION_SLUG}/apply`}
              className="mt-5 inline-block rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
            >
              Send a general application
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
