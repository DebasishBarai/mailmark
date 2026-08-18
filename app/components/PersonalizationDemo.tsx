"use client";

import dynamic from "next/dynamic";

const PersonalizationPlayer = dynamic(() => import("./PersonalizationPlayer"), { ssr: false });

export default function PersonalizationDemo() {
  return (
    <section className="relative border-b-2 border-black bg-white px-6 py-20">
      <div className="mx-auto max-w-6xl text-center">
        <span className="mb-4 inline-block rounded-full border-2 border-black bg-lavender-rose px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-black">
          Make it yours
        </span>
        <h2 className="text-3xl font-extrabold tracking-tight text-black md:text-4xl">
          An inbox that works the way you do
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-black/70">
          Pick from 11 themes, set a wallpaper, adjust UI density, and craft
          per-mailbox signatures. Your setup syncs across every device and every
          product you manage.
        </p>

        <div className="mt-10">
          <PersonalizationPlayer />
        </div>

        <p className="mt-4 text-sm font-semibold text-black/60">
          Click to play &middot; personalization
        </p>
      </div>
    </section>
  );
}
