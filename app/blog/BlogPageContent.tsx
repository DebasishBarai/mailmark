"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";

const categories = ["All", "Guides", "Deliverability", "Campaigns", "Product Updates"];

const posts = [
  {
    slug: "/blog/getting-started-with-custom-domain-emails",
    category: "Guides",
    title: "Getting Started with Custom Domain Emails",
    excerpt:
      "Learn how to set up your own branded email addresses in under 10 minutes. We walk through domain verification, MX record setup, and creating your first mailbox.",
    date: "Jan 28, 2026",
    readTime: "6 min read",
    featured: true,
  },
  {
    slug: "/blog/understanding-spf-dkim-and-dmarc",
    category: "Deliverability",
    title: "Understanding SPF, DKIM, and DMARC",
    excerpt:
      "The three pillars of email authentication explained. Find out why these records matter and how Mailmark sets them up automatically for you.",
    date: "Jan 20, 2026",
    readTime: "8 min read",
    featured: false,
  },
  {
    slug: "/blog/email-campaign-best-practices-2026",
    category: "Campaigns",
    title: "10 Email Campaign Best Practices for 2026",
    excerpt:
      "From subject line testing to optimal send times, these field-tested tactics will boost your open rates and conversions.",
    date: "Jan 14, 2026",
    readTime: "10 min read",
    featured: false,
  },
  {
    slug: "/blog/improve-email-deliverability-rate",
    category: "Deliverability",
    title: "How to Improve Your Email Deliverability Rate",
    excerpt:
      "Deliverability starts long before you hit send. This guide covers sender reputation, list hygiene, bounce management, and more.",
    date: "Jan 7, 2026",
    readTime: "7 min read",
    featured: false,
  },
  {
    slug: "/blog/mailmark-1-0-whats-new",
    category: "Product Updates",
    title: "Mailmark 1.0: What's New",
    excerpt:
      "We launched! Here's everything included in our first public release — domains, mailboxes, campaigns, analytics, and team collaboration.",
    date: "Dec 20, 2025",
    readTime: "4 min read",
    featured: false,
  },
  {
    slug: "/blog/managing-team-mailboxes-at-scale",
    category: "Guides",
    title: "Managing Team Mailboxes at Scale",
    excerpt:
      "Assign mailboxes to team members, set permissions, and collaborate without sharing passwords. A deep dive into Mailmark's team features.",
    date: "Dec 12, 2025",
    readTime: "5 min read",
    featured: false,
  },
  {
    slug: "/blog/building-winning-email-campaign-strategy",
    category: "Campaigns",
    title: "Building a Winning Email Campaign Strategy",
    excerpt:
      "Cold outreach, newsletters, or onboarding sequences — your strategy should match your goal. Here's how to think about it.",
    date: "Dec 5, 2025",
    readTime: "9 min read",
    featured: false,
  },
  {
    slug: "/blog/why-emails-land-in-spam",
    category: "Deliverability",
    title: "Why Your Emails Land in Spam (And How to Fix It)",
    excerpt:
      "Spam filters are sophisticated. Learn the most common reasons emails get flagged and the concrete steps you can take to fix each one.",
    date: "Nov 28, 2025",
    readTime: "11 min read",
    featured: false,
  },
];

const categoryColors: Record<string, string> = {
  Guides: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  Deliverability: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  Campaigns: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "Product Updates": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

export default function BlogPageContent() {
  const [activeCategory, setActiveCategory] = useState("All");

  const filteredPosts =
    activeCategory === "All"
      ? posts
      : posts.filter((post) => post.category === activeCategory);

  const featuredPost = filteredPosts.find((post) => post.featured) ?? filteredPosts[0];
  const rest = filteredPosts.filter((post) => post !== featuredPost);

  return (
    <main className="bg-white dark:bg-gray-900">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-20 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-7xl text-center">
          <span className="inline-block rounded-full bg-violet-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            Mailmark Blog
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Email tips & product news
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-600 dark:text-gray-300">
            Guides, deliverability deep-dives, campaign strategies, and the
            latest from the Mailmark team.
          </p>
        </div>
      </section>

      {/* Categories */}
      <section className="border-b border-gray-100 bg-white px-6 dark:border-gray-700 dark:bg-gray-900">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto py-4">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                cat === activeCategory
                  ? "bg-violet-600 text-white"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      <section className="bg-white px-6 py-16 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl">
          {/* Featured post */}
          {featuredPost && (
            <div className="mb-14 overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-br from-violet-50 to-white transition-shadow hover:shadow-lg dark:border-gray-700 dark:from-violet-950/20 dark:to-gray-900">
              <div className="p-8 sm:p-12">
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${categoryColors[featuredPost.category]}`}
                >
                  {featuredPost.category}
                </span>
                <h2 className="mt-4 text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
                  {featuredPost.title}
                </h2>
                <p className="mt-3 max-w-2xl text-gray-600 dark:text-gray-300">{featuredPost.excerpt}</p>
                <div className="mt-6 flex items-center gap-4">
                  <span className="text-sm text-gray-400 dark:text-gray-500">{featuredPost.date}</span>
                  <span className="text-sm text-gray-400 dark:text-gray-500">·</span>
                  <span className="text-sm text-gray-400 dark:text-gray-500">{featuredPost.readTime}</span>
                  <Link
                    href={featuredPost.slug}
                    className="ml-auto rounded-full bg-violet-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
                  >
                    Read article →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Post grid */}
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((post) => (
              <article
                key={post.title}
                className="flex flex-col rounded-2xl border border-gray-100 bg-white p-6 transition-all hover:border-violet-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-violet-700"
              >
                <span
                  className={`self-start rounded-full px-3 py-1 text-xs font-semibold ${categoryColors[post.category]}`}
                >
                  {post.category}
                </span>
                <h3 className="mt-3 text-lg font-semibold text-gray-900 dark:text-white">
                  {post.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                  {post.excerpt}
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-xs text-gray-400 dark:text-gray-500">{post.date}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">·</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{post.readTime}</span>
                  <Link
                    href={post.slug}
                    className="ml-auto text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                  >
                    Read →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
