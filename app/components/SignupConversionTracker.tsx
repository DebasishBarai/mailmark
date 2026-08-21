"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { fireSignupConversion, getGtag, isGoogleAdsConfigured } from "../../lib/googleAds";

/**
 * Fires the Google Ads trial signup conversion exactly once per new user.
 *
 * Why the Clerk user object and not `useSignUp()`: signups happen through
 * Clerk's modal (`<SignUpButton mode="modal" forceRedirectUrl="/dashboard">`),
 * and the OAuth providers (GitHub, Google) take the browser off site and bring
 * it back on a fresh page load. There is no client component of ours alive
 * across that round trip, so the only signal that survives every path is the
 * age of the Clerk user on the landing route. A brand new user has a
 * `createdAt` a few seconds old, a returning login has one from days ago, so
 * logins never fire the conversion.
 *
 * Mounted from `app/(protected)/layout.tsx` inside `<Authenticated>`, which
 * covers /dashboard (the post-signup redirect target) and every other
 * protected route in case Clerk returns the user somewhere else.
 */

// How fresh a Clerk account has to be to count as "just signed up". Generous
// enough to absorb an OAuth round trip plus a slow first dashboard render, far
// short of anything a returning user could hit.
const NEW_USER_WINDOW_MS = 10 * 60 * 1000;

// The Google tag loads with strategy="afterInteractive", so it can still be in
// flight when this effect runs. Poll briefly rather than dropping the event.
const GTAG_POLL_INTERVAL_MS = 250;
const GTAG_MAX_ATTEMPTS = 40; // ~10 seconds

const storageKey = (userId: string) => `mailmark_ads_signup_conversion_${userId}`;

/**
 * Persistent "already fired" flag. localStorage is preferred over
 * sessionStorage so a second tab or a browser restart inside the freshness
 * window cannot fire a duplicate. Both are wrapped because storage throws in
 * Safari private mode and when cookies are blocked.
 */
function hasFired(userId: string): boolean {
  const key = storageKey(userId);
  try {
    if (window.localStorage.getItem(key)) return true;
  } catch {
    // ignore and fall through to sessionStorage
  }
  try {
    return Boolean(window.sessionStorage.getItem(key));
  } catch {
    return false;
  }
}

function markFired(userId: string) {
  const key = storageKey(userId);
  const value = String(Date.now());
  try {
    window.localStorage.setItem(key, value);
    return;
  } catch {
    // ignore and fall through to sessionStorage
  }
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // storage unavailable, the in-memory guard below still covers this page
  }
}

// Guards against React StrictMode's double effect and Fast Refresh remounts,
// which both re-run the effect before any storage write would be observed.
const inFlight = new Set<string>();

export default function SignupConversionTracker() {
  const { isLoaded, isSignedIn, user } = useUser();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isGoogleAdsConfigured) return;
    if (!isLoaded || !isSignedIn || !user) return;

    const createdAt = user.createdAt?.getTime();
    if (!createdAt) return;

    // Returning login, not a trial start.
    if (Date.now() - createdAt > NEW_USER_WINDOW_MS) return;

    if (inFlight.has(user.id) || hasFired(user.id)) return;
    inFlight.add(user.id);

    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const attempt = () => {
      if (cancelled) return;

      if (getGtag()) {
        // Mark before sending so a remount mid-send cannot duplicate the event.
        markFired(user.id);
        fireSignupConversion();
        inFlight.delete(user.id);
        return;
      }

      attempts += 1;
      if (attempts >= GTAG_MAX_ATTEMPTS) {
        // Tag never showed up (ad blocker, or the tag is not on this route).
        // Leave the flag unset so a later visit inside the window can retry.
        inFlight.delete(user.id);
        return;
      }
      timer = setTimeout(attempt, GTAG_POLL_INTERVAL_MS);
    };

    attempt();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      inFlight.delete(user.id);
    };
  }, [isLoaded, isSignedIn, user]);

  return null;
}
