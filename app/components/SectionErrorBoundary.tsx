"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Keeps one failing section of a page from taking the whole page down.
 *
 * Convex's useQuery rethrows a backend error during render (see the
 * `if (result instanceof Error) throw result` in convex/react). With no
 * boundary between that throw and the root of the app, Next.js replaces the
 * entire document with "Application error: a client-side exception has
 * occurred", which is how a single over-budget query on the dashboard turned
 * into a customer who could not open the page at all.
 *
 * A boundary has to be an ancestor of the component that calls useQuery, so
 * every section wrapped in one owns its own query rather than reading a value
 * lifted to the page. The success path renders children directly and adds no
 * DOM node of its own, so a wrapped section can still sit inside a grid.
 */

type Props = {
  children: ReactNode;
  /** Named in the fallback, so the reader knows which part of the page failed. */
  label: string;
  /** Applied to the fallback only. Lets a caller size it to the slot it fills. */
  fallbackClassName?: string;
};

type State = { error: Error | null };

export default class SectionErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The browser console is the only place this is visible in production, and
    // it is what support asks the customer for.
    console.error(`[${this.props.label}] section failed to render`, error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        className={`flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20 ${
          this.props.fallbackClassName ?? ""
        }`}
      >
        <svg
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-500"
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
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {this.props.label} could not be loaded.
          </p>
          <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
            The rest of this page is unaffected. Nothing has been lost and no
            mail has stopped sending.
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-2 text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
