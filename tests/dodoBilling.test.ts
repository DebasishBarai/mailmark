import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  WEBHOOK_TOLERANCE_MS,
  mapDodoStatus,
  parseIsoMs,
  planForProductId,
  productIdForPlan,
  trialDaysForPlan,
  trialEndsAtOf,
  verifyWebhookSignature,
  type DodoSubscription,
} from "../convex/lib/billing";

/**
 * These two functions are the ones that gate money and access.
 *
 * verifyWebhookSignature is the only thing standing between a public URL and
 * "grant this Clerk id a Business subscription". The Polar handler it replaces
 * compared the signature header to the raw shared secret, which cannot match a
 * Standard Webhooks HMAC, so the check was commented out and every unsigned
 * POST was accepted.
 *
 * mapDodoStatus decides whether a customer keeps their plan limits. Getting the
 * cancelled branch wrong drops a paid-up customer to the free tier.
 */

const at = (iso: string) => Date.parse(iso);

// ── Helpers ─────────────────────────────────────────────────────────────────

/** A Standard Webhooks signature, built the way Dodo builds it. */
async function sign(
  secret: string,
  id: string,
  timestamp: string,
  body: string
): Promise<string> {
  const encoded = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const binary = atob(encoded);
  const keyBytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) keyBytes[i] = binary.charCodeAt(i);

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`)
  );
  return btoa(String.fromCharCode(...new Uint8Array(mac)));
}

const SECRET = "whsec_" + btoa("a-test-signing-secret-of-some-length");
const OTHER_SECRET = "whsec_" + btoa("a-different-signing-secret-here!!");

const NOW = at("2026-09-16T12:00:00.000Z");
const TS = String(Math.floor(NOW / 1000));
const BODY = JSON.stringify({ type: "subscription.active", data: { subscription_id: "sub_1" } });
const ID = "evt_01HZY";

/** A subscription payload with sane defaults, overridable per test. */
function subscription(overrides: Partial<DodoSubscription> = {}): DodoSubscription {
  return {
    subscription_id: "sub_1",
    status: "active",
    product_id: "pdt_pro",
    created_at: "2026-09-01T00:00:00.000Z",
    next_billing_date: "2026-10-01T00:00:00.000Z",
    trial_period_days: 0,
    cancel_at_next_billing_date: false,
    ...overrides,
  };
}

// ── Signature verification ──────────────────────────────────────────────────

describe("verifyWebhookSignature", () => {
  test("accepts a correctly signed delivery", async () => {
    const signature = await sign(SECRET, ID, TS, BODY);
    expect(
      await verifyWebhookSignature({
        secret: SECRET,
        webhookId: ID,
        webhookTimestamp: TS,
        webhookSignature: `v1,${signature}`,
        rawBody: BODY,
        now: NOW,
      })
    ).toBe(true);
  });

  test("accepts a secret given without the whsec_ prefix", async () => {
    const bare = SECRET.slice(6);
    const signature = await sign(bare, ID, TS, BODY);
    expect(
      await verifyWebhookSignature({
        secret: bare,
        webhookId: ID,
        webhookTimestamp: TS,
        webhookSignature: `v1,${signature}`,
        rawBody: BODY,
        now: NOW,
      })
    ).toBe(true);
  });

  test("rejects a tampered body", async () => {
    const signature = await sign(SECRET, ID, TS, BODY);
    const tampered = JSON.stringify({
      type: "subscription.active",
      data: { subscription_id: "sub_ATTACKER" },
    });
    expect(
      await verifyWebhookSignature({
        secret: SECRET,
        webhookId: ID,
        webhookTimestamp: TS,
        webhookSignature: `v1,${signature}`,
        rawBody: tampered,
        now: NOW,
      })
    ).toBe(false);
  });

  test("rejects a signature made with a different secret", async () => {
    const signature = await sign(OTHER_SECRET, ID, TS, BODY);
    expect(
      await verifyWebhookSignature({
        secret: SECRET,
        webhookId: ID,
        webhookTimestamp: TS,
        webhookSignature: `v1,${signature}`,
        rawBody: BODY,
        now: NOW,
      })
    ).toBe(false);
  });

  test("rejects a signature bound to a different webhook id", async () => {
    // The id is part of the signed content, so a valid signature cannot be
    // lifted onto a replayed delivery carrying a fresh id.
    const signature = await sign(SECRET, "evt_OTHER", TS, BODY);
    expect(
      await verifyWebhookSignature({
        secret: SECRET,
        webhookId: ID,
        webhookTimestamp: TS,
        webhookSignature: `v1,${signature}`,
        rawBody: BODY,
        now: NOW,
      })
    ).toBe(false);
  });

  test("rejects a delivery older than the tolerance", async () => {
    const oldTs = String(Math.floor((NOW - WEBHOOK_TOLERANCE_MS - 1000) / 1000));
    const signature = await sign(SECRET, ID, oldTs, BODY);
    expect(
      await verifyWebhookSignature({
        secret: SECRET,
        webhookId: ID,
        webhookTimestamp: oldTs,
        webhookSignature: `v1,${signature}`,
        rawBody: BODY,
        now: NOW,
      })
    ).toBe(false);
  });

  test("rejects a delivery timestamped too far in the future", async () => {
    const futureTs = String(Math.floor((NOW + WEBHOOK_TOLERANCE_MS + 1000) / 1000));
    const signature = await sign(SECRET, ID, futureTs, BODY);
    expect(
      await verifyWebhookSignature({
        secret: SECRET,
        webhookId: ID,
        webhookTimestamp: futureTs,
        webhookSignature: `v1,${signature}`,
        rawBody: BODY,
        now: NOW,
      })
    ).toBe(false);
  });

  test("accepts when one of several space separated signatures matches", async () => {
    // Dodo keeps the previous secret valid for 24 hours after a rotation and
    // sends a signature for each, so a header with several entries must pass on
    // any one of them.
    const good = await sign(SECRET, ID, TS, BODY);
    const stale = await sign(OTHER_SECRET, ID, TS, BODY);
    expect(
      await verifyWebhookSignature({
        secret: SECRET,
        webhookId: ID,
        webhookTimestamp: TS,
        webhookSignature: `v1,${stale} v1,${good}`,
        rawBody: BODY,
        now: NOW,
      })
    ).toBe(true);
  });

  test("rejects malformed headers rather than throwing", async () => {
    const cases = ["", "garbage", "v1", "v1,", ",abc", "v2,abc"];
    for (const webhookSignature of cases) {
      expect(
        await verifyWebhookSignature({
          secret: SECRET,
          webhookId: ID,
          webhookTimestamp: TS,
          webhookSignature,
          rawBody: BODY,
          now: NOW,
        })
      ).toBe(false);
    }
  });

  test("rejects a non-numeric timestamp", async () => {
    const signature = await sign(SECRET, ID, "not-a-number", BODY);
    expect(
      await verifyWebhookSignature({
        secret: SECRET,
        webhookId: ID,
        webhookTimestamp: "not-a-number",
        webhookSignature: `v1,${signature}`,
        rawBody: BODY,
        now: NOW,
      })
    ).toBe(false);
  });

  test("rejects a secret that is not valid base64 rather than throwing", async () => {
    expect(
      await verifyWebhookSignature({
        secret: "whsec_!!!not!!!base64!!!",
        webhookId: ID,
        webhookTimestamp: TS,
        webhookSignature: "v1,abc",
        rawBody: BODY,
        now: NOW,
      })
    ).toBe(false);
  });
});

// ── Trial derivation ────────────────────────────────────────────────────────

describe("trialEndsAtOf", () => {
  test("is undefined when the subscription has no trial", () => {
    expect(trialEndsAtOf(subscription({ trial_period_days: 0 }))).toBeUndefined();
    expect(trialEndsAtOf(subscription({ trial_period_days: null }))).toBeUndefined();
  });

  test("is created_at plus the trial length", () => {
    expect(
      trialEndsAtOf(
        subscription({ created_at: "2026-09-01T00:00:00.000Z", trial_period_days: 7 })
      )
    ).toBe(at("2026-09-08T00:00:00.000Z"));
  });

  test("is undefined when created_at is missing or unparseable", () => {
    expect(trialEndsAtOf(subscription({ created_at: null, trial_period_days: 7 }))).toBeUndefined();
    expect(trialEndsAtOf(subscription({ created_at: "nope", trial_period_days: 7 }))).toBeUndefined();
  });
});

describe("trialDaysForPlan", () => {
  test("starter and pro carry the 7 day trial, business does not", () => {
    // Matches app/components/Pricing.tsx, which is what customers are promised.
    expect(trialDaysForPlan("starter")).toBe(7);
    expect(trialDaysForPlan("pro")).toBe(7);
    expect(trialDaysForPlan("business")).toBeUndefined();
  });
});

describe("parseIsoMs", () => {
  test("parses an ISO timestamp and tolerates absence", () => {
    expect(parseIsoMs("2026-10-01T00:00:00.000Z")).toBe(at("2026-10-01T00:00:00.000Z"));
    expect(parseIsoMs(null)).toBeUndefined();
    expect(parseIsoMs(undefined)).toBeUndefined();
    expect(parseIsoMs("")).toBeUndefined();
    expect(parseIsoMs("not a date")).toBeUndefined();
  });
});

// ── Status mapping ──────────────────────────────────────────────────────────

describe("mapDodoStatus", () => {
  test("active without a trial is active", () => {
    expect(mapDodoStatus(subscription({ status: "active" }), NOW)).toBe("active");
  });

  test("active inside its trial is trialing", () => {
    // Dodo has no trialing status; the schema, the paywall and the plan
    // counters all distinguish it, so it is derived from the trial window.
    const sub = subscription({
      status: "active",
      created_at: "2026-09-14T00:00:00.000Z",
      trial_period_days: 7,
    });
    expect(mapDodoStatus(sub, NOW)).toBe("trialing");
  });

  test("active after the trial window has passed is active", () => {
    const sub = subscription({
      status: "active",
      created_at: "2026-09-01T00:00:00.000Z",
      trial_period_days: 7,
    });
    expect(mapDodoStatus(sub, NOW)).toBe("active");
  });

  test("pending writes nothing", () => {
    expect(mapDodoStatus(subscription({ status: "pending" }), NOW)).toBeNull();
  });

  test("an unrecognised status writes nothing", () => {
    expect(mapDodoStatus(subscription({ status: "something_new" }), NOW)).toBeNull();
  });

  test("cancelled but paid through the period keeps the customer entitled", () => {
    // This is the whole point of the cancel-at-period-end change. The old
    // cancelViaPolar path wrote "canceled" immediately and dropped a customer
    // who had paid for the rest of the month to free tier limits.
    const sub = subscription({
      status: "cancelled",
      cancel_at_next_billing_date: true,
      next_billing_date: "2026-10-01T00:00:00.000Z",
    });
    expect(mapDodoStatus(sub, NOW)).toBe("active");
  });

  test("cancelled mid-trial stays trialing while the trial runs", () => {
    const sub = subscription({
      status: "cancelled",
      cancel_at_next_billing_date: true,
      created_at: "2026-09-14T00:00:00.000Z",
      trial_period_days: 7,
      next_billing_date: "2026-09-21T00:00:00.000Z",
    });
    expect(mapDodoStatus(sub, NOW)).toBe("trialing");
  });

  test("cancelled once the paid period has run out is canceled", () => {
    const sub = subscription({
      status: "cancelled",
      cancel_at_next_billing_date: true,
      next_billing_date: "2026-09-01T00:00:00.000Z",
    });
    expect(mapDodoStatus(sub, NOW)).toBe("canceled");
  });

  test("cancelled outright, with no period left to honour, is canceled", () => {
    const sub = subscription({
      status: "cancelled",
      cancel_at_next_billing_date: false,
      next_billing_date: "2026-10-01T00:00:00.000Z",
    });
    expect(mapDodoStatus(sub, NOW)).toBe("canceled");
  });

  test("terminal statuses are canceled", () => {
    expect(mapDodoStatus(subscription({ status: "expired" }), NOW)).toBe("canceled");
    expect(mapDodoStatus(subscription({ status: "failed" }), NOW)).toBe("canceled");
  });

  test("recoverable payment failures are past_due, which is not an entitlement", () => {
    expect(mapDodoStatus(subscription({ status: "on_hold" }), NOW)).toBe("past_due");
    expect(mapDodoStatus(subscription({ status: "past_due" }), NOW)).toBe("past_due");
    expect(mapDodoStatus(subscription({ status: "paused" }), NOW)).toBe("past_due");
  });
});

// ── Product mapping ─────────────────────────────────────────────────────────

describe("planForProductId", () => {
  const saved = {
    starter: process.env.DODO_PRODUCT_ID_STARTER,
    pro: process.env.DODO_PRODUCT_ID_PRO,
    business: process.env.DODO_PRODUCT_ID_BUSINESS,
  };

  beforeEach(() => {
    process.env.DODO_PRODUCT_ID_STARTER = "pdt_starter";
    process.env.DODO_PRODUCT_ID_PRO = "pdt_pro";
    process.env.DODO_PRODUCT_ID_BUSINESS = "pdt_business";
  });

  afterEach(() => {
    for (const [key, value] of Object.entries({
      DODO_PRODUCT_ID_STARTER: saved.starter,
      DODO_PRODUCT_ID_PRO: saved.pro,
      DODO_PRODUCT_ID_BUSINESS: saved.business,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test("maps each configured product to its plan", () => {
    expect(planForProductId("pdt_starter")).toBe("starter");
    expect(planForProductId("pdt_pro")).toBe("pro");
    expect(planForProductId("pdt_business")).toBe("business");
  });

  test("round trips with productIdForPlan", () => {
    for (const plan of ["starter", "pro", "business"] as const) {
      expect(planForProductId(productIdForPlan(plan))).toBe(plan);
    }
  });

  test("an unknown product is undefined rather than a wrong plan", () => {
    expect(planForProductId("pdt_someone_elses")).toBeUndefined();
  });

  test("an empty product id never matches an unset plan variable", () => {
    // The map is built per call for exactly this reason: hoisting it would bake
    // an "" key in for any unset variable, and every product with no id would
    // then resolve to that plan.
    delete process.env.DODO_PRODUCT_ID_BUSINESS;
    expect(planForProductId("")).toBeUndefined();
    expect(planForProductId("pdt_business")).toBeUndefined();
    expect(planForProductId("pdt_pro")).toBe("pro");
  });

  test("productIdForPlan names the plan whose product is not configured", () => {
    delete process.env.DODO_PRODUCT_ID_PRO;
    expect(() => productIdForPlan("pro")).toThrow(
      /Dodo product ID not configured for plan: pro/
    );
  });
});
