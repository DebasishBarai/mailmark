import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { articles } from "./articles";

const categoryColors: Record<string, string> = {
  Guides: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  Deliverability: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  Campaigns: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "Product Updates": "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};



export async function generateStaticParams() {
  return Object.keys(articles).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = articles[slug];
  if (!article) return { title: "Article Not Found" };
  const url = `https://www.mailmark.dev/blog/${slug}`;
  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: article.title,
      description: article.excerpt,
      publishedTime: new Date(article.date).toISOString(),
      section: article.category,
      // No `images` here on purpose. opengraph-image.tsx and
      // twitter-image.tsx generate a card carrying this article's own title,
      // and naming an image in this object would override them with the
      // site-wide one, so every post would unfurl identically again.
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt,
    },
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = articles[slug];

  if (!article) {
    notFound();
  }

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    datePublished: new Date(article.date).toISOString(),
    author: {
      "@type": "Organization",
      name: "Mailmark",
      url: "https://www.mailmark.dev",
    },
    publisher: {
      "@type": "Organization",
      name: "Mailmark",
      url: "https://www.mailmark.dev",
      logo: {
        // The mark itself, not the social card, which carries a headline.
        "@type": "ImageObject",
        url: "https://www.mailmark.dev/logo-icon.png",
        width: 200,
        height: 200,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://www.mailmark.dev/blog/${slug}`,
    },
  };

  return (
    <main className="bg-white dark:bg-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-20 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400">
            <Link href="/blog" className="hover:underline">
              Blog
            </Link>
            <span>/</span>
            <span className="text-gray-500 dark:text-gray-400">
              {article.category}
            </span>
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            {article.title}
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            {article.excerpt}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${categoryColors[article.category]}`}
            >
              {article.category}
            </span>
            <span className="flex items-center gap-1.5">
              <svg
                className="h-4 w-4 text-violet-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {article.readTime}
            </span>
            <span>{article.date}</span>
          </div>
        </div>
      </section>

      {/* Article content */}
      <section className="bg-white px-6 py-12 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl">
          {article.sections.map((section, i) => (
            <div key={i} className="mb-10">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {section.heading}
              </h2>
              {section.content.map((paragraph, j) => (
                <p
                  key={j}
                  className="mt-4 leading-relaxed text-gray-600 dark:text-gray-300"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          ))}

          {/* Back to blog */}
          <div className="border-t border-gray-100 pt-10 dark:border-gray-700">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5L8.25 12l7.5-7.5"
                />
              </svg>
              Back to all articles
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
