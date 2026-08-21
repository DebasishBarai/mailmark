"use client";

import { useId } from "react";

interface LogoProps {
  size?: number;
}

/**
 * The Mailmark brand mark: an envelope drawn as an "M", with a verified badge
 * knocked into its lower-right corner.
 *
 * Colours come from the --logo-* tokens in globals.css, which resolve to the
 * active theme's accent, so the mark tracks the theme exactly the way the
 * "Mailmark" wordmark next to it does.
 *
 * The mark is fully transparent apart from its strokes: the badge is cut out
 * of the envelope with a mask rather than covered by an opaque disc, so there
 * is no background colour to keep in sync with whatever surface it sits on.
 */
export default function Logo({ size = 36 }: LogoProps) {
  const id = useId();
  const gradId = `logo-grad-${id}`;
  const clipId = `logo-clip-${id}`;
  const maskId = `logo-mask-${id}`;

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
        {/* Old: gradient hard-coded to the original violet brand colours.
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#5b21b6" />
            </linearGradient> */}
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          {/* Set through `style` rather than the stop-color attribute:
              var() in an SVG presentation attribute is not reliable across
              browsers, in a style declaration it is. */}
          <stop offset="0%" style={{ stopColor: "var(--logo-from)" }} />
          <stop offset="100%" style={{ stopColor: "var(--logo-to)" }} />
        </linearGradient>

        {/* Keeps the M-fold lines inside the envelope body. */}
        <clipPath id={clipId}>
          <rect x="4" y="16" width="66" height="50" rx="8" />
        </clipPath>

        {/* Cuts a hole in the envelope where the badge overlaps it, so the gap
            between the two is the surface behind the mark rather than a solid
            colour we would have to theme. */}
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <rect x="0" y="0" width="100" height="100" fill="white" />
          <circle cx="67" cy="62" r="20" fill="black" />
        </mask>
      </defs>

      {/* Old: opaque inner fill, needed only because the badge sat on top of it.
          <rect
            x="4" y="16" width="66" height="50" rx="8"
            className="fill-white dark:fill-[#0f172a]"
          /> */}

      <g mask={`url(#${maskId})`}>
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
      </g>

      {/* Old: opaque ring standing in for the mask above.
          <circle cx="67" cy="62" r="20" className="fill-white dark:fill-[#0f172a]" /> */}

      {/* Badge circle */}
      <circle cx="67" cy="62" r="18" fill={`url(#${gradId})`} />

      {/* Checkmark inside badge. Old: stroke="white". */}
      <polyline
        points="58,62 65,69 77,53"
        fill="none"
        style={{ stroke: "var(--logo-check)" }}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
