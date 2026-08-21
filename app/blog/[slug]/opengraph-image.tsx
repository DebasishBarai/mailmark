import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { articles } from "./articles";

export const alt = "Mailmark";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Pre-render one card per article at build time, alongside the pages
// themselves, rather than generating them on first request.
export function generateStaticParams() {
  return Object.keys(articles).map((slug) => ({ slug }));
}

// Warm Cream, the site's signature theme. Same values as the tokens in
// globals.css, restated here because Satori resolves no CSS variables.
const PAPER = "#ece7df";
const INK = "#16130f";
const ACCENT = "#ce3a1b";
const ACCENT_DEEP = "#a82c11";
const MUTED = "#635b4f";
const RULE = "#d3cabb";

// Read from disk rather than fetch(new URL(..., import.meta.url)): Turbopack
// does not implement fetch over file: URLs, and the build fails on it. Every
// card is prerendered (see generateStaticParams), so this only ever runs while
// the project directory is present.
async function font(file: string) {
  return readFile(join(process.cwd(), "assets", "fonts", file));
}

/**
 * The brand mark, drawn for Satori.
 *
 * The shipped SVG knocks the badge out of the envelope with a mask so it can
 * sit on any surface. Here the surface is always the paper colour, so the
 * badge gets an opaque ring of paper instead, which keeps the artwork inside
 * the subset of SVG that Satori's renderer handles.
 */
function Mark({ size: s }: { size: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 100 100">
      <defs>
        <linearGradient id="m" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={ACCENT} />
          <stop offset="100%" stopColor={ACCENT_DEEP} />
        </linearGradient>
        <clipPath id="c">
          <rect x="4" y="16" width="66" height="50" rx="8" />
        </clipPath>
      </defs>
      <rect
        x="4" y="16" width="66" height="50" rx="8"
        fill="none" stroke="url(#m)" strokeWidth="7" strokeLinejoin="round"
      />
      <line
        x1="4" y1="16" x2="37" y2="44"
        stroke="url(#m)" strokeWidth="7" strokeLinecap="round" clipPath="url(#c)"
      />
      <line
        x1="70" y1="16" x2="37" y2="44"
        stroke="url(#m)" strokeWidth="7" strokeLinecap="round" clipPath="url(#c)"
      />
      <circle cx="67" cy="62" r="20" fill={PAPER} />
      <circle cx="67" cy="62" r="18" fill="url(#m)" />
      <polyline
        points="58,62 65,69 77,53"
        fill="none" stroke="#fbf9f4" strokeWidth="4"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = articles[slug];

  // A slug with no article still 404s on the page itself; the card just falls
  // back to the site's own line rather than rendering an empty layout.
  const title = article?.title ?? "Email Hosting & Campaigns for Your Domain";
  const excerpt = article?.excerpt ?? "";
  const category = article?.category ?? "Email platform";

  // The headline is the one piece of variable-length copy on the card. Long
  // titles get a smaller size so they stay inside three lines instead of
  // pushing the excerpt and footer off the bottom.
  const titleSize = title.length > 62 ? 50 : title.length > 44 ? 58 : 66;

  // Every excerpt in articles.ts fits as written; the cap is only a guard for
  // a longer one added later. Cut on a space so it never ends mid-word.
  const LIMIT = 190;
  const blurb =
    excerpt.length > LIMIT
      ? excerpt.slice(0, excerpt.lastIndexOf(" ", LIMIT)).trimEnd() + "..."
      : excerpt;

  const [display, wordmark, sans, mono] = await Promise.all([
    font("Fraunces-Display.ttf"),
    font("Fraunces-Wordmark.ttf"),
    font("SchibstedGrotesk.ttf"),
    font("DMMono.ttf"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "70px 76px",
          background: PAPER,
          color: INK,
          fontFamily: "Schibsted",
          position: "relative",
        }}
      >
        {/* Oversized mark bleeding off the right edge, faint, as a watermark. */}
        <div
          style={{
            position: "absolute",
            display: "flex",
            right: -170,
            top: 15,
            opacity: 0.07,
          }}
        >
          <Mark size={600} />
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <Mark size={50} />
          <span
            style={{
              fontFamily: "FrauncesWordmark",
              fontSize: 39,
              letterSpacing: "-0.03em",
              color: ACCENT,
              marginLeft: 13,
            }}
          >
            Mailmark
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontFamily: "Fraunces",
              fontSize: titleSize,
              lineHeight: 1.08,
              letterSpacing: "-0.022em",
              maxWidth: 900,
              // Satori has no line clamp, and the size step above is what
              // keeps a long title from overrunning the card.
              display: "flex",
            }}
          >
            {title}
          </div>
          {blurb ? (
            <div
              style={{
                marginTop: 22,
                fontSize: 25,
                lineHeight: 1.45,
                color: MUTED,
                maxWidth: 720,
                display: "flex",
              }}
            >
              {blurb}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 26,
            borderTop: `2px solid ${RULE}`,
            fontFamily: "DMMono",
          }}
        >
          <span style={{ fontSize: 23, color: "#7c7365" }}>www.mailmark.dev</span>
          <span
            style={{
              fontSize: 18,
              color: ACCENT,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            {category}
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Fraunces", data: display, style: "normal", weight: 600 },
        { name: "FrauncesWordmark", data: wordmark, style: "normal", weight: 700 },
        { name: "Schibsted", data: sans, style: "normal", weight: 400 },
        { name: "DMMono", data: mono, style: "normal", weight: 400 },
      ],
    },
  );
}
