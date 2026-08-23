import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { jobOpenings, getJobBySlug, departmentColors } from "../../../lib/jobs";

export function generateStaticParams() {
  return jobOpenings.map((job) => ({ slug: job.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const job = getJobBySlug(slug);
  if (!job) return { title: "Role not found" };

  return {
    title: `${job.title} - Careers`,
    description: job.description,
    keywords: [
      job.title,
      `${job.title} remote`,
      "Mailmark careers",
      `${job.department} jobs`,
      "remote email startup jobs",
    ],
    alternates: { canonical: `https://www.mailmark.dev/careers/${job.slug}` },
  };
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-10">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            <svg
              className="mt-1 h-4 w-4 shrink-0 self-start text-violet-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const job = getJobBySlug(slug);
  if (!job) notFound();

  // JobPosting structured data so the role is eligible for Google Jobs.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: `<p>${job.about}</p><p><strong>What you'll do</strong></p><ul>${job.responsibilities
      .map((r) => `<li>${r}</li>`)
      .join("")}</ul><p><strong>What we're looking for</strong></p><ul>${job.requirements
      .map((r) => `<li>${r}</li>`)
      .join("")}</ul>`,
    datePosted: job.postedAt,
    employmentType: job.employmentType,
    hiringOrganization: {
      "@type": "Organization",
      name: "Mailmark",
      sameAs: "https://www.mailmark.dev",
      logo: "https://www.mailmark.dev/icon.svg",
    },
    jobLocationType: "TELECOMMUTE",
    applicantLocationRequirements: { "@type": "Country", name: "Worldwide" },
    directApply: true,
    url: `https://www.mailmark.dev/careers/${job.slug}`,
  };

  return (
    <main className="bg-white dark:bg-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />

      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-16 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/careers"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:underline dark:text-violet-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            All open roles
          </Link>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
            {job.title}
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
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
          <Link
            href={`/careers/${job.slug}/apply`}
            className="mt-8 inline-block rounded-full bg-violet-600 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
          >
            Apply for this role
          </Link>
        </div>
      </section>

      <section className="bg-white px-6 py-16 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl">
          <p className="text-base leading-relaxed text-gray-600 dark:text-gray-300">{job.about}</p>

          <BulletList title="What you'll do" items={job.responsibilities} />
          <BulletList title="What we're looking for" items={job.requirements} />
          <BulletList title="Nice to have" items={job.niceToHave} />

          <div className="mt-14 rounded-2xl border border-violet-100 bg-violet-50 p-8 text-center dark:border-violet-800 dark:bg-violet-900/20">
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              Sound like you?
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Apply in a couple of minutes. You&apos;ll get an email from us confirming we&apos;ve got it.
            </p>
            <Link
              href={`/careers/${job.slug}/apply`}
              className="mt-6 inline-block rounded-full bg-violet-600 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
            >
              Apply for this role
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
