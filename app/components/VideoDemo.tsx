"use client";

import dynamic from "next/dynamic";
import SectionHeader from "./SectionHeader";

// VideoPlayer uses Remotion which must be client-side only
const VideoPlayer = dynamic(() => import("./VideoPlayer"), { ssr: false });

export default function VideoDemo() {
  return (
    <section className="relative bg-white px-6 py-20 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          index="02"
          label="See it work"
          title="See Mailmark in action"
          subtitle="Watch how easy it is to set up your domain, create sender mailboxes, and launch your first email campaign."
        />

        <div>
          <VideoPlayer />
        </div>

        <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Click to play &middot; overview
        </p>
      </div>
    </section>
  );
}
