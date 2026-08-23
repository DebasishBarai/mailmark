"use client";

import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  ADS_TAG_LIVE_AT,
  fireSignupConversion,
  getGtag,
  isGoogleAdsConfigured,
} from "../../lib/googleAds";

/**
 * Fires the Google Ads trial signup conversion exactly once per new user.
 *
 * The gate is the user row itself: `signupConversionReportedAt` absent means
 * the conversion is still owed, and the row is only stamped once gtag has
 * accepted the event.
 *
 * Old gate: the `isNew` flag returned by `api.users.addUser`. That was correct
 * but one-shot. isNew is true on exactly one call ever, so the fact "this user
 * is owed a conversion" existed only for the few seconds of the signup page
 * load. Anything that ate that window lost the conversion permanently, with no
 * retry, because nothing recorded that a retry was owed: an ad blocker, the tab
 * closing, or the user clicking a plan in UpgradeModal (which every brand new
 * account meets immediately, since TRIAL_DURATION_MS is 0) and being sent to
 * Polar checkout by window.location. That window is not small: the fire cannot
 * happen until addUser returns, and addUser blocks on creating a Polar customer
 * over the network first.
 *
 * Reading the persisted field instead makes a lost fire recoverable. If it does
 * not go out on the signup load, the field is still absent and the next visit
 * to any protected route settles it.
 *
 * ADS_TAG_LIVE_AT is what keeps that from firing for the whole existing user
 * base, whose rows also have no timestamp but were never owed anything.
 *
 * Rendered by SyncUser in `app/(protected)/layout.tsx`, which owns the addUser
 * call that creates the row. That covers /dashboard, the post-signup redirect
 * target, plus every other protected route in case Clerk returns the user
 * somewhere else. It matters that the signal is not route based: the OAuth
 * providers take the browser off site and bring it back on a fresh page load,
 * so nothing of ours survives the round trip. The user row does.
 */

// The Google tag loads with strategy="afterInteractive", so it can still be in
// flight when this effect runs. Poll briefly rather than dropping the event.
const GTAG_POLL_INTERVAL_MS = 250;
const GTAG_MAX_ATTEMPTS = 40; // ~10 seconds

const storageKey = (userId: string) => `mailmark_ads_signup_conversion_${userId}`;

/**
 * Local "already fired" flag. This is not the source of truth (the user row
 * is), it only covers the gap between gtag accepting the event and the mutation
 * landing, so a reload inside that window cannot double count. Both stores are
 * wrapped because storage throws in Safari private mode and when cookies are
 * blocked.
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

// Old signature: the isNew answer was passed down from SyncUser.
// export default function SignupConversionTracker({ isNewUser }: { isNewUser: boolean | null }) {
export default function SignupConversionTracker() {
  // undefined while loading, null when the row does not exist yet (the very
  // first moments of a signup, before addUser has created it).
  const user = useQuery(api.users.current);
  const markReported = useMutation(api.users.markSignupConversionReported);

  const userId = user?._id;
  const createdAt = user?._creationTime;
  const reportedAt = user?.signupConversionReportedAt;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isGoogleAdsConfigured) return;

    // Row not loaded yet, or not created yet. Either way, nothing to report.
    if (!userId || createdAt === undefined) return;

    // Already reported. This is the authoritative check.
    if (reportedAt !== undefined) return;

    // Signed up before the tag existed, so no conversion was ever owed.
    if (createdAt < ADS_TAG_LIVE_AT) return;

    if (inFlight.has(userId) || hasFired(userId)) return;
    inFlight.add(userId);

    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const attempt = () => {
      if (cancelled) return;

      if (getGtag()) {
        // Old order: markFired ran before the send, so an event gtag never
        // accepted was still recorded as sent.
        if (fireSignupConversion()) {
          markFired(userId);
          // Settle the debt on the row. If this throws the field stays absent
          // and the next visit retries, which is the intended direction to
          // fail: a duplicate is recoverable in the Ads UI, a silent loss is
          // not.
          markReported().catch(() => {
            /* retried on the next visit */
          });
        }
        inFlight.delete(userId);
        return;
      }

      attempts += 1;
      if (attempts >= GTAG_MAX_ATTEMPTS) {
        // Tag never showed up (ad blocker, or the tag is not on this route).
        // Nothing is marked and the row is not stamped, so the conversion is
        // still owed and the next visit will try again.
        inFlight.delete(userId);
        return;
      }
      timer = setTimeout(attempt, GTAG_POLL_INTERVAL_MS);
    };

    attempt();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      inFlight.delete(userId);
    };
  }, [userId, createdAt, reportedAt, markReported]);

  return null;
}
