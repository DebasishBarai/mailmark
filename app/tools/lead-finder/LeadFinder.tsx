"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { SignInButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated } from "convex/react";

const industries = [
  "All Industries",
  "Technology",
  "Marketing",
  "Finance",
  "Healthcare",
  "Real Estate",
  "E-commerce",
  "Education",
  "Legal",
  "Consulting",
];

const titles = [
  "All Titles",
  "CEO",
  "CTO",
  "VP Marketing",
  "Head of Sales",
  "Founder",
  "CMO",
  "COO",
  "Director of Engineering",
  "Product Manager",
];

const companySizes = [
  "All Sizes",
  "1-10",
  "11-50",
  "51-200",
  "201-1000",
  "1000+",
];

const countries = [
  "All Countries",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "India",
];

const faqItems = [
  {
    q: "How do I find leads for cold email?",
    a: "Start by defining your ideal customer profile: industry, company size, job title, and location. Use a lead finder tool to search for contacts matching those criteria, then verify their email addresses before sending. Quality over quantity matters more in cold email than any other channel.",
  },
  {
    q: "How many cold emails should I send per day?",
    a: "Start with 20-30 per day on a new domain and gradually increase. A warmed-up domain can safely handle 100-200 emails per day. Going too fast too soon will damage your sender reputation and land you in spam folders.",
  },
  {
    q: "What's a good cold email response rate?",
    a: "A 5-10% reply rate is considered good for cold outreach. Top performers see 15-25% by combining highly targeted leads, personalized messaging, and proper deliverability setup. The quality of your leads matters as much as your copy.",
  },
  {
    q: "Should I use a separate domain for cold email?",
    a: "Yes. Always use a separate domain (e.g. yourbrand-mail.com) for cold outreach to protect your main domain's reputation. If something goes wrong, your primary domain stays clean.",
  },
];

interface Lead {
  id: string;
  name: string;
  title: string;
  company: string;
  industry: string;
  companySize: string;
  country: string;
  email: string;
}

function LeadFinderInner({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [industry, setIndustry] = useState("All Industries");
  const [title, setTitle] = useState("All Titles");
  const [companySize, setCompanySize] = useState("All Sizes");
  const [country, setCountry] = useState("All Countries");
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [realLeads, setRealLeads] = useState<Lead[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const signInRef = useRef<HTMLButtonElement>(null);

  async function handleSearch() {
    setError(null);

    if (isAuthenticated) {
      setLoading(true);
      setHasSearched(false);
      setRealLeads([]);

      try {
        const res = await fetch("/api/tools/search-leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ industry, title, companySize, country }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Something went wrong. Please try again.");
          if (data.searchesRemaining !== undefined) {
            setRemaining(data.searchesRemaining);
          }
          setHasSearched(true);
          return;
        }

        setRealLeads(data.leads);
        if (data.searchesRemaining !== undefined) {
          setRemaining(data.searchesRemaining);
        }
        setHasSearched(true);
      } catch {
        setError(
          "Failed to connect. Please check your internet and try again."
        );
        setHasSearched(true);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(true);
      setHasSearched(false);
      setTimeout(() => {
        setLoading(false);
        setHasSearched(true);
        setShowSignIn(true);
      }, 2500);
    }
  }

  const results = realLeads;

  const selectClasses =
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:ring-violet-900/30";

  return (
    <>
      {/* Hero + Filters */}
      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-20 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400">
            <Link href="/tools" className="hover:underline">
              Tools
            </Link>
            <span>/</span>
            <span className="text-gray-500 dark:text-gray-400">
              Lead Finder
            </span>
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Find Your Next Customers in Seconds
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            Stop wasting hours searching for leads. Find B2B contacts by
            industry, job title, and company size. Export them and start
            emailing today.
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Free to search. Sign in to unlock full results.
          </p>

          {/* Filters */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Industry
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className={selectClasses}
                disabled={loading}
              >
                {industries.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Job Title
              </label>
              <select
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={selectClasses}
                disabled={loading}
              >
                {titles.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Company Size
              </label>
              <select
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                className={selectClasses}
                disabled={loading}
              >
                {companySizes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Country
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={selectClasses}
                disabled={loading}
              >
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="rounded-full bg-violet-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-violet-200 transition-all hover:bg-violet-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-violet-900/30"
            >
              {loading ? "Searching..." : "Find Leads"}
            </button>
            {isAuthenticated && hasSearched && !loading && (
              <span className="rounded-full bg-violet-100 px-4 py-1.5 text-sm font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                {results.length} lead{results.length !== 1 ? "s" : ""} found
              </span>
            )}
            {remaining !== null && remaining > 0 && isAuthenticated && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {remaining} search{remaining !== 1 ? "es" : ""} remaining today
              </span>
            )}
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          {loading && (
            <div className="mt-6 flex items-center gap-3">
              <svg
                className="h-5 w-5 animate-spin text-violet-600 dark:text-violet-400"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Searching for leads matching your criteria...
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Blurred results + sign-in overlay for unauthenticated users */}
      {!isAuthenticated && hasSearched && !loading && showSignIn && (
        <section className="bg-white px-6 py-16 dark:bg-gray-900">
          <div className="mx-auto max-w-4xl">
            <div className="relative">
              {/* Blurred fake table */}
              <div className="select-none overflow-hidden rounded-2xl border border-gray-200 blur-[6px] dark:border-gray-700">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                      <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Name</th>
                      <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Title</th>
                      <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Company</th>
                      <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Size</th>
                      <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3 text-gray-900 dark:text-white">John Richardson</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Marketing Director</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">Acme Solutions Inc.</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">51-200</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">john@acmesolutions.com</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Sign-in overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-2xl border border-violet-200 bg-white/95 px-8 py-8 text-center shadow-xl backdrop-blur-sm dark:border-violet-800 dark:bg-gray-900/95">
                  <svg
                    className="mx-auto h-10 w-10 text-violet-500 dark:text-violet-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                    />
                  </svg>
                  <h3 className="mt-3 text-lg font-semibold text-gray-900 dark:text-white">
                    We found leads matching your criteria
                  </h3>
                  <p className="mt-2 max-w-sm text-sm text-gray-600 dark:text-gray-300">
                    Sign in to view real, verified B2B contacts with full
                    email addresses.
                  </p>
                  <SignInButton
                    mode="modal"
                    forceRedirectUrl="/tools/lead-finder"
                  >
                    <button
                      ref={signInRef}
                      className="mt-4 inline-flex rounded-full bg-violet-600 px-8 py-3 text-base font-semibold text-white shadow-sm transition-all hover:bg-violet-700 hover:shadow-md"
                    >
                      Sign In to View Leads
                    </button>
                  </SignInButton>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Results for authenticated users */}
      {isAuthenticated && hasSearched && !loading && (
        <section className="bg-white px-6 py-16 dark:bg-gray-900">
          <div className="mx-auto max-w-4xl">
            {results.length === 0 ? (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-800">
                <svg
                  className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                  />
                </svg>
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  No leads found matching your criteria. Try broadening your
                  search filters.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden overflow-hidden rounded-2xl border border-gray-200 md:block dark:border-gray-700">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                        <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                          Name
                        </th>
                        <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                          Title
                        </th>
                        <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                          Company
                        </th>
                        <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                          Size
                        </th>
                        <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                          Email
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {results.map((lead) => (
                        <tr
                          key={lead.id}
                          className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                            {lead.name}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {lead.title}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            <div>
                              {lead.company}
                              <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                                {lead.country}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {lead.companySize}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-sm text-gray-900 dark:text-gray-200">
                              {lead.email}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="space-y-3 md:hidden">
                  {results.map((lead) => (
                    <div
                      key={lead.id}
                      className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
                    >
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {lead.name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {lead.title}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <span>{lead.company}</span>
                        <span>{lead.industry}</span>
                        <span>{lead.companySize} employees</span>
                        <span>{lead.country}</span>
                      </div>
                      <p className="mt-2 font-mono text-sm text-gray-900 dark:text-gray-200">
                        {lead.email}
                      </p>
                    </div>
                  ))}
                </div>

                {/* CTA to use leads */}
                <div className="mt-8 rounded-2xl border border-violet-200 bg-violet-50 p-6 text-center dark:border-violet-800 dark:bg-violet-900/20">
                  <h3 className="font-semibold text-violet-900 dark:text-violet-200">
                    Ready to reach these leads?
                  </h3>
                  <p className="mt-2 text-sm text-violet-700 dark:text-violet-300">
                    Use Mailmark to send personalized cold email campaigns
                    with automated domain setup, inbox warming, and
                    deliverability monitoring. All powered by AWS SES.
                  </p>
                  <Link
                    href="/dashboard"
                    className="mt-4 inline-flex rounded-full bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-violet-700 hover:shadow-md"
                  >
                    Go to Dashboard
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* CTA Banner */}
      <section className="bg-gradient-to-r from-violet-600 to-purple-700 px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-white">
            You found your leads. Now reach their inbox.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-violet-100">
            Mailmark gives you everything to go from lead list to landing in
            the inbox: domain setup, inbox warming, campaign sending, and
            deliverability monitoring. All powered by AWS SES.
          </p>
          <Link
            href="https://mailmark.dev"
            className="mt-6 inline-flex rounded-full bg-white px-8 py-3.5 text-base font-semibold text-violet-700 shadow-lg transition-all hover:bg-violet-50 hover:shadow-xl"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white px-6 py-16 dark:bg-gray-900">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Frequently Asked Questions
          </h2>
          <div className="mt-8 space-y-6">
            {faqItems.map((item) => (
              <div key={item.q}>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {item.q}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export default function LeadFinder() {
  return (
    <>
      <Authenticated>
        <LeadFinderInner isAuthenticated={true} />
      </Authenticated>
      <Unauthenticated>
        <LeadFinderInner isAuthenticated={false} />
      </Unauthenticated>
    </>
  );
}
