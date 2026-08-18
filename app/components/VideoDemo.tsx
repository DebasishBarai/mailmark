"use client";

import dynamic from "next/dynamic";

// VideoPlayer uses Remotion which must be client-side only
const VideoPlayer = dynamic(() => import("./VideoPlayer"), { ssr: false });

export default function VideoDemo() {
  return (
    <section className="relative border-b-2 border-black bg-aquamarine px-6 py-20">
      <div className="mx-auto max-w-6xl text-center">
        <span className="mb-4 inline-block rounded-full border-2 border-black bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-black">
          60-second tour
        </span>
        <h2 className="text-3xl font-extrabold tracking-tight text-black md:text-4xl">
          See it all in one place
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-black/80">
          Add a domain, spin up mailboxes, send your users an update, or fire an
          email from code. Watch how the whole flow lives under one login.
        </p>

        <div className="mt-10 overflow-hidden rounded-xl border-2 border-black shadow-[8px_8px_0px_#000]">
          <VideoPlayer />
        </div>

        <p className="mt-4 text-sm font-semibold text-black/70">
          Click to play &middot; product overview
        </p>
      </div>
    </section>
  );
}
