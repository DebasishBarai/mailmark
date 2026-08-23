import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "../../../components/Header";
import Footer from "../../../components/Footer";
import ApplyForm from "./ApplyForm";
import {
  jobOpenings,
  getJobBySlug,
  generalApplication,
  GENERAL_APPLICATION_SLUG,
} from "../../../../lib/jobs";

export function generateStaticParams() {
  return [
    ...jobOpenings.map((job) => ({ slug: job.slug })),
    { slug: GENERAL_APPLICATION_SLUG },
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const title =
    slug === GENERAL_APPLICATION_SLUG ? generalApplication.title : getJobBySlug(slug)?.title;
  if (!title) return { title: "Role not found" };

  return {
    title: `Apply: ${title} - Mailmark`,
    description: `Apply for the ${title} role at Mailmark. Remote-first, async-friendly, and we reply to every application.`,
    // Application forms have no business in search results; the role pages do.
    robots: { index: false, follow: true },
  };
}

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const isGeneral = slug === GENERAL_APPLICATION_SLUG;
  const job = isGeneral ? generalApplication : getJobBySlug(slug);
  if (!job) notFound();

  return (
    <main className="bg-white dark:bg-gray-900">
      <Header />

      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-14 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-2xl">
          <Link
            href={isGeneral ? "/careers" : `/careers/${slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:underline dark:text-violet-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            {isGeneral ? "All open roles" : `Back to ${job.title}`}
          </Link>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
            {isGeneral ? "General application" : `Apply: ${job.title}`}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-gray-300">
            {isGeneral
              ? "Tell us what you do and what you'd want to build here. We keep general applications on file and come back to them when a matching role opens."
              : "Applications go straight to our hiring inbox and we read every one. You'll get a confirmation email as soon as this goes through."}
          </p>
        </div>
      </section>

      <section className="bg-white px-6 pb-20 pt-12 dark:bg-gray-900">
        <div className="mx-auto max-w-2xl">
          <ApplyForm jobSlug={slug} jobTitle={job.title} isGeneral={isGeneral} />
        </div>
      </section>

      <Footer />
    </main>
  );
}
