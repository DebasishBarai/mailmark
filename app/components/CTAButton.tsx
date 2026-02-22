"use client";

import Link from "next/link";
import { SignUpButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated } from "convex/react";

export default function CTAButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const defaultClass =
    "inline-flex items-center justify-center rounded-full bg-violet-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-violet-200 transition-all hover:bg-violet-700 hover:shadow-xl";

  return (
    <>
      <Unauthenticated>
        <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
          <button className={className ?? defaultClass}>
            {children ?? "Get Started Free"}
          </button>
        </SignUpButton>
      </Unauthenticated>
      <Authenticated>
        <Link href="/dashboard" className={className ?? defaultClass}>
          Go to Dashboard
        </Link>
      </Authenticated>
    </>
  );
}
