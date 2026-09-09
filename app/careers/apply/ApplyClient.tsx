"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../../convex/_generated/api";
import { HEARD_ABOUT_OPTIONS } from "../../../convex/lib/jobApplication";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { openings, isKnownRole, OPEN_APPLICATION, JOBS_EMAIL } from "../openings";

const inputClass =
  "w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-violet-500 dark:focus:ring-violet-900/30";
const labelClass =
  "mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200";

export default function ApplyClient({ initialRole }: { initialRole: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    // A role from the URL is only kept when it is one we actually posted, so
    // a shared or edited link cannot seed the form with anything it likes.
    role: isKnownRole(initialRole) ? initialRole : "",
    name: "",
    email: "",
    location: "",
    profileUrl: "",
    resumeUrl: "",
    heardAbout: "",
    note: "",
  });
  // Honeypot. Hidden from people, filled in by bots that complete every input.
  const [website, setWebsite] = useState("");

  const submitApplication = useMutation(api.jobApplications.submit);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;

    setSending(true);
    setError(null);

    try {
      await submitApplication({
        name: form.name,
        email: form.email,
        role: form.role,
        location: form.location,
        profileUrl: form.profileUrl,
        resumeUrl: form.resumeUrl,
        heardAbout: form.heardAbout,
        note: form.note,
        website,
      });
      setSubmitted(true);
    } catch (err) {
      // Convex redacts a plain Error in production, so only a ConvexError
      // carries a message worth showing.
      setError(
        err instanceof ConvexError && typeof err.data === "string"
          ? err.data
          : `Something went wrong sending your application. Please email ${JOBS_EMAIL} instead.`
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="bg-white dark:bg-gray-900">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-20 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full bg-violet-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
            Careers
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Apply to Mailmark
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            Every application is read by a person. We reply to everyone, usually
            within a week.
          </p>
        </div>
      </section>

      <section className="bg-white px-6 py-16 dark:bg-gray-900">
        <div className="mx-auto max-w-2xl">
          {submitted ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-8 text-center dark:border-emerald-800 dark:bg-emerald-900/20">
              <svg className="mx-auto h-12 w-12 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
                Application received
              </h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Thanks, {form.name.split(" ")[0] || "there"}. We have your
                application for <strong>{form.role || OPEN_APPLICATION}</strong>{" "}
                and will reply to <strong>{form.email}</strong>.
              </p>
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                Anything to add? Email{" "}
                <a href={`mailto:${JOBS_EMAIL}`} className="text-violet-600 hover:underline dark:text-violet-400">
                  {JOBS_EMAIL}
                </a>
                .
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="apply-role" className={labelClass}>
                  Role <span className="text-red-400">*</span>
                </label>
                <select
                  id="apply-role"
                  required
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Select a role…</option>
                  {openings.map((job) => (
                    <option key={job.title}>{job.title}</option>
                  ))}
                  <option>{OPEN_APPLICATION}</option>
                </select>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="apply-name" className={labelClass}>
                    Full name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="apply-name"
                    required
                    type="text"
                    placeholder="Jane Smith"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="apply-email" className={labelClass}>
                    Email address <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="apply-email"
                    required
                    type="email"
                    placeholder="jane@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="apply-location" className={labelClass}>
                  Location and timezone <span className="text-red-400">*</span>
                </label>
                <input
                  id="apply-location"
                  required
                  type="text"
                  placeholder="Lisbon, Portugal (UTC+1)"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className={inputClass}
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Every role is remote, so this is only for overlap with the team.
                </p>
              </div>

              <div>
                <label htmlFor="apply-profile" className={labelClass}>
                  Portfolio, LinkedIn or GitHub <span className="text-red-400">*</span>
                </label>
                <input
                  id="apply-profile"
                  required
                  type="url"
                  inputMode="url"
                  placeholder="https://github.com/janesmith"
                  value={form.profileUrl}
                  onChange={(e) => setForm({ ...form, profileUrl: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="apply-resume" className={labelClass}>
                  Resume link
                </label>
                <input
                  id="apply-resume"
                  type="url"
                  inputMode="url"
                  placeholder="https://drive.google.com/…"
                  value={form.resumeUrl}
                  onChange={(e) => setForm({ ...form, resumeUrl: e.target.value })}
                  className={inputClass}
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Optional. A shared link to a PDF works well. If you would
                  rather send a file, email it to {JOBS_EMAIL} once you have
                  applied.
                </p>
              </div>

              <div>
                <label htmlFor="apply-heard" className={labelClass}>
                  How did you hear about Mailmark? <span className="text-red-400">*</span>
                </label>
                <select
                  id="apply-heard"
                  required
                  value={form.heardAbout}
                  onChange={(e) => setForm({ ...form, heardAbout: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Select an option…</option>
                  {HEARD_ABOUT_OPTIONS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="apply-note" className={labelClass}>
                  Why this role? <span className="text-red-400">*</span>
                </label>
                <textarea
                  id="apply-note"
                  required
                  rows={6}
                  placeholder="Tell us what you have built, and why this role is interesting to you."
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className={inputClass}
                />
              </div>

              {/* Honeypot: off-screen and out of the tab order, so nobody
                  using a keyboard or a screen reader ever lands on it. */}
              <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
                <label htmlFor="apply-website">Leave this field empty</label>
                <input
                  id="apply-website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              {error && (
                <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="submit"
                  disabled={sending}
                  className="rounded-full bg-violet-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-200 transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 dark:shadow-violet-900/30"
                >
                  {sending ? "Sending…" : "Send application"}
                </button>
                <a href="/careers" className="text-sm text-gray-500 hover:underline dark:text-gray-400">
                  Back to open roles
                </a>
              </div>
            </form>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
