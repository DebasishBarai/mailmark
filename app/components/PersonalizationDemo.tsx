"use client";

import dynamic from "next/dynamic";
import SectionHeader from "./SectionHeader";

const PersonalizationPlayer = dynamic(() => import("./PersonalizationPlayer"), { ssr: false });

export default function PersonalizationDemo() {
  return (
    <section className="relative bg-white px-6 py-20 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          index="05"
          label="Make it yours"
          title="Make it yours"
          subtitle="Choose from 11 themes, set background wallpapers, adjust UI density, and craft professional email signatures, all synced across devices."
        />

        <div>
          <PersonalizationPlayer />
        </div>

        <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Click to play &middot; personalization features
        </p>
      </div>
    </section>
  );
}
