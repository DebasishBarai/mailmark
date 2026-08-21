"use client";

import Script from "next/script";
import { useEffect } from "react";
import {
  GA4_MEASUREMENT_ID,
  GOOGLE_ADS_CONVERSION_ID,
  isGoogleAdsConfigured,
} from "../../lib/googleAds";

/**
 * Loads the Google tag (gtag.js) and configures the Google Ads account used for
 * conversion tracking.
 *
 * Mounted from the root layout, so the tag is present on the marketing pages
 * and on every route inside `app/(protected)` (the route group shares the root
 * layout), which is where a user lands after signing up.
 *
 * Nothing in this repo loaded a Google tag before this component, so there is
 * no snippet here to reuse. If a tag is injected outside the repo (a GA4
 * snippet added through another channel, or Google Tag Manager) the two
 * coexist: the init below reuses `window.dataLayer` and `window.gtag` when they
 * already exist rather than replacing them, which is the pattern Google
 * documents for running Ads alongside an existing tag. The effect logs a notice
 * in development if that happens, since an Ads conversion is usually better
 * configured inside GTM when GTM is the tag in place.
 */
export default function GoogleTag() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const gtm = document.querySelector('script[src*="googletagmanager.com/gtm.js"]');
    if (gtm) {
      console.info(
        "[google-ads] Google Tag Manager detected on the page. gtag.js still works alongside it, but consider configuring the conversion in GTM instead."
      );
    }
  }, []);

  // Nothing to configure until the real conversion ID is filled in. Loading
  // gtag.js with the placeholder would just be a wasted request.
  if (!isGoogleAdsConfigured && !GA4_MEASUREMENT_ID) {
    return null;
  }

  const primaryId = isGoogleAdsConfigured ? GOOGLE_ADS_CONVERSION_ID : GA4_MEASUREMENT_ID;

  return (
    <>
      <Script
        id="gtag-js"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${primaryId}`}
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          window.gtag('js', new Date());
          ${isGoogleAdsConfigured ? `window.gtag('config', '${GOOGLE_ADS_CONVERSION_ID}');` : ""}
          ${GA4_MEASUREMENT_ID ? `window.gtag('config', '${GA4_MEASUREMENT_ID}');` : ""}
        `}
      </Script>
    </>
  );
}
