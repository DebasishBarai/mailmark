import type { MetadataRoute } from "next";

const BASE_URL = "https://www.mailmark.dev";

const blogSlugs = [
  "getting-started-with-custom-domain-emails",
  "understanding-spf-dkim-and-dmarc",
  "email-campaign-best-practices-2026",
  "improve-email-deliverability-rate",
  "mailmark-1-0-whats-new",
  "managing-team-mailboxes-at-scale",
  "building-winning-email-campaign-strategy",
  "why-emails-land-in-spam",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, priority: 1.0, changeFrequency: "weekly" },
    { url: `${BASE_URL}/blog`, priority: 0.8, changeFrequency: "weekly" },
    { url: `${BASE_URL}/docs/getting-started`, priority: 0.8, changeFrequency: "monthly" },
    { url: `${BASE_URL}/docs/domain-setup`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${BASE_URL}/docs/mailboxes`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${BASE_URL}/docs/email-campaigns`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${BASE_URL}/docs/troubleshooting`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${BASE_URL}/docs/api`, priority: 0.6, changeFrequency: "monthly" },
    { url: `${BASE_URL}/guides/dns-setup`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${BASE_URL}/guides/email-deliverability`, priority: 0.7, changeFrequency: "monthly" },
    { url: `${BASE_URL}/about`, priority: 0.5, changeFrequency: "monthly" },
    { url: `${BASE_URL}/contact`, priority: 0.5, changeFrequency: "monthly" },
    { url: `${BASE_URL}/careers`, priority: 0.5, changeFrequency: "monthly" },
    { url: `${BASE_URL}/affiliate-program`, priority: 0.5, changeFrequency: "monthly" },
    { url: `${BASE_URL}/security`, priority: 0.4, changeFrequency: "monthly" },
    { url: `${BASE_URL}/privacy`, priority: 0.4, changeFrequency: "monthly" },
    { url: `${BASE_URL}/terms`, priority: 0.4, changeFrequency: "monthly" },
  ];

  const blogRoutes: MetadataRoute.Sitemap = blogSlugs.map((slug) => ({
    url: `${BASE_URL}/blog/${slug}`,
    priority: 0.7,
    changeFrequency: "monthly",
  }));

  return [...staticRoutes, ...blogRoutes];
}
