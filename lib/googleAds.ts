/**
 * Google Ads conversion tracking.
 *
 * Everything in here is browser only. `window` and `gtag` do not exist during
 * server rendering, so every entry point guards on `typeof window`.
 */

// ---------------------------------------------------------------------------
// REPLACE THESE TWO CONSTANTS once the Google Ads conversion action exists.
// Google Ads gives you a snippet shaped like:
//   gtag('event', 'conversion', { send_to: 'AW-123456789/AbC-D_efG12hIjKlMn' })
// The part before the slash is the conversion ID, the part after is the label.
// ---------------------------------------------------------------------------
export const GOOGLE_ADS_CONVERSION_ID = "AW-XXXXXXXXX"; // TODO: replace
export const GOOGLE_ADS_SIGNUP_CONVERSION_LABEL = "YYYYYYYYYYY"; // TODO: replace

/** `send_to` value for the trial signup conversion action. */
export const SIGNUP_CONVERSION_SEND_TO = `${GOOGLE_ADS_CONVERSION_ID}/${GOOGLE_ADS_SIGNUP_CONVERSION_LABEL}`;

/** Declared value of a trial start, used for Google Ads bidding. */
export const SIGNUP_CONVERSION_VALUE = 10.0;
export const SIGNUP_CONVERSION_CURRENCY = "USD";

/** True once the placeholders above have been swapped for real values. */
export const isGoogleAdsConfigured =
  !GOOGLE_ADS_CONVERSION_ID.includes("X") &&
  !GOOGLE_ADS_SIGNUP_CONVERSION_LABEL.includes("Y");

/**
 * Optional GA4 measurement ID (the `G-XXXXXXX` value, not the numeric property
 * ID). GA4 was set up outside this repo, so leave this unset unless you want
 * the tag loaded here to configure GA4 as well. Setting it when GA4 is already
 * on the page would double count pageviews.
 */
export const GA4_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ?? "";

type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GtagFn;
  }
}

/**
 * Returns the page's `gtag` function, creating the standard dataLayer shim if
 * the library has not finished loading yet. Commands pushed to the queue are
 * replayed in order once gtag.js executes.
 */
export function getGtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  return typeof window.gtag === "function" ? window.gtag : null;
}

/**
 * Fires the trial signup conversion. Returns false when gtag is not available
 * (blocked by an extension, or the tag has not loaded), so the caller can retry
 * instead of marking the conversion as sent.
 */
export function fireSignupConversion(): boolean {
  const gtag = getGtag();
  if (!gtag) return false;

  gtag("event", "conversion", {
    send_to: SIGNUP_CONVERSION_SEND_TO,
    value: SIGNUP_CONVERSION_VALUE,
    currency: SIGNUP_CONVERSION_CURRENCY,
  });

  if (process.env.NODE_ENV !== "production") {
    console.info("[google-ads] trial signup conversion sent", SIGNUP_CONVERSION_SEND_TO);
  }

  return true;
}
