import Link from "next/link";
import Logo from "./Logo";

const footerLinks = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Developers", href: "#developers" },
    { label: "Pricing", href: "#pricing" },
  ],
  Developers: [
    { label: "API Reference", href: "/docs/api" },
    { label: "Documentation", href: "/docs" },
    { label: "Getting Started", href: "/docs/getting-started" },
    { label: "DNS Setup Guide", href: "/guides/dns-setup" },
  ],
  Tools: [
    { label: "All Tools", href: "/tools" },
    { label: "Deliverability Checker", href: "/tools/email-deliverability-checker" },
    { label: "Email List Validator", href: "/tools/email-list-validator" },
    { label: "Lead Finder", href: "/tools/lead-finder" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/contact" },
    { label: "Affiliate Program", href: "/affiliate-program" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Security", href: "/security" },
    { label: "System Status", href: "/status" },
  ],
};

export default function LandingFooter() {
  return (
    <footer className="border-t-2 border-black bg-champagne px-6 py-16">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 md:grid-cols-6">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <Logo size={32} />
              <span className="text-2xl font-extrabold tracking-tight text-black">
                Mailmark
              </span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-black/70">
              One email platform for every product you ship. Domains, mailboxes,
              campaigns, and a send API in one place.
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-sm font-extrabold uppercase tracking-wider text-black">
                {category}
              </h4>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm font-medium text-black/70 underline-offset-4 transition-colors hover:text-black hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t-2 border-black pt-8 md:flex-row">
          <p className="text-sm font-medium text-black/70">
            &copy; {new Date().getFullYear()} Mailmark. All rights reserved.
          </p>
          <div className="flex gap-4">
            <Link
              href={`${process.env.NEXT_PUBLIC_X_URL}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-black bg-white text-black shadow-[2px_2px_0px_#000] transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#000]"
              aria-label="Twitter"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
              </svg>
            </Link>
            <Link
              href={`${process.env.NEXT_PUBLIC_LINKEDIN_URL}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-black bg-white text-black shadow-[2px_2px_0px_#000] transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_#000]"
              aria-label="LinkedIn"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
