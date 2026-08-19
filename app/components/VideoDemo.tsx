"use client";

import dynamic from "next/dynamic";

// VideoPlayer uses Remotion which must be client-side only
const VideoPlayer = dynamic(() => import("./VideoPlayer"), { ssr: false });

export default function VideoDemo() {
  return (
    <section className="relative bg-white px-6 py-20 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl text-center">
        <h2 className="font-display text-3xl text-gray-900 dark:text-white md:text-4xl">
          See Mailmark in Action
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
          Watch how easy it is to set up your domain, create sender mailboxes,
          and launch your first email campaign.
        </p>

        <div className="mt-10">
          <VideoPlayer />
        </div>

        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Click to play &middot; overview
        </p>
      </div>
    </section>
  );
}
