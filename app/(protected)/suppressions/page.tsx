"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { describeReason } from "../../../convex/lib/sendPolicy";

/**
 * Suppressions and refused sends.
 *
 * Both lists existed in the backend from the start and neither had a page, so
 * the only way to answer "why did this address not get my email" was the
 * Convex dashboard. Suppressions are the standing blocks; send blocks are the
 * log of every individual refusal the gate made, which is what tells you
 * whether the standing block is the reason.
 *
 * Verification verdicts are deliberately not shown here. The bulk backfill
 * writes no suppression rows (a bulk file spans every account's recipients, so
 * there is no account to attribute a verdict to), so an address refused for
 * being invalid appears under Refused sends and not under Suppressions.
 */

// The suppressions table has its own vocabulary, separate from the gate's
// BLOCK_REASONS, because it records how we learned an address was bad rather
// than which check refused it.
const SUPPRESSION_LABEL: Record<string, string> = {
  hard_bounce: "Hard bounce",
  complaint: "Spam complaint",
  manual: "Added manually",
  invalid: "Invalid address",
  disposable: "Disposable address",
};

const REASON_STYLE: Record<string, string> = {
  hard_bounce: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  complaint: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  manual: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  invalid: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  disposable: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
};

const PAGE_SIZE = 50;

export default function SuppressionsPage() {
  const [tab, setTab] = useState<"suppressed" | "blocked">("suppressed");

  // Both queries are paginated with a hand-rolled paginationOpts rather than
  // Convex's own validator, so usePaginatedQuery cannot be pointed at them: it
  // sends fields the validator would reject. Growing numItems and re-reading
  // is fine at the sizes these lists reach.
  const [supLimit, setSupLimit] = useState(PAGE_SIZE);
  const [blockLimit, setBlockLimit] = useState(PAGE_SIZE);

  const suppressions = useQuery(api.suppressions.listForCurrentUser, {
    paginationOpts: { numItems: supLimit, cursor: null },
  });
  const blocks = useQuery(api.sendGate.listBlocksForCurrentUser, {
    paginationOpts: { numItems: blockLimit, cursor: null },
  });

  const release = useMutation(api.suppressions.release);
  const addManual = useMutation(api.suppressions.addManual);

  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const supRows = suppressions?.page ?? [];
  const blockRows = blocks?.page ?? [];

  const needle = search.trim().toLowerCase();
  const filteredSup = needle
    ? supRows.filter((r) => r.email.includes(needle) || r.reason.includes(needle))
    : supRows;
  const filteredBlocks = needle
    ? blockRows.filter((r) => r.email.includes(needle) || r.reason.includes(needle))
    : blockRows;

  // A released row is kept rather than deleted, so it is still in the list and
  // is no longer blocking anything. Counting it as active would overstate how
  // much of the audience is unreachable.
  const active = supRows.filter((r) => !r.releasedAt).length;
  const released = supRows.length - active;

  const handleAdd = async () => {
    const email = addEmail.trim();
    if (!email) return;
    setAdding(true);
    setActionError(null);
    try {
      await addManual({ email });
      setAddEmail("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  };

  const handleRelease = async (email: string) => {
    if (!confirm(`Release ${email}? Sending to this address will be allowed again.`)) return;
    setActionError(null);
    try {
      await release({ email });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to release");
    }
  };

  return (
    <div className="min-h-full bg-gray-50 p-6 dark:bg-gray-900 md:p-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Suppressions &amp; Blocks</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Addresses that are blocked from receiving your mail, and every send the gate refused.
          </p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 text-center dark:border-gray-700 dark:bg-gray-800">
            <p className="text-3xl font-extrabold text-red-600">{active}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Suppressed</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 text-center dark:border-gray-700 dark:bg-gray-800">
            <p className="text-3xl font-extrabold text-emerald-600">{released}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Released</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 text-center dark:border-gray-700 dark:bg-gray-800">
            <p className="text-3xl font-extrabold text-amber-600">{blockRows.length}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Refused sends</p>
          </div>
        </div>

        {/* Add manual suppression */}
        <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Suppress an Address</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            For an opt-out that reached you off-channel. Unsubscribes from your emails are handled on the Unsubscribes page.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="min-w-[220px] flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="user@example.com"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!addEmail.trim() || adding}
              className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
            >
              {adding ? "Adding..." : "Suppress"}
            </button>
          </div>
          {actionError && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{actionError}</p>
          )}
        </div>

        {/* Tabs */}
        <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4 dark:border-gray-700">
            <div className="flex gap-1">
              {([
                ["suppressed", `Suppressed (${filteredSup.length})`],
                ["blocked", `Refused sends (${filteredBlocks.length})`],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    tab === key
                      ? "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                      : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-violet-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          {tab === "suppressed" ? (
            suppressions === undefined ? (
              <p className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading...</p>
            ) : filteredSup.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                {needle ? "No matching addresses." : "Nothing suppressed. Hard bounces and spam complaints will appear here."}
              </p>
            ) : (
              <>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredSup.map((row) => (
                    <div key={row._id} className="flex items-start justify-between gap-4 px-6 py-4">
                      <div className="min-w-0 flex-1">
                        <p className={`truncate font-medium ${row.releasedAt ? "text-gray-400 line-through dark:text-gray-500" : "text-gray-900 dark:text-white"}`}>
                          {row.email}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium ${REASON_STYLE[row.reason] ?? REASON_STYLE.manual}`}>
                            {SUPPRESSION_LABEL[row.reason] ?? row.reason}
                          </span>
                          <span>{new Date(row.createdAt).toLocaleDateString()}</span>
                          {row.releasedAt && <span className="text-emerald-600 dark:text-emerald-400">Released</span>}
                        </div>
                        {/* The receiving server's own words. "550 5.1.1 user unknown"
                            and "550 5.7.1 blocked" are opposite problems and only this
                            string separates them. */}
                        {row.diagnosticCode && (
                          <p className="mt-1 break-all font-mono text-[11px] text-gray-400 dark:text-gray-500">
                            {row.diagnosticCode}
                          </p>
                        )}
                      </div>
                      {!row.releasedAt && (
                        <button
                          onClick={() => handleRelease(row.email)}
                          className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                          title="Allow sending to this address again"
                        >
                          Release
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {!suppressions.isDone && (
                  <div className="border-t border-gray-100 px-6 py-4 text-center dark:border-gray-700">
                    <button
                      onClick={() => setSupLimit((n) => n + PAGE_SIZE)}
                      className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Load more
                    </button>
                  </div>
                )}
              </>
            )
          ) : blocks === undefined ? (
            <p className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading...</p>
          ) : filteredBlocks.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              {needle ? "No matching refusals." : "No sends have been refused."}
            </p>
          ) : (
            <>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredBlocks.map((row) => (
                  <div key={row._id} className="px-6 py-4">
                    <p className="truncate font-medium text-gray-900 dark:text-white">{row.email}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        {describeReason(row.reason)}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {row.path}
                      </span>
                      <span>{new Date(row.blockedAt).toLocaleString()}</span>
                    </div>
                    {row.detail && (
                      <p className="mt-1 break-all font-mono text-[11px] text-gray-400 dark:text-gray-500">
                        {row.detail}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {!blocks.isDone && (
                <div className="border-t border-gray-100 px-6 py-4 text-center dark:border-gray-700">
                  <button
                    onClick={() => setBlockLimit((n) => n + PAGE_SIZE)}
                    className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
