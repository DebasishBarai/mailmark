import type { Metadata } from "next";

/**
 * The site-wide social card.
 *
 * When a page declares its own `openGraph`, Next replaces the parent layout's
 * object wholesale rather than merging the two. A page that sets `openGraph`
 * without repeating `images` therefore emits no `og:image` at all, even though
 * the root layout names one. That is how the home page came to unfurl with no
 * picture in WhatsApp, which reads `og:image` and ignores `twitter:image`.
 *
 * So spread these into every page-level `openGraph` / `twitter` block instead
 * of restating the path, and keep the pair together: a page that overrides one
 * of the two objects usually needs to override both.
 *
 * Per-article blog cards are the deliberate exception. They come from
 * app/blog/[slug]/opengraph-image.tsx, and naming an image in that route's
 * metadata would override the generated card with this one.
 */
export const ogImages: NonNullable<
  NonNullable<Metadata["openGraph"]>["images"]
> = [{ url: "/og-image.png", width: 1200, height: 630, alt: "Mailmark" }];

export const twitterImages: NonNullable<
  NonNullable<Metadata["twitter"]>["images"]
> = ["/og-image.png"];
