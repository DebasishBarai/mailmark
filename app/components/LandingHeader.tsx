"use client";

import { useState } from "react";
import Link from "next/link";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Logo from "./Logo";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Developers", href: "#developers" },
  { label: "Pricing", href: "#pricing" },
  { label: "Docs", href: "/docs" },
];

export default function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b-2 border-black bg-champagne">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={36} />
          <span className="text-2xl font-extrabold tracking-tight text-black">
            Mailmark
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-black underline-offset-4 hover:underline"
            >
              {link.label}
            </a>
          ))}

          <AuthLoading>
            <div className="h-10 w-24 animate-pulse rounded-md border-2 border-black bg-white/60" />
          </AuthLoading>

          <Unauthenticated>
            <SignInButton mode="modal" forceRedirectUrl="/dashboard">
              <button className="rounded-md border-2 border-black bg-white px-5 py-2 text-sm font-bold text-black shadow-[3px_3px_0px_#000] transition-all hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_#000]">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
              <button className="rounded-md border-2 border-black bg-coral px-5 py-2 text-sm font-bold text-black shadow-[3px_3px_0px_#000] transition-all hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_#000]">
                Start Free Trial
              </button>
            </SignUpButton>
          </Unauthenticated>

          <Authenticated>
            <Link
              href="/dashboard"
              className="rounded-md border-2 border-black bg-coral px-5 py-2 text-sm font-bold text-black shadow-[3px_3px_0px_#000] transition-all hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_#000]"
            >
              Dashboard
            </Link>
            <UserButton />
          </Authenticated>
        </nav>

        {/* Mobile right side */}
        <div className="flex items-center gap-3 md:hidden">
          <button
            className="flex flex-col gap-1.5"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <span
              className={`h-0.5 w-6 bg-black transition-transform ${mobileOpen ? "translate-y-2 rotate-45" : ""}`}
            />
            <span
              className={`h-0.5 w-6 bg-black transition-opacity ${mobileOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`h-0.5 w-6 bg-black transition-transform ${mobileOpen ? "-translate-y-2 -rotate-45" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="border-t-2 border-black bg-champagne px-6 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-semibold text-black"
              >
                {link.label}
              </a>
            ))}

            <Unauthenticated>
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="rounded-md border-2 border-black bg-white px-5 py-2.5 text-center text-sm font-bold text-black shadow-[3px_3px_0px_#000]">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="rounded-md border-2 border-black bg-coral px-5 py-2.5 text-center text-sm font-bold text-black shadow-[3px_3px_0px_#000]">
                  Start Free Trial
                </button>
              </SignUpButton>
            </Unauthenticated>

            <Authenticated>
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="rounded-md border-2 border-black bg-coral px-5 py-2.5 text-center text-sm font-bold text-black shadow-[3px_3px_0px_#000]"
              >
                Dashboard
              </Link>
              <div className="flex justify-center">
                <UserButton />
              </div>
            </Authenticated>
          </div>
        </nav>
      )}
    </header>
  );
}
