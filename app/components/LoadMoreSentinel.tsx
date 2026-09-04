"use client";

import { useEffect, useRef } from "react";

export type PaginationStatus =
  | "LoadingFirstPage"
  | "CanLoadMore"
  | "LoadingMore"
  | "Exhausted";

/**
 * Bottom-of-list sentinel, in place of a "Load more" button.
 *
 * The next page is requested as soon as the sentinel enters view, and the
 * rootMargin means that happens a little before the reader actually reaches the
 * bottom, so the rows are usually there by the time they get to them. The
 * observer only runs while the status is CanLoadMore, which keeps a single pass
 * through the sentinel from queueing two pages: once a page is in flight the
 * status is LoadingMore and the effect has torn the observer down. If the new
 * page is still short enough to leave the sentinel on screen the effect re-runs
 * and fires again, which is how a short viewport keeps filling itself.
 */
export default function LoadMoreSentinel({
  onLoadMore,
  status,
}: {
  onLoadMore: () => void;
  status: PaginationStatus;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const canLoadMore = status === "CanLoadMore";

  useEffect(() => {
    const node = ref.current;
    if (!node || !canLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          observer.disconnect();
          onLoadMore();
        }
      },
      { rootMargin: "400px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [onLoadMore, canLoadMore]);

  if (status === "Exhausted" || status === "LoadingFirstPage") return null;

  return (
    <div
      ref={ref}
      className="border-t border-gray-100 px-6 py-4 text-center dark:border-gray-700"
    >
      <span className="text-sm text-gray-400 dark:text-gray-500">
        Loading more...
      </span>
    </div>
  );
}
