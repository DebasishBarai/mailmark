"use client";

import { useState, useCallback, useEffect } from "react";

const YOUTUBE_EMBED_URL =
  "https://www.youtube.com/embed/YOUR_VIDEO_ID?autoplay=1&modestbranding=1&rel=0";

export default function VideoDemo() {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, close]);

  return (
    <>
      <section className="relative bg-white px-6 py-20 dark:bg-gray-900">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white md:text-4xl">
            See RemindMe in Action
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
            Watch how easy it is to add your domain, create mailboxes, and send
            campaigns — all from one dashboard.
          </p>

          {/* Thumbnail / play trigger */}
          <button
            onClick={() => setOpen(true)}
            className="group relative mx-auto mt-10 block w-full overflow-hidden rounded-2xl border border-gray-200 shadow-xl transition-shadow hover:shadow-2xl dark:border-gray-700"
          >
            {/* Preview placeholder — replace with an actual thumbnail image */}
            <div className="relative aspect-video w-full bg-gradient-to-br from-violet-600 to-indigo-700">
              {/* Decorative mockup lines */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[70%] space-y-3 rounded-xl border border-white/20 bg-white/10 p-6 backdrop-blur-sm">
                  <div className="h-3 w-1/3 rounded bg-white/30" />
                  <div className="h-2 w-2/3 rounded bg-white/20" />
                  <div className="h-2 w-1/2 rounded bg-white/20" />
                  <div className="h-2 w-3/5 rounded bg-white/20" />
                </div>
              </div>

              {/* Play button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform group-hover:scale-110 dark:bg-gray-900/90">
                  <svg
                    className="ml-1 h-8 w-8 text-violet-600"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>

              {/* Duration badge */}
              <div className="absolute bottom-4 right-4 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
                2:30
              </div>
            </div>
          </button>

          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Click to play &middot; 2 min overview
          </p>
        </div>
      </section>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <div
            className="relative w-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={close}
              className="absolute -top-10 right-0 text-white/80 transition-colors hover:text-white"
            >
              <svg
                className="h-8 w-8"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl">
              <iframe
                className="h-full w-full"
                src={YOUTUBE_EMBED_URL}
                title="RemindMe Demo"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
