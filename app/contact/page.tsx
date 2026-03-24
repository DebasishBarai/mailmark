"use client";

import { useState } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";

const contactOptions = [
  {
    title: "Help Center",
    description: "Browse our documentation for self-serve answers.",
    href: "/docs",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    title: "Email us",
    description: "Send a message to support@mailmark.dev",
    href: "mailto:support@mailmark.dev",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    title: "Twitter / X",
    description: "Reach us @MailmarkApp for quick questions.",
    href: "#",
    icon: (
      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
      </svg>
    ),
  },
];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <main className="bg-white dark:bg-gray-900">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-20 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-violet-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            Contact
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            We&apos;re here to help
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            Typical response time is under 2 hours on business days. We read
            every message.
          </p>
        </div>
      </section>

      <section className="bg-white px-6 py-16 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-16 lg:grid-cols-2">
            {/* Contact form */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Send a message</h2>
              {submitted ? (
                <div className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50 p-8 text-center dark:border-emerald-800 dark:bg-emerald-900/20">
                  <svg className="mx-auto h-12 w-12 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Message received!</h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    Thanks for reaching out, {form.name.split(" ")[0] || "there"}. We&apos;ll reply to{" "}
                    <strong>{form.email}</strong> shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                        Full name <span className="text-red-400">*</span>
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="Jane Smith"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-violet-500 dark:focus:ring-violet-900/30"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                        Email address <span className="text-red-400">*</span>
                      </label>
                      <input
                        required
                        type="email"
                        placeholder="jane@example.com"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-violet-500 dark:focus:ring-violet-900/30"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Subject <span className="text-red-400">*</span>
                    </label>
                    <select
                      required
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-violet-500 dark:focus:ring-violet-900/30"
                    >
                      <option value="">Select a topic…</option>
                      <option>Technical support</option>
                      <option>Billing question</option>
                      <option>Feature request</option>
                      <option>Partnership inquiry</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Message <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      required
                      rows={5}
                      placeholder="Tell us how we can help…"
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-violet-500 dark:focus:ring-violet-900/30"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-full bg-violet-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition-colors hover:bg-violet-700 dark:shadow-violet-900/30"
                  >
                    Send message
                  </button>
                </form>
              )}
            </div>

            {/* Contact options */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Other ways to reach us</h2>
              <div className="mt-8 space-y-4">
                {contactOptions.map((opt) => (
                  <a
                    key={opt.title}
                    href={opt.href}
                    className="flex items-start gap-4 rounded-2xl border border-gray-100 p-5 transition-all hover:border-violet-200 hover:shadow-md dark:border-gray-700 dark:hover:border-violet-700"
                  >
                    <div className="shrink-0 rounded-xl bg-violet-100 p-2.5 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
                      {opt.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{opt.title}</p>
                      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{opt.description}</p>
                    </div>
                  </a>
                ))}
              </div>
              <div className="mt-8 rounded-2xl bg-violet-50 p-6 dark:bg-violet-900/20">
                <p className="text-sm font-semibold text-violet-800 dark:text-violet-300">Business hours</p>
                <p className="mt-1 text-sm text-violet-700 dark:text-violet-400">
                  Monday - Friday, 9 am - 6 pm UTC
                </p>
                <p className="mt-3 text-sm text-violet-700 dark:text-violet-400">
                  For urgent issues outside business hours, email{" "}
                  <a href="mailto:urgent@mailmark.dev" className="font-medium underline">
                    urgent@mailmark.dev
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
