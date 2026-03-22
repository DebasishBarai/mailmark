"use client";

import { useEffect, useRef, useState } from "react";
import { Player } from "@remotion/player";
import type { PlayerRef } from "@remotion/player";
import { PersonalizationVideo } from "../../remotion/PersonalizationVideo";

export default function PersonalizationPlayer({ autoPlay = false }: { autoPlay?: boolean }) {
  const playerRef = useRef<PlayerRef>(null);
  const [started, setStarted] = useState(autoPlay);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const update = () =>
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (autoPlay) {
      playerRef.current?.play();
    }
  }, [autoPlay]);

  const handlePlay = () => {
    playerRef.current?.play();
    setStarted(true);
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl shadow-xl">
      <Player
        ref={playerRef}
        component={PersonalizationVideo}
        durationInFrames={1350}
        fps={30}
        compositionWidth={1280}
        compositionHeight={720}
        style={{
          width: "100%",
          display: "block",
          background: "transparent",
        }}
        inputProps={{ theme }}
        controls={false}
        loop
      />

      {!started && (
        <div
          className="absolute inset-0 flex cursor-pointer items-center justify-center"
          onClick={handlePlay}
        >
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
      )}
    </div>
  );
}
