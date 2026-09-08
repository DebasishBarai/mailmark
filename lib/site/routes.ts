/**
 * The canonical list of public URLs on www.mailmark.dev.
 *
 * One registry feeds the sitemap, the Markdown variants served through
 * content negotiation, and the recovery links on the 404 page, so a new public
 * page shows up in all three at once instead of drifting between them.
 */

import { articles } from "../../app/blog/[slug]/articles";

export const BASE_URL = "https://www.mailmark.dev";

export type SiteSection =
  | "Product"
  | "Docs"
  | "Guides"
  | "Tools"
  | "Blog"
  | "Company"
  | "Legal";

export interface SiteRoute {
  /** Path relative to the site root, always starting with "/". */
  path: string;
  title: string;
  description: string;
  section: SiteSection;
  priority: number;
  changeFrequency: "daily" | "weekly" | "monthly";
}

export const SITE_ROUTES: SiteRoute[] = [
  {
    path: "/",
    title: "Mailmark",
    description:
      "Email hosting and campaigns for your own domain: mailboxes, campaigns, sequences, warmup, and a REST API.",
    section: "Product",
    priority: 1.0,
    changeFrequency: "weekly",
  },

  // Docs
  {
    path: "/docs",
    title: "Documentation",
    description:
      "Everything you need to set up and use Mailmark, from adding your first domain to running advanced email campaigns.",
    section: "Docs",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/docs/getting-started",
    title: "Getting Started",
    description:
      "Set up Mailmark in minutes. Create your account, verify a domain, and send your first email.",
    section: "Docs",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/docs/domain-setup",
    title: "Domain Setup",
    description:
      "Configure DNS records to verify your domain and ensure reliable email delivery.",
    section: "Docs",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/docs/mailboxes",
    title: "Mailboxes",
    description:
      "Create and manage the email addresses on your verified domain, from the dashboard or the API.",
    section: "Docs",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/docs/email-campaigns",
    title: "Email Campaigns",
    description:
      "Send bulk campaign emails with mail merge, scheduling, follow-ups, and analytics.",
    section: "Docs",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/docs/troubleshooting",
    title: "Troubleshooting",
    description:
      "Fixes for the problems that come up most: emails not sending, domain verification, bounces.",
    section: "Docs",
    priority: 0.6,
    changeFrequency: "monthly",
  },
  {
    path: "/docs/byo-aws",
    title: "Bring your own AWS",
    description:
      "Run the Mailmark email infrastructure inside your own AWS account with CloudFormation.",
    section: "Docs",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/docs/warmup",
    title: "Email Warmup",
    description:
      "Build sender reputation automatically before you send at volume.",
    section: "Docs",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/docs/sequences",
    title: "Sequences",
    description:
      "Automated multi-step follow-ups that stop when a contact replies.",
    section: "Docs",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/docs/api",
    title: "API Reference",
    description:
      "The Mailmark REST API: authentication, sending, mailboxes, sequences, stats, and webhooks.",
    section: "Docs",
    priority: 0.8,
    changeFrequency: "monthly",
  },

  // Guides
  {
    path: "/guides/dns-setup",
    title: "DNS Setup Guide",
    description:
      "A record-by-record walkthrough of the MX, SPF, DKIM, and DMARC entries email needs.",
    section: "Guides",
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/guides/email-deliverability",
    title: "Email Deliverability Guide",
    description:
      "What decides whether your email reaches the inbox, and how to stay out of spam.",
    section: "Guides",
    priority: 0.7,
    changeFrequency: "monthly",
  },

  // Tools
  {
    path: "/tools",
    title: "Free Email Tools",
    description:
      "Free tools for deliverability checks, list validation, spam scoring, lead search, and more.",
    section: "Tools",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/tools/email-deliverability-checker",
    title: "Email Deliverability Checker",
    description:
      "Check SPF, DKIM, DMARC, MX, and blacklist status for any domain.",
    section: "Tools",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/tools/ses-savings-calculator",
    title: "SES Savings Calculator",
    description:
      "Compare what your email volume costs on Amazon SES against other providers.",
    section: "Tools",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/tools/subject-line-generator",
    title: "Cold Email Subject Line Generator",
    description:
      "Generate cold email subject lines for a described audience and offer.",
    section: "Tools",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/tools/lead-finder",
    title: "Cold Email Lead Finder",
    description: "Find business leads and their public contact details.",
    section: "Tools",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/tools/email-list-validator",
    title: "Email List Validator",
    description:
      "Validate a list of addresses for syntax, disposable domains, MX records, and role accounts.",
    section: "Tools",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/tools/spam-score-tester",
    title: "Email Spam Score Tester",
    description:
      "Score an email's subject and body against the patterns that trigger spam filters.",
    section: "Tools",
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/tools/email-signature-generator",
    title: "Email Signature Generator",
    description: "Build an HTML email signature you can paste into any client.",
    section: "Tools",
    priority: 0.8,
    changeFrequency: "monthly",
  },

  // Blog index (individual posts are appended from the article registry)
  {
    path: "/blog",
    title: "Blog",
    description:
      "Guides and product notes on custom domain email, deliverability, and campaigns.",
    section: "Blog",
    priority: 0.8,
    changeFrequency: "weekly",
  },

  // Company
  {
    path: "/about",
    title: "About Mailmark",
    description: "Who builds Mailmark and why.",
    section: "Company",
    priority: 0.5,
    changeFrequency: "monthly",
  },
  {
    path: "/contact",
    title: "Contact",
    description: "How to reach the Mailmark team.",
    section: "Company",
    priority: 0.5,
    changeFrequency: "monthly",
  },
  {
    path: "/careers",
    title: "Careers",
    description: "Open roles at Mailmark.",
    section: "Company",
    priority: 0.5,
    changeFrequency: "monthly",
  },
  {
    path: "/affiliate-program",
    title: "Affiliate Program",
    description: "Earn recurring commission for referring Mailmark customers.",
    section: "Company",
    priority: 0.5,
    changeFrequency: "monthly",
  },
  {
    path: "/status",
    title: "System Status",
    description: "Live status of the Mailmark platform.",
    section: "Company",
    priority: 0.5,
    changeFrequency: "daily",
  },

  // Legal
  {
    path: "/security",
    title: "Security",
    description: "How Mailmark protects accounts, email data, and credentials.",
    section: "Legal",
    priority: 0.4,
    changeFrequency: "monthly",
  },
  {
    path: "/privacy",
    title: "Privacy Policy",
    description: "What Mailmark collects, why, and how it is handled.",
    section: "Legal",
    priority: 0.4,
    changeFrequency: "monthly",
  },
  {
    path: "/terms",
    title: "Terms of Service",
    description: "The terms that govern use of Mailmark.",
    section: "Legal",
    priority: 0.4,
    changeFrequency: "monthly",
  },
];

/** Blog posts, derived from the article registry so the two cannot drift. */
export const BLOG_ROUTES: SiteRoute[] = Object.entries(articles).map(
  ([slug, article]) => ({
    path: `/blog/${slug}`,
    title: article.title,
    description: article.excerpt,
    section: "Blog" as const,
    priority: 0.7,
    changeFrequency: "monthly" as const,
  })
);

/** Every public route on the site, static pages first. */
export const ALL_ROUTES: SiteRoute[] = [...SITE_ROUTES, ...BLOG_ROUTES];

const ROUTES_BY_PATH = new Map(ALL_ROUTES.map((route) => [route.path, route]));

/** Normalises a request path: strips a trailing slash and a ".md" suffix. */
export function normalizePath(pathname: string): string {
  let path = pathname.trim();
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path === "" ? "/" : path;
}

export function findRoute(pathname: string): SiteRoute | undefined {
  return ROUTES_BY_PATH.get(normalizePath(pathname));
}

export function routesInSection(section: SiteSection): SiteRoute[] {
  return ALL_ROUTES.filter((route) => route.section === section);
}
