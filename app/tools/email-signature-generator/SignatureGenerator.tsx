"use client";

import { useState, useRef } from "react";
import Link from "next/link";

const COLORS = [
  { name: "Violet", value: "#7c3aed" },
  { name: "Blue", value: "#2563eb" },
  { name: "Green", value: "#16a34a" },
  { name: "Red", value: "#dc2626" },
  { name: "Orange", value: "#ea580c" },
  { name: "Gray", value: "#4b5563" },
  { name: "Teal", value: "#0d9488" },
  { name: "Pink", value: "#db2777" },
];

const STYLES = ["Professional", "Modern", "Minimal"] as const;
type StyleName = (typeof STYLES)[number];

interface FormData {
  name: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  website: string;
  linkedin: string;
  twitter: string;
  imageUrl: string;
}

function generateProfessionalHTML(data: FormData, color: string): string {
  const hasImage = data.imageUrl.trim().length > 0;
  const hasContact = data.phone || data.email || data.website;
  const hasSocial = data.linkedin || data.twitter;

  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333333;line-height:1.4;">
  <tr>
    ${hasImage ? `<td style="vertical-align:top;padding-right:16px;">
      <img src="${data.imageUrl}" alt="${data.name}" width="80" height="80" style="border-radius:50%;object-fit:cover;display:block;" />
    </td>` : ""}
    <td style="vertical-align:top;${hasImage ? `border-left:3px solid ${color};padding-left:16px;` : ""}">
      <strong style="font-size:16px;color:${color};">${data.name}</strong>
      ${data.title || data.company ? `<br/><span style="font-size:13px;color:#666666;">${[data.title, data.company].filter(Boolean).join(" | ")}</span>` : ""}
      ${hasContact ? `<br/><span style="font-size:12px;color:#666666;">${[
        data.phone ? `Phone: ${data.phone}` : "",
        data.email ? `Email: <a href="mailto:${data.email}" style="color:${color};text-decoration:none;">${data.email}</a>` : "",
        data.website ? `Web: <a href="${data.website.startsWith("http") ? data.website : `https://${data.website}`}" style="color:${color};text-decoration:none;">${data.website.replace(/^https?:\/\//, "")}</a>` : "",
      ].filter(Boolean).join(" | ")}</span>` : ""}
      ${hasSocial ? `<br/><span style="font-size:12px;">${[
        data.linkedin ? `<a href="${data.linkedin}" style="color:${color};text-decoration:none;">LinkedIn</a>` : "",
        data.twitter ? `<a href="${data.twitter}" style="color:${color};text-decoration:none;">Twitter</a>` : "",
      ].filter(Boolean).join(" | ")}</span>` : ""}
    </td>
  </tr>
</table>`;
}

function generateModernHTML(data: FormData, color: string): string {
  const hasImage = data.imageUrl.trim().length > 0;
  const hasContact = data.phone || data.email || data.website;
  const hasSocial = data.linkedin || data.twitter;

  return `<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#333333;line-height:1.5;">
  ${hasImage ? `<tr>
    <td style="padding-bottom:12px;">
      <img src="${data.imageUrl}" alt="${data.name}" width="70" height="70" style="border-radius:8px;object-fit:cover;display:block;" />
    </td>
  </tr>` : ""}
  <tr>
    <td style="border-top:3px solid ${color};padding-top:12px;">
      <strong style="font-size:17px;color:${color};display:block;">${data.name}</strong>
      ${data.title ? `<span style="font-size:13px;color:#444444;display:block;">${data.title}</span>` : ""}
      ${data.company ? `<span style="font-size:13px;color:#888888;display:block;">${data.company}</span>` : ""}
      ${hasContact ? `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;font-size:12px;color:#666666;">
        ${data.phone ? `<tr><td style="padding:1px 0;">Phone: ${data.phone}</td></tr>` : ""}
        ${data.email ? `<tr><td style="padding:1px 0;">Email: <a href="mailto:${data.email}" style="color:${color};text-decoration:none;">${data.email}</a></td></tr>` : ""}
        ${data.website ? `<tr><td style="padding:1px 0;">Web: <a href="${data.website.startsWith("http") ? data.website : `https://${data.website}`}" style="color:${color};text-decoration:none;">${data.website.replace(/^https?:\/\//, "")}</a></td></tr>` : ""}
      </table>` : ""}
      ${hasSocial ? `<div style="margin-top:8px;font-size:12px;">${[
        data.linkedin ? `<a href="${data.linkedin}" style="color:${color};text-decoration:none;margin-right:12px;">LinkedIn</a>` : "",
        data.twitter ? `<a href="${data.twitter}" style="color:${color};text-decoration:none;">Twitter</a>` : "",
      ].filter(Boolean).join("")}</div>` : ""}
    </td>
  </tr>
</table>`;
}

function generateMinimalHTML(data: FormData, color: string): string {
  const parts: string[] = [];
  if (data.title) parts.push(data.title);
  if (data.company) parts.push(data.company);

  const contactParts: string[] = [];
  if (data.phone) contactParts.push(data.phone);
  if (data.email) contactParts.push(`<a href="mailto:${data.email}" style="color:${color};text-decoration:none;">${data.email}</a>`);
  if (data.website) contactParts.push(`<a href="${data.website.startsWith("http") ? data.website : `https://${data.website}`}" style="color:${color};text-decoration:none;">${data.website.replace(/^https?:\/\//, "")}</a>`);

  const socialParts: string[] = [];
  if (data.linkedin) socialParts.push(`<a href="${data.linkedin}" style="color:${color};text-decoration:none;">LinkedIn</a>`);
  if (data.twitter) socialParts.push(`<a href="${data.twitter}" style="color:${color};text-decoration:none;">Twitter</a>`);

  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;line-height:1.6;">
  <strong style="color:${color};">${data.name}</strong>${parts.length > 0 ? ` | ${parts.join(" | ")}` : ""}
  ${contactParts.length > 0 ? `<br/>${contactParts.join(" | ")}` : ""}
  ${socialParts.length > 0 ? `<br/>${socialParts.join(" | ")}` : ""}
</div>`;
}

function generateHTML(data: FormData, style: StyleName, color: string): string {
  switch (style) {
    case "Professional":
      return generateProfessionalHTML(data, color);
    case "Modern":
      return generateModernHTML(data, color);
    case "Minimal":
      return generateMinimalHTML(data, color);
  }
}

function generatePlainText(data: FormData): string {
  const lines: string[] = [data.name];
  if (data.title || data.company) lines.push([data.title, data.company].filter(Boolean).join(" | "));
  if (data.phone) lines.push(`Phone: ${data.phone}`);
  if (data.email) lines.push(`Email: ${data.email}`);
  if (data.website) lines.push(`Web: ${data.website.replace(/^https?:\/\//, "")}`);
  if (data.linkedin) lines.push(`LinkedIn: ${data.linkedin}`);
  if (data.twitter) lines.push(`Twitter: ${data.twitter}`);
  return lines.join("\n");
}

const faqItems = [
  {
    q: "Will this signature work in all email clients?",
    a: "Yes. The generated HTML uses inline styles and table-based layout, which is compatible with all major email clients including Gmail, Outlook, Apple Mail, Yahoo Mail, and Thunderbird. We avoid CSS that is not universally supported.",
  },
  {
    q: "How do I add this signature to my email client?",
    a: "Copy the HTML using the 'Copy HTML' button. In Gmail: Settings > See all settings > General > Signature > paste. In Outlook: File > Options > Mail > Signatures > paste. In Apple Mail: Preferences > Signatures > paste. Some clients may require you to paste as rich text rather than plain text.",
  },
  {
    q: "Can I use my own headshot image?",
    a: "Yes. Paste a URL to your headshot image in the 'Image URL' field. The image should be hosted somewhere publicly accessible (e.g. your website, LinkedIn profile photo URL, or an image hosting service). We recommend a square image of at least 160x160 pixels.",
  },
  {
    q: "Why should I use an email signature?",
    a: "A professional email signature builds trust, reinforces your brand, and makes it easy for recipients to find your contact details. For cold outreach, a signature with your name, title, and company legitimizes your email and can improve reply rates.",
  },
  {
    q: "Is this generator free?",
    a: "Completely free with no limits. Generate as many signatures as you need. No signup, no watermark, no restrictions.",
  },
];

export default function SignatureGenerator() {
  const [form, setForm] = useState<FormData>({
    name: "",
    title: "",
    company: "",
    phone: "",
    email: "",
    website: "",
    linkedin: "",
    twitter: "",
    imageUrl: "",
  });
  const [style, setStyle] = useState<StyleName>("Professional");
  const [color, setColor] = useState(COLORS[0].value);
  const [customColor, setCustomColor] = useState("");
  const [copied, setCopied] = useState<"html" | "text" | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const activeColor = customColor.match(/^#[0-9a-fA-F]{6}$/) ? customColor : color;

  function updateField(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const html = form.name.trim() ? generateHTML(form, style, activeColor) : "";

  async function copyHTML() {
    if (!html) return;
    try {
      await navigator.clipboard.writeText(html);
      setCopied("html");
      setTimeout(() => setCopied(null), 2000);
    } catch { /* noop */ }
  }

  async function copyPlainText() {
    if (!form.name.trim()) return;
    try {
      await navigator.clipboard.writeText(generatePlainText(form));
      setCopied("text");
      setTimeout(() => setCopied(null), 2000);
    } catch { /* noop */ }
  }

  const inputClasses = "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-all placeholder:text-gray-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-600 dark:focus:ring-violet-900/30";

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-violet-50 to-white px-6 py-20 dark:from-violet-950/30 dark:to-gray-900">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400">
            <Link href="/tools" className="hover:underline">
              Tools
            </Link>
            <span>/</span>
            <span className="text-gray-500 dark:text-gray-400">Email Signature Generator</span>
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            Free Email Signature Generator - Create Professional Signatures
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            Build a professional HTML email signature in seconds. Pick a style,
            customize the colors, and copy the HTML into any email client.
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Free, no signup required. No watermark.
          </p>
        </div>
      </section>

      {/* Form + Preview */}
      <section className="bg-white px-6 py-16 dark:bg-gray-900">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-10 lg:grid-cols-2">
            {/* Form */}
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Details</h2>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name *</label>
                <input type="text" value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="John Smith" className={inputClasses} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Job Title</label>
                  <input type="text" value={form.title} onChange={(e) => updateField("title", e.target.value)} placeholder="Marketing Director" className={inputClasses} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Company</label>
                  <input type="text" value={form.company} onChange={(e) => updateField("company", e.target.value)} placeholder="Acme Inc." className={inputClasses} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
                  <input type="text" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="+1 (555) 123-4567" className={inputClasses} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                  <input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="john@acme.com" className={inputClasses} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Website</label>
                <input type="text" value={form.website} onChange={(e) => updateField("website", e.target.value)} placeholder="https://acme.com" className={inputClasses} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">LinkedIn URL</label>
                  <input type="text" value={form.linkedin} onChange={(e) => updateField("linkedin", e.target.value)} placeholder="https://linkedin.com/in/johnsmith" className={inputClasses} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Twitter/X URL</label>
                  <input type="text" value={form.twitter} onChange={(e) => updateField("twitter", e.target.value)} placeholder="https://x.com/johnsmith" className={inputClasses} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Image URL</label>
                <input type="text" value={form.imageUrl} onChange={(e) => updateField("imageUrl", e.target.value)} placeholder="https://example.com/photo.jpg" className={inputClasses} />
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Paste a URL to your headshot. Used in Professional and Modern styles.</p>
              </div>

              {/* Style picker */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Style</label>
                <div className="flex gap-2">
                  {STYLES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStyle(s)}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                        style === s
                          ? "bg-violet-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Accent Color</label>
                <div className="flex flex-wrap items-center gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c.value}
                      title={c.name}
                      onClick={() => { setColor(c.value); setCustomColor(""); }}
                      className={`h-8 w-8 rounded-full border-2 transition-all ${
                        color === c.value && !customColor ? "border-gray-900 scale-110 dark:border-white" : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                  <input
                    type="text"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    placeholder="#custom"
                    className="w-24 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-violet-400 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Preview + Copy */}
            <div className="lg:sticky lg:top-8 lg:self-start">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Live Preview</h2>
              <div
                ref={previewRef}
                className="mt-4 min-h-[120px] rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
              >
                {form.name.trim() ? (
                  <div dangerouslySetInnerHTML={{ __html: html }} />
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Enter your name to see a preview.
                  </p>
                )}
              </div>

              {form.name.trim() && (
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={copyHTML}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-violet-700 hover:shadow-md"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                    </svg>
                    {copied === "html" ? "Copied!" : "Copy HTML"}
                  </button>
                  <button
                    onClick={copyPlainText}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    {copied === "text" ? "Copied!" : "Copy Plain Text"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-gradient-to-r from-violet-600 to-purple-700 px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold text-white">
            Send Emails from Your Custom Domain with Mailmark
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-violet-100">
            Create mailboxes like hello@yourcompany.com, run email campaigns,
            and manage everything from a single dashboard. Built on AWS SES for
            best-in-class deliverability.
          </p>
          <Link
            href="https://www.mailmark.dev"
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
