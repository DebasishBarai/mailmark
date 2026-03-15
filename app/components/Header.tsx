"use client";

import { useState } from "react";
import Link from "next/link";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Logo from "./Logo";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import ThemeToggle from "./ThemeToggle";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md dark:border-gray-700/50 dark:bg-gray-900/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={36} />
          <span className="text-2xl font-bold text-violet-600">Mailmark</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-violet-600 dark:text-gray-300 dark:hover:text-violet-400"
            >
              {link.label}
            </a>
          ))}

          <ThemeToggle />

          <AuthLoading>
            <div className="h-9 w-24 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
          </AuthLoading>

          <Unauthenticated>
            <SignInButton mode="modal" forceRedirectUrl="/dashboard">
              <button className="text-sm font-medium text-gray-600 transition-colors hover:text-violet-600 dark:text-gray-300 dark:hover:text-violet-400">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
              <button className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700">
                Start Free Trial
              </button>
            </SignUpButton>
          </Unauthenticated>

          <Authenticated>
            <Link
              href="/dashboard"
              className="rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
            >
              Dashboard
            </Link>
            <UserButton />
          </Authenticated>
        </nav>

        {/* Mobile right side */}
        <div className="flex items-center gap-3 md:hidden">
          <ThemeToggle />
          <button
            className="flex flex-col gap-1.5"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <span
              className={`h-0.5 w-6 bg-gray-800 transition-transform dark:bg-gray-200 ${mobileOpen ? "translate-y-2 rotate-45" : ""}`}
            />
            <span
              className={`h-0.5 w-6 bg-gray-800 transition-opacity dark:bg-gray-200 ${mobileOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`h-0.5 w-6 bg-gray-800 transition-transform dark:bg-gray-200 ${mobileOpen ? "-translate-y-2 -rotate-45" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="border-t border-gray-100 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900 md:hidden">
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-medium text-gray-600 transition-colors hover:text-violet-600 dark:text-gray-300 dark:hover:text-violet-400"
              >
                {link.label}
              </a>
            ))}

            <Unauthenticated>
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="text-sm font-medium text-gray-600 transition-colors hover:text-violet-600 dark:text-gray-300 dark:hover:text-violet-400">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
                <button className="rounded-full bg-violet-600 px-5 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-violet-700">
                  Start Free Trial
                </button>
              </SignUpButton>
            </Unauthenticated>

            <Authenticated>
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="rounded-full bg-violet-600 px-5 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-violet-700"
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
