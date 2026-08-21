"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { fireSignupConversion, getGtag, isGoogleAdsConfigured } from "../../lib/googleAds";

/**
 * Fires the Google Ads trial signup conversion exactly once per new user.
 *
 * The gate is `isNewUser`, which comes from `api.users.addUser`: that action
 * creates the Convex user row (and the Polar customer) only the first time a
 * given Clerk account is seen, so it reports isNew true on exactly one call
 * ever. A returning login always resolves false, whatever route it lands on.
 *
 * Rendered by SyncUser in `app/(protected)/layout.tsx`, which owns that call.
 * That covers /dashboard, the post-signup redirect target, plus every other
 * protected route in case Clerk returns the user somewhere else. It matters
 * that the signal is not route based: the OAuth providers (GitHub, Google) take
 * the browser off site and bring it back on a fresh page load, so nothing of
 * ours survives the round trip. addUser runs again on that landing load and is
 * what answers the question.
 *
 * The Clerk account age is kept as a secondary sanity check. It cannot rescue a
 * wrong isNew, but it does catch the case where a stale or replayed sync
 * reports a new user for an account that plainly is not new.
 */

// How fresh a Clerk account has to be for an isNew report to be believable.
// Generous enough to absorb an OAuth round trip plus a slow first dashboard
// render, far short of anything a returning user could hit.
const NEW_USER_MAX_AGE_MS = 10 * 60 * 1000;

// The Google tag loads with strategy="afterInteractive", so it can still be in
// flight when this effect runs. Poll briefly rather than dropping the event.
const GTAG_POLL_INTERVAL_MS = 250;
const GTAG_MAX_ATTEMPTS = 40; // ~10 seconds

const storageKey = (userId: string) => `mailmark_ads_signup_conversion_${userId}`;

/**
 * Persistent "already fired" flag. localStorage is preferred over
 * sessionStorage so a second tab or a browser restart cannot fire a duplicate.
 * Both are wrapped because storage throws in Safari private mode and when
 * cookies are blocked.
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

export default function SignupConversionTracker({
  isNewUser,
}: {
  /** null while the user sync is still in flight, or if it failed. */
  isNewUser: boolean | null;
}) {
  const { isLoaded, isSignedIn, user } = useUser();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isGoogleAdsConfigured) return;

    // Not a signup, or not yet known to be one. Either way, nothing to report.
    if (isNewUser !== true) return;

    if (!isLoaded || !isSignedIn || !user) return;

    // Sanity check: a genuinely new signup has a brand new Clerk account.
    const createdAt = user.createdAt?.getTime();
    if (createdAt && Date.now() - createdAt > NEW_USER_MAX_AGE_MS) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "[google-ads] addUser reported a new user but the Clerk account is not fresh, skipping"
        );
      }
      return;
    }

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
        // Nothing is marked, but addUser will report isNew false from here on,
        // so this conversion is simply lost rather than reported late.
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
  }, [isNewUser, isLoaded, isSignedIn, user]);

  return null;
}
