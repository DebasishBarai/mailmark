"use client";

import dynamic from "next/dynamic";

const PersonalizationPlayer = dynamic(() => import("./PersonalizationPlayer"), { ssr: false });

export default function PersonalizationDemo() {
  return (
    <section className="relative bg-white px-6 py-20 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white md:text-4xl">
          Make It Yours
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
          Choose from 11 themes, set background wallpapers, adjust UI density,
          and craft professional email signatures - all synced across devices.
        </p>

        <div className="mt-10">
          <PersonalizationPlayer />
        </div>

        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Click to play &middot; personalization features
        </p>
      </div>
    </section>
  );
}
