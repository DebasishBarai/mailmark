/**
 * The open roles, and the department colours that go with them.
 *
 * Lifted out of the careers page so the application form can name the same
 * roles. The form validates the role it was handed against this list, so a
 * role can never exist on one page and not the other, and a link carrying a
 * made-up role falls back to the empty selection rather than being stored.
 */

export type Opening = {
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
};

export const openings: Opening[] = [
  {
    title: "Full-Stack Engineer",
    department: "Engineering",
    location: "Remote (Worldwide)",
    type: "Full-time",
    description:
      "Help us build and scale the core Mailmark platform: Next.js frontend, Convex backend, AWS email infrastructure. You'll own features end-to-end.",
  },
  {
    title: "DevOps / Infrastructure Engineer",
    department: "Engineering",
    location: "Remote (Worldwide)",
    type: "Full-time",
    description:
      "Own our AWS infrastructure (SES, S3, Lambda), improve reliability, and help us scale email volume by 10×. Experience with email systems a big plus.",
  },
  {
    title: "Product Designer",
    department: "Design",
    location: "Remote (Worldwide)",
    type: "Full-time",
    description:
      "Design beautiful, intuitive product experiences across our inbox, campaign builder, and analytics surfaces. Own the design system end-to-end.",
  },
  {
    title: "Content & SEO Writer",
    department: "Marketing",
    location: "Remote (Worldwide)",
    type: "Part-time / Contract",
    description:
      "Create high-quality content including blog posts, docs, and email guides that drives organic growth and helps users get the most from Mailmark.",
  },
];

export const deptColors: Record<string, string> = {
  Engineering: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  Design: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  Marketing: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

// The role someone applies to when nothing on the list fits. Defined next to
// the acknowledgement builder, which words itself differently for it, and
// re-exported here so the page and the form have one import for the roles.
export { OPEN_APPLICATION } from "../../convex/lib/jobApplication";
import { OPEN_APPLICATION } from "../../convex/lib/jobApplication";

export function isKnownRole(title: string): boolean {
  return title === OPEN_APPLICATION || openings.some((o) => o.title === title);
}

// Where applications land when someone would rather email than use the form.
export const JOBS_EMAIL = "jobs@mailmark.dev";
