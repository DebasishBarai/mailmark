"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Last resort for the authenticated app.
 *
 * Anything a section boundary does not catch lands here instead of in Next.js'
 * own "Application error: a client-side exception has occurred" screen, which
 * is a blank page with no way forward. This keeps the sidebar and gives the
 * customer somewhere to go, plus the digest support needs to find the failure
 * in the logs.
 */
export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[protected] page failed to render", error);
  }, [error]);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-lg rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
        <svg
          className="mx-auto h-10 w-10 text-amber-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <h1 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
          This page could not be loaded
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Your account, your mailboxes and your scheduled mail are all
          unaffected. This is a display problem on this page only.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-gray-400 dark:text-gray-500">
            Reference: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
          >
            Try again
          </button>
          <Link
            href="/mailbox"
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700/50"
          >
            Go to mailbox
          </Link>
          <a
            href="mailto:support@mailmark.dev"
            className="text-sm font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
          >
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}
