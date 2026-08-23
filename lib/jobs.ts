/**
 * Job openings for the Mailmark careers portal.
 *
 * Openings live here as typed data (rather than being inlined in the page)
 * so the careers index, the per-role detail pages, the apply form, the
 * JobPosting JSON-LD and the sitemap all read from one source.
 *
 * To open or close a role, edit `jobOpenings` below and deploy.
 */

export type Department = "Engineering" | "Design" | "Marketing";

export type JobOpening = {
  slug: string;
  title: string;
  department: Department;
  location: string;
  /** Employment type as shown on the page, e.g. "Full-time". */
  type: string;
  /** JobPosting schema employmentType, e.g. "FULL_TIME" / "PART_TIME" / "CONTRACTOR". */
  employmentType: string;
  /** One-paragraph summary used on the careers index card. */
  description: string;
  /** Longer intro shown at the top of the role detail page. */
  about: string;
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
  /** ISO date (YYYY-MM-DD) the role was posted. Used by JobPosting JSON-LD. */
  postedAt: string;
};

export const jobOpenings: JobOpening[] = [
  {
    slug: "full-stack-engineer",
    title: "Full-Stack Engineer",
    department: "Engineering",
    location: "Remote (Worldwide)",
    type: "Full-time",
    employmentType: "FULL_TIME",
    description:
      "Help us build and scale the core Mailmark platform: Next.js frontend, Convex backend, AWS email infrastructure. You'll own features end-to-end.",
    about:
      "You'll work across the whole Mailmark stack, from the inbox UI our users live in every day down to the SES and S3 plumbing that moves their mail. We're a small team, so you'll own features from first sketch through to production and the support tickets that follow.",
    responsibilities: [
      "Design, build and ship user-facing features across the mailbox, campaign builder and analytics surfaces",
      "Work in the Convex backend: schema design, queries, mutations and scheduled actions",
      "Integrate with AWS services (SES, S3, SNS, Lambda) that power sending and receiving",
      "Own the quality of what you ship, including tests, monitoring and incident response",
      "Review teammates' code and help shape our engineering conventions",
    ],
    requirements: [
      "3+ years building production web applications",
      "Strong TypeScript, React and Next.js experience",
      "Comfortable designing and evolving a database schema",
      "Able to work independently and communicate clearly in an async, remote team",
    ],
    niceToHave: [
      "Experience with email infrastructure (SES, SMTP, MIME, SPF/DKIM/DMARC)",
      "Familiarity with Convex or a similar reactive backend",
      "Prior work at an early-stage startup",
    ],
    postedAt: "2026-08-01",
  },
  {
    slug: "devops-infrastructure-engineer",
    title: "DevOps / Infrastructure Engineer",
    department: "Engineering",
    location: "Remote (Worldwide)",
    type: "Full-time",
    employmentType: "FULL_TIME",
    description:
      "Own our AWS infrastructure (SES, S3, Lambda), improve reliability, and help us scale email volume by 10x. Experience with email systems a big plus.",
    about:
      "Email infrastructure is the product. You'll own the AWS footprint that carries every message our customers send and receive, and you'll be the person who makes it fast, observable and boringly reliable as volume grows.",
    responsibilities: [
      "Own and evolve our AWS infrastructure: SES, S3, SNS, Lambda and IAM",
      "Improve deliverability through DNS, authentication and reputation monitoring",
      "Build observability into the sending and receiving pipelines",
      "Maintain the CloudFormation templates customers deploy into their own AWS accounts",
      "Lead incident response and drive the follow-up fixes",
    ],
    requirements: [
      "3+ years operating production infrastructure on AWS",
      "Solid grasp of IAM, networking and infrastructure as code",
      "Scripting or application experience in TypeScript, Python or Go",
      "Calm and methodical when things are on fire",
    ],
    niceToHave: [
      "Hands-on experience running email at scale (SES, Postfix, or similar)",
      "Knowledge of SPF, DKIM, DMARC and inbox placement",
      "Experience with multi-account AWS setups and AssumeRole patterns",
    ],
    postedAt: "2026-08-01",
  },
  {
    slug: "product-designer",
    title: "Product Designer",
    department: "Design",
    location: "Remote (Worldwide)",
    type: "Full-time",
    employmentType: "FULL_TIME",
    description:
      "Design beautiful, intuitive product experiences across our inbox, campaign builder, and analytics surfaces. Own the design system end-to-end.",
    about:
      "Mailmark competes with tools people have used for twenty years, so the bar for clarity is high. You'll own how the product looks and feels, from the first-run domain setup through the daily inbox to the campaign analytics our customers report on.",
    responsibilities: [
      "Own end-to-end design for major product surfaces, from research to shipped UI",
      "Build and maintain the Mailmark design system",
      "Turn complex email concepts (authentication, warming, deliverability) into interfaces people understand",
      "Work directly with engineers through implementation, not just handoff",
      "Talk to customers regularly and feed what you learn back into the roadmap",
    ],
    requirements: [
      "3+ years designing web products, with a portfolio that shows shipped work",
      "Strong visual craft alongside solid interaction and information design",
      "Comfortable working in Figma and reasoning about component systems",
      "Able to scope and prioritise your own work in a small team",
    ],
    niceToHave: [
      "Experience designing developer or infrastructure tools",
      "Enough front-end skill to prototype in HTML/CSS or React",
      "Prior work on data-dense dashboards",
    ],
    postedAt: "2026-08-01",
  },
  {
    slug: "content-seo-writer",
    title: "Content & SEO Writer",
    department: "Marketing",
    location: "Remote (Worldwide)",
    type: "Part-time / Contract",
    employmentType: "CONTRACTOR",
    description:
      "Create high-quality content including blog posts, docs, and email guides that drives organic growth and helps users get the most from Mailmark.",
    about:
      "Most of our growth comes from people searching for answers about email deliverability and finding us. You'll write the material that earns those visits and turns them into customers, covering everything from DNS records to campaign strategy.",
    responsibilities: [
      "Research and write blog posts, guides and product documentation",
      "Own keyword research and the content calendar",
      "Keep existing docs accurate as the product changes",
      "Work with engineering to get the technical details right",
      "Track what content actually drives signups and do more of it",
    ],
    requirements: [
      "2+ years writing technical or SaaS content with published samples",
      "Practical SEO knowledge, including keyword research and on-page optimisation",
      "Able to learn a technical subject well enough to explain it simply",
      "Reliable self-directed output on a part-time schedule",
    ],
    niceToHave: [
      "Existing knowledge of email marketing or deliverability",
      "Experience writing developer documentation",
      "Basic comfort with Markdown and Git",
    ],
    postedAt: "2026-08-01",
  },
];

/**
 * Pseudo-opening backing the "don't see a perfect fit" general application.
 * It is intentionally not part of `jobOpenings`, so it never appears as an
 * open role on the index page or in the sitemap.
 */
export const GENERAL_APPLICATION_SLUG = "general";

export const generalApplication = {
  slug: GENERAL_APPLICATION_SLUG,
  title: "General Application",
  department: "Engineering" as Department,
  location: "Remote (Worldwide)",
  type: "Open",
};

/** Every slug the apply form will accept, including the general application. */
export function isApplicableSlug(slug: string): boolean {
  return slug === GENERAL_APPLICATION_SLUG || jobOpenings.some((j) => j.slug === slug);
}

export function getJobBySlug(slug: string): JobOpening | undefined {
  return jobOpenings.find((j) => j.slug === slug);
}

/** Job title for a slug, falling back to the general application title. */
export function getJobTitle(slug: string): string | undefined {
  if (slug === GENERAL_APPLICATION_SLUG) return generalApplication.title;
  return getJobBySlug(slug)?.title;
}

export const departmentColors: Record<Department, string> = {
  Engineering: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  Design: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  Marketing: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};
