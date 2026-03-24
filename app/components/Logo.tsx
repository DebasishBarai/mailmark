"use client";

import { useId } from "react";

interface LogoProps {
  size?: number;
}

export default function Logo({ size = 36 }: LogoProps) {
  const id = useId();
  const gradId = `logo-grad-${id}`;
  const clipId = `logo-clip-${id}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label="Mailmark logo"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#5b21b6" />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x="4" y="16" width="66" height="50" rx="8" />
        </clipPath>
      </defs>

      {/* Inner fill - white in light mode, dark in dark mode */}
      <rect
        x="4" y="16" width="66" height="50" rx="8"
        className="fill-white dark:fill-[#0f172a]"
      />

      {/* Envelope body outline */}
      <rect
        x="4" y="16" width="66" height="50" rx="8"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="7"
        strokeLinejoin="round"
      />

      {/* M-letter fold lines */}
      <line
        x1="4" y1="16" x2="37" y2="44"
        stroke={`url(#${gradId})`} strokeWidth="7" strokeLinecap="round"
        clipPath={`url(#${clipId})`}
      />
      <line
        x1="70" y1="16" x2="37" y2="44"
        stroke={`url(#${gradId})`} strokeWidth="7" strokeLinecap="round"
        clipPath={`url(#${clipId})`}
      />

      {/* Ring behind badge */}
      <circle cx="67" cy="62" r="20" className="fill-white dark:fill-[#0f172a]" />

      {/* Badge circle */}
      <circle cx="67" cy="62" r="18" fill={`url(#${gradId})`} />

      {/* Checkmark inside badge */}
      <polyline
        points="58,62 65,69 77,53"
        fill="none"
        stroke="white"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
