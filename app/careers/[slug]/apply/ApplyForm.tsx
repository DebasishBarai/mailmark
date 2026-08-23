"use client";

import { useRef, useState } from "react";
import Link from "next/link";

const MAX_RESUME_BYTES = 5 * 1024 * 1024;

const ALLOWED_RESUME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

type Props = {
  jobSlug: string;
  jobTitle: string;
  isGeneral: boolean;
};

export default function ApplyForm({ jobSlug, jobTitle, isGeneral }: Props) {
  // Captured on first render so the server can reject submissions that were
  // filled in impossibly fast.
  const startedAt = useRef(Date.now());

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    location: "",
    portfolioUrl: "",
    githubUrl: "",
    linkedinUrl: "",
    coverLetter: "",
    company: "", // honeypot, hidden from real users
  });
  const [resume, setResume] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const update = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  function handleResumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setError(null);
    if (!file) {
      setResume(null);
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      setError("Your resume is larger than 5MB. Please upload a smaller file.");
      e.target.value = "";
      setResume(null);
      return;
    }
    if (!ALLOWED_RESUME_TYPES.includes(file.type)) {
      setError("Your resume must be a PDF, DOC or DOCX file.");
      e.target.value = "";
      setResume(null);
      return;
    }
    setResume(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!resume) {
      setError("Please attach your resume.");
      return;
    }
    if (!consent) {
      setError("Please confirm you're happy for us to store your application.");
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: get a one-shot upload URL, rate limited by IP server-side.
      const urlRes = await fetch("/api/careers/apply/upload-url", { method: "POST" });
      if (!urlRes.ok) {
        const body = await urlRes.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not start the upload. Please try again.");
      }
      const { uploadUrl } = await urlRes.json();

      // Step 2: upload the resume straight to Convex storage. Going direct
      // keeps the file off the serverless request body size limit.
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": resume.type },
        body: resume,
      });
      if (!uploadRes.ok) {
        throw new Error("Your resume failed to upload. Please try again.");
      }
      const { storageId } = await uploadRes.json();

      // Step 3: submit the application itself.
      const res = await fetch("/api/careers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobSlug,
          name: form.name,
          email: form.email,
          phone: form.phone,
          location: form.location,
          portfolioUrl: form.portfolioUrl,
          githubUrl: form.githubUrl,
          linkedinUrl: form.linkedinUrl,
          coverLetter: form.coverLetter,
          resumeStorageId: storageId,
          resumeFilename: resume.name,
          company: form.company,
          startedAt: startedAt.current,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Something went wrong. Please try again.");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-10 text-center dark:border-emerald-800 dark:bg-emerald-900/20">
        <svg
          className="mx-auto h-12 w-12 text-emerald-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
          Application received
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          Thanks for applying{isGeneral ? "" : ` for ${jobTitle}`}. We&apos;ve sent a confirmation to{" "}
          <span className="font-medium text-gray-900 dark:text-white">{form.email}</span>. If it
          doesn&apos;t arrive within a few minutes, check your spam folder.
        </p>
        <Link
          href="/careers"
          className="mt-6 inline-block rounded-full border border-violet-600 px-6 py-2.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50 dark:border-violet-500 dark:text-violet-400 dark:hover:bg-violet-900/20"
        >
          Back to open roles
        </Link>
      </div>
    );
  }

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-violet-500 focus:ring-2 focus:ring-violet-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:ring-violet-900/40";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-200";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Honeypot: positioned off-screen rather than display:none, which some
          bots detect and skip. Real users never focus it. */}
      <div className="absolute left-[-9999px] top-0" aria-hidden="true">
        <label htmlFor="company">Company</label>
        <input
          id="company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={form.company}
          onChange={update("company")}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={labelClass}>
            Full name <span className="text-violet-600">*</span>
          </label>
          <input id="name" type="text" required value={form.name} onChange={update("name")} className={inputClass} />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>
            Email <span className="text-violet-600">*</span>
          </label>
          <input id="email" type="email" required value={form.email} onChange={update("email")} className={inputClass} />
        </div>
        <div>
          <label htmlFor="phone" className={labelClass}>Phone</label>
          <input id="phone" type="tel" value={form.phone} onChange={update("phone")} className={inputClass} />
        </div>
        <div>
          <label htmlFor="location" className={labelClass}>Where you&apos;re based</label>
          <input
            id="location"
            type="text"
            placeholder="City, Country"
            value={form.location}
            onChange={update("location")}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <div>
          <label htmlFor="portfolioUrl" className={labelClass}>Portfolio / website</label>
          <input id="portfolioUrl" type="url" placeholder="https://" value={form.portfolioUrl} onChange={update("portfolioUrl")} className={inputClass} />
        </div>
        <div>
          <label htmlFor="githubUrl" className={labelClass}>GitHub</label>
          <input id="githubUrl" type="url" placeholder="https://" value={form.githubUrl} onChange={update("githubUrl")} className={inputClass} />
        </div>
        <div>
          <label htmlFor="linkedinUrl" className={labelClass}>LinkedIn</label>
          <input id="linkedinUrl" type="url" placeholder="https://" value={form.linkedinUrl} onChange={update("linkedinUrl")} className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="coverLetter" className={labelClass}>
          {isGeneral ? "What would you want to work on?" : "Why are you a good fit?"}{" "}
          <span className="text-violet-600">*</span>
        </label>
        <textarea
          id="coverLetter"
          required
          rows={8}
          maxLength={8000}
          value={form.coverLetter}
          onChange={update("coverLetter")}
          placeholder="Tell us about relevant work you've done. Links to things you've shipped are more useful than a list of technologies."
          className={`${inputClass} resize-y`}
        />
        <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
          {form.coverLetter.length.toLocaleString()} / 8,000 characters
        </p>
      </div>

      <div>
        <label htmlFor="resume" className={labelClass}>
          Resume <span className="text-violet-600">*</span>
        </label>
        <input
          id="resume"
          type="file"
          required
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleResumeChange}
          className="mt-1.5 w-full cursor-pointer rounded-xl border border-dashed border-gray-300 bg-white px-4 py-3 text-sm text-gray-600 file:mr-4 file:rounded-full file:border-0 file:bg-violet-50 file:px-4 file:py-1.5 file:text-sm file:font-semibold file:text-violet-700 hover:border-violet-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:file:bg-violet-900/40 dark:file:text-violet-300"
        />
        <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">PDF, DOC or DOCX, up to 5MB.</p>
      </div>

      <label className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-300">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 self-start rounded border-gray-300 text-violet-600 focus:ring-violet-500"
        />
        <span>
          I&apos;m happy for Mailmark to store this application and contact me about
          it. Our confirmation email includes open and click tracking. See our{" "}
          <Link href="/privacy" className="text-violet-600 hover:underline dark:text-violet-400">
            privacy policy
          </Link>
          .
        </span>
      </label>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-violet-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {submitting ? "Sending your application..." : "Submit application"}
      </button>
    </form>
  );
}
