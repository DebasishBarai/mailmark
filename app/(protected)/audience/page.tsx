"use client";

import { useCallback, useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import LoadMoreSentinel from "../../components/LoadMoreSentinel";

/**
 * Contacts.
 *
 * Two lists that are easy to confuse, so they are labelled by what they mean to
 * the user rather than by their table names:
 *
 * - "Contacts" is the recipients table: every distinct address this user has
 *   mailed. It is the audience, it is what the plan caps, and it is the number
 *   billing shows.
 * - "Address book" is the contacts table: people who have written *in* with a
 *   display name, plus anything added through POST /v1/contacts. It carries
 *   names, which the audience does not, and it has no cap.
 *
 * Keeping both visible is the point. An account can sit at 26,454 contacts and
 * 18 address book entries, and until you see the two side by side that gap
 * looks like a bug rather than the two different things it is.
 */

const PAGE_SIZE = 50;

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ContactsPage() {
  const [tab, setTab] = useState<"audience" | "book">("audience");
  const [search, setSearch] = useState("");

  // usePaginatedQuery holds every page it has fetched and appends the next one
  // by cursor, so rows already on screen stay put while the next fifty arrive.
  // That is what the scroll needs: re-reading a wider page each time, as this
  // did before, blanked the list mid-scroll and re-read every earlier row.
  const {
    results: audienceRows,
    status: audienceStatus,
    loadMore: loadMoreAudience,
  } = usePaginatedQuery(api.recipients.listForCurrentUser, {}, { initialNumItems: PAGE_SIZE });
  const {
    results: bookRows,
    status: bookStatus,
    loadMore: loadMoreBook,
  } = usePaginatedQuery(api.contacts.listPageForCurrentUser, {}, { initialNumItems: PAGE_SIZE });
  const usage = useQuery(api.quotas.getUsageAndLimits);

  const onLoadMoreAudience = useCallback(
    () => loadMoreAudience(PAGE_SIZE),
    [loadMoreAudience]
  );
  const onLoadMoreBook = useCallback(() => loadMoreBook(PAGE_SIZE), [loadMoreBook]);

  const needle = search.trim().toLowerCase();
  const filteredAudience = needle
    ? audienceRows.filter((r) => r.email.includes(needle))
    : audienceRows;
  const filteredBook = needle
    ? bookRows.filter(
        (r) => r.email.includes(needle) || r.name.toLowerCase().includes(needle)
      )
    : bookRows;

  // The totals come from the denormalised counts, not from the loaded pages: a
  // page holds 50 rows and the real number is in the tens of thousands.
  const contactCount = usage?.usage.recipients ?? 0;
  const bookCount = usage?.usage.contacts ?? 0;
  const limit = usage?.limits.recipients ?? null;
  const pct = limit ? Math.min(100, Math.round((contactCount / limit) * 100)) : 0;
  const overLimit = limit !== null && contactCount > limit;

  return (
    <div className="min-h-full bg-gray-50 p-6 dark:bg-gray-900 md:p-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Contacts</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Everyone you have emailed, and everyone who has written to you.
          </p>
        </div>

        {/* Usage against the plan */}
        <div className="mb-8 rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Contacts used
              </p>
              <p className="mt-1 text-3xl font-extrabold text-gray-900 dark:text-white">
                {contactCount.toLocaleString()}
                {limit !== null && (
                  <span className="text-lg font-semibold text-gray-400 dark:text-gray-500">
                    {" "}
                    / {limit.toLocaleString()}
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {bookCount.toLocaleString()} in address book
              </p>
              {usage?.plan && (
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-violet-600 dark:text-violet-400">
                  {usage.plan} plan
                </p>
              )}
            </div>
          </div>
          {limit !== null && (
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
              <div
                className={`h-full rounded-full transition-all ${
                  overLimit ? "bg-amber-500" : "bg-violet-600"
                }`}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
          )}
          {overLimit && (
            <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
              You are above the contact allowance for your plan. Nothing is blocked,
              and no contact has been removed.
            </p>
          )}
        </div>

        {/* Lists */}
        <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4 dark:border-gray-700">
            <div className="flex gap-1">
              {([
                ["audience", `Contacts (${contactCount.toLocaleString()})`],
                ["book", `Address book (${bookCount.toLocaleString()})`],
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
              placeholder="Search loaded rows..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-violet-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          {tab === "audience" ? (
            audienceStatus === "LoadingFirstPage" ? (
              <p className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                Loading...
              </p>
            ) : filteredAudience.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                {needle
                  ? "No matching addresses in the rows loaded so far."
                  : "No contacts yet. Everyone you send to will appear here."}
              </p>
            ) : (
              <>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredAudience.map((row) => (
                    <div
                      key={row._id}
                      className="flex items-center justify-between gap-4 px-6 py-3"
                    >
                      <p className="min-w-0 flex-1 truncate font-medium text-gray-900 dark:text-white">
                        {row.email}
                      </p>
                      <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                        First emailed {formatDate(row.firstSeenAt)}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Replaced by the sentinel below: the next page now loads when
                    the bottom of the list comes into view.
                {!audience.isDone && (
                  <div className="border-t border-gray-100 px-6 py-4 text-center dark:border-gray-700">
                    <button
                      onClick={() => setAudienceLimit((n) => n + PAGE_SIZE)}
                      className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      Load more
                    </button>
                  </div>
                )}
                */}
                <LoadMoreSentinel
                  onLoadMore={onLoadMoreAudience}
                  status={audienceStatus}
                />
              </>
            )
          ) : bookStatus === "LoadingFirstPage" ? (
            <p className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              Loading...
            </p>
          ) : filteredBook.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              {needle
                ? "No matching entries in the rows loaded so far."
                : "Nothing here yet. People who reply to you with a display name are added automatically."}
            </p>
          ) : (
            <>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredBook.map((row) => (
                  <div
                    key={row._id}
                    className="flex items-center justify-between gap-4 px-6 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-900 dark:text-white">
                        {row.name}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {row.email}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                      {formatDate(row._creationTime)}
                    </span>
                  </div>
                ))}
              </div>
              {/* Replaced by the sentinel below, same as the contacts tab.
              {!book.isDone && (
                <div className="border-t border-gray-100 px-6 py-4 text-center dark:border-gray-700">
                  <button
                    onClick={() => setBookLimit((n) => n + PAGE_SIZE)}
                    className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                  >
                    Load more
                  </button>
                </div>
              )}
              */}
              <LoadMoreSentinel
                onLoadMore={onLoadMoreBook}
                status={bookStatus}
              />
            </>
          )}
        </div>

        <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
          Contacts counts every distinct address you have sent to, including CSV
          merges and sequence enrollments. The address book holds the people who
          have written to you, with their names.
        </p>
      </div>
    </div>
  );
}
