/**
 * Dodo Payments client and payload mapping.
 *
 * Replaces the Polar.sh integration. Kept free of any Convex import above the
 * type level so the pure parts (status mapping, signature verification) are
 * plain, testable functions, in the same spirit as lib/period.ts.
 *
 * Everything here runs in Convex's default runtime, which ships Web Crypto,
 * fetch, TextEncoder and atob/btoa. No npm dependency and no "use node", so
 * the webhook stays an httpAction rather than becoming a Node action.
 */

export type PlanKey = "starter" | "pro" | "business";

/** The four statuses the subscriptions table has always stored. */
export type LocalStatus = "active" | "trialing" | "canceled" | "past_due";

/**
 * The subset of Dodo's Subscription object this codebase reads. Dodo sends the
 * whole object as `data` on every subscription.* webhook, and returns it from
 * GET/PATCH /subscriptions/{id}.
 */
export type DodoSubscription = {
  subscription_id: string;
  status: string;
  product_id: string;
  metadata?: Record<string, string> | null;
  customer?: { customer_id?: string; email?: string; name?: string } | null;
  created_at?: string | null;
  next_billing_date?: string | null;
  previous_billing_date?: string | null;
  trial_period_days?: number | null;
  cancel_at_next_billing_date?: boolean | null;
  cancelled_at?: string | null;
  recurring_pre_tax_amount?: number | null;
  currency?: string | null;
};

// ─── Config ──────────────────────────────────────────────────────────────────

/** Trailing slashes are stripped so `${base}/subscriptions` cannot double up. */
function baseUrl(): string {
  const raw = process.env.DODO_BASE_URL;
  if (!raw) throw new Error("DODO_BASE_URL is not configured");
  return raw.replace(/\/+$/, "");
}

function apiKey(): string {
  const key = process.env.DODO_API_KEY;
  if (!key) throw new Error("DODO_API_KEY is not configured");
  return key;
}

/** plan -> Dodo product id, from env. Mirrors the old POLAR_PRODUCT_ID_* map. */
export function productIdForPlan(plan: PlanKey): string {
  const map: Record<PlanKey, string | undefined> = {
    starter: process.env.DODO_PRODUCT_ID_STARTER,
    pro: process.env.DODO_PRODUCT_ID_PRO,
    business: process.env.DODO_PRODUCT_ID_BUSINESS,
  };
  const productId = map[plan];
  if (!productId) throw new Error(`Dodo product ID not configured for plan: ${plan}`);
  return productId;
}

/**
 * Dodo product id -> plan. Returns undefined for a product this deployment
 * does not know about, which the webhook treats as "not ours, ignore".
 *
 * Built fresh per call rather than hoisted to a module constant, because
 * process.env is read at module load in Convex and a missing var would bake an
 * "" key into the map that then matches every product with no id.
 */
export function planForProductId(productId: string): PlanKey | undefined {
  if (!productId) return undefined;
  const pairs: Array<[string | undefined, PlanKey]> = [
    [process.env.DODO_PRODUCT_ID_STARTER, "starter"],
    [process.env.DODO_PRODUCT_ID_PRO, "pro"],
    [process.env.DODO_PRODUCT_ID_BUSINESS, "business"],
  ];
  for (const [id, plan] of pairs) {
    if (id && id === productId) return plan;
  }
  return undefined;
}

/** Starter and Pro carry a 7 day trial, Business does not. See Pricing.tsx. */
export function trialDaysForPlan(plan: PlanKey): number | undefined {
  return plan === "business" ? undefined : 7;
}

// ─── Payload mapping ─────────────────────────────────────────────────────────

/** An ISO 8601 string to epoch ms, or undefined if absent or unparseable. */
export function parseIsoMs(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

/**
 * When this subscription's trial ends, or undefined if it never had one.
 *
 * Dodo has no "trialing" status: a subscription inside its trial reports
 * "active" and carries trial_period_days. The subscriptions table has always
 * stored "trialing" separately, and quotas.isEntitledStatus, the billing page
 * badge and lib/counters.subscriptionBuckets all read it, so it is derived
 * here from the provider's own numbers rather than guessed.
 *
 * Old behaviour: the billing page hardcoded startedAt + 7 days. That was wrong
 * for any trial length other than seven days and for Business, which has none.
 */
export function trialEndsAtOf(sub: DodoSubscription): number | undefined {
  const days = sub.trial_period_days ?? 0;
  if (days <= 0) return undefined;
  const createdAt = parseIsoMs(sub.created_at);
  if (createdAt === undefined) return undefined;
  return createdAt + days * 24 * 60 * 60 * 1000;
}

/**
 * Dodo status -> local status, or null for "do not write anything".
 *
 * Dodo's statuses are pending | active | on_hold | paused | cancelled | failed
 * | expired | past_due. Note the spelling: Dodo says "cancelled", this schema
 * has always said "canceled".
 *
 * The cancelled branch deliberately keeps a customer entitled. Cancelling
 * through this app sets cancel_at_next_billing_date, so the customer has paid
 * through next_billing_date and the product promises they keep it ("
 * Cancellations take effect at the end of the current billing period",
 * public/llms.txt). Revoking on the cancel event would drop a paid-up customer
 * to free tier limits mid-period, which is what the Polar integration did.
 */
export function mapDodoStatus(
  sub: DodoSubscription,
  now: number = Date.now()
): LocalStatus | null {
  const entitled = (): LocalStatus => {
    const trialEndsAt = trialEndsAtOf(sub);
    return trialEndsAt !== undefined && now < trialEndsAt ? "trialing" : "active";
  };

  switch (sub.status) {
    case "pending":
      // Pre-authorization. No mandate yet, so nothing is owed and nothing is
      // granted. Wait for subscription.active.
      return null;
    case "active":
      return entitled();
    case "cancelled": {
      const nextBilling = parseIsoMs(sub.next_billing_date);
      const paidThrough =
        sub.cancel_at_next_billing_date === true &&
        nextBilling !== undefined &&
        now < nextBilling;
      return paidThrough ? entitled() : "canceled";
    }
    case "expired":
    case "failed":
      // expired: term ended without renewal. failed: mandate creation failed.
      // Both are terminal and neither is recoverable.
      return "canceled";
    case "on_hold":
    case "past_due":
      // A renewal payment failed. Recoverable by updating the payment method,
      // so it is not "canceled", but it is not an entitlement either:
      // quotas.isEntitledStatus deliberately excludes past_due.
      return "past_due";
    case "paused":
      // Merchant-initiated pause. Nothing in this app calls pause, so this is
      // only reachable from the Dodo dashboard. Treated as not entitled.
      return "past_due";
    default:
      return null;
  }
}

// ─── REST calls ──────────────────────────────────────────────────────────────

async function dodoFetch(
  path: string,
  init: { method: string; body?: unknown }
): Promise<unknown> {
  const response = await fetch(`${baseUrl()}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Dodo ${init.method} ${path} failed (${response.status}): ${errorText}`);
  }

  // PATCH /subscriptions/{id} and some others answer 200 with an empty body.
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

/**
 * Hosted checkout for a plan. The direct replacement for Polar's
 * POST /v1/checkouts.
 *
 * POST /checkouts rather than POST /subscriptions with payment_link, because
 * the subscriptions endpoint requires billing.country and this app has never
 * collected a country from anyone. On a checkout session billing_address is
 * optional and Dodo's hosted page asks for it, which is exactly what Polar's
 * checkout did.
 *
 * clerkId travels in metadata. That is what the webhook matches on, in place
 * of Polar's customer.external_id.
 */
export async function createCheckout(input: {
  plan: PlanKey;
  clerkId: string;
  email?: string;
  name?: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const trialDays = trialDaysForPlan(input.plan);

  const body: Record<string, unknown> = {
    product_cart: [{ product_id: productIdForPlan(input.plan), quantity: 1 }],
    return_url: input.returnUrl,
    metadata: { clerkId: input.clerkId, plan: input.plan },
  };
  // Prefill the buyer's details when Clerk has them. Omitted rather than sent
  // empty, because Dodo validates email format on the NewCustomer shape.
  if (input.email) {
    body.customer = { email: input.email, name: input.name || "Anonymous" };
  }
  if (trialDays !== undefined) {
    body.subscription_data = { trial_period_days: trialDays };
  }

  const session = (await dodoFetch("/checkouts", { method: "POST", body })) as {
    checkout_url?: string | null;
  };

  if (!session.checkout_url) {
    throw new Error("Dodo checkout session did not return a checkout_url");
  }
  return { url: session.checkout_url };
}

/**
 * Move an existing subscription to a different plan, keeping the same
 * subscription id and the same billing anchor.
 *
 * This has no Polar equivalent: on Polar a plan change meant a second
 * checkout, and Polar cancelled the old subscription itself. Dodo does not, so
 * sending an existing subscriber back through checkout would leave them with
 * two live subscriptions and two charges.
 *
 * prorated_immediately bills the difference now and moves next_billing_date to
 * today. On a downgrade Dodo credits the difference to the subscription's
 * balance instead of refunding it.
 */
export async function changePlan(input: {
  dodoSubscriptionId: string;
  plan: PlanKey;
}): Promise<void> {
  await dodoFetch(`/subscriptions/${input.dodoSubscriptionId}/change-plan`, {
    method: "POST",
    body: {
      product_id: productIdForPlan(input.plan),
      proration_billing_mode: "prorated_immediately",
      quantity: 1,
    },
  });
}

/**
 * Cancel at the end of the paid period.
 *
 * Old behaviour (cancelViaPolar): DELETE /v1/subscriptions/{id}, which ended
 * the subscription there and then and immediately dropped the customer to free
 * tier limits despite them having paid for the rest of the month.
 */
export async function cancelAtPeriodEnd(input: {
  dodoSubscriptionId: string;
}): Promise<DodoSubscription> {
  return (await dodoFetch(`/subscriptions/${input.dodoSubscriptionId}`, {
    method: "PATCH",
    body: { cancel_at_next_billing_date: true, cancel_reason: "cancelled_by_customer" },
  })) as DodoSubscription;
}

/** Read a subscription back. Used by the one-shot relink tool. */
export async function getSubscription(
  dodoSubscriptionId: string
): Promise<DodoSubscription> {
  return (await dodoFetch(`/subscriptions/${dodoSubscriptionId}`, {
    method: "GET",
  })) as DodoSubscription;
}

// ─── Webhook signature ───────────────────────────────────────────────────────

/** Length-independent compare, so a mismatch leaks nothing through timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** How far a webhook-timestamp may be from now before it is treated as a replay. */
export const WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Standard Webhooks verification, which is what Dodo signs with.
 *
 * The signed content is `${id}.${timestamp}.${rawBody}` and webhook-signature
 * carries one or more space separated `v1,<base64 hmac>` entries. Accepting any
 * of them is what lets a secret rotation (Dodo keeps the old secret valid for
 * 24 hours) verify from both sides.
 *
 * The raw body string must be the exact bytes that were signed. Re-serializing
 * a parsed object would reorder or reformat it and never match, so callers read
 * request.text() once and pass that through.
 *
 * Old behaviour, in the Polar handler: it compared the webhook-signature header
 * to the raw shared secret, which could not match a Standard Webhooks signature
 * under any circumstances. That is why the 401 was commented out and the
 * endpoint accepted every unsigned POST, letting anyone grant themselves a
 * subscription or cancel someone else's.
 */
export async function verifyWebhookSignature(opts: {
  secret: string;
  webhookId: string;
  webhookTimestamp: string;
  webhookSignature: string;
  rawBody: string;
  now?: number;
}): Promise<boolean> {
  const now = opts.now ?? Date.now();

  const timestampMs = Number(opts.webhookTimestamp) * 1000;
  if (!Number.isFinite(timestampMs)) return false;
  if (Math.abs(now - timestampMs) > WEBHOOK_TOLERANCE_MS) return false;

  // Standard Webhooks secrets are base64, conventionally prefixed "whsec_".
  const encoded = opts.secret.startsWith("whsec_") ? opts.secret.slice(6) : opts.secret;
  let keyBytes: Uint8Array<ArrayBuffer>;
  try {
    const binary = atob(encoded);
    // Allocated rather than derived with Uint8Array.from, so the view is backed
    // by a plain ArrayBuffer. importKey's BufferSource will not accept the
    // ArrayBufferLike that from() produces.
    keyBytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i++) keyBytes[i] = binary.charCodeAt(i);
  } catch {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signedContent = `${opts.webhookId}.${opts.webhookTimestamp}.${opts.rawBody}`;
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedContent)
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  return opts.webhookSignature
    .split(" ")
    .some((entry) => {
      const [version, signature] = entry.split(",");
      return version === "v1" && !!signature && timingSafeEqual(signature, expected);
    });
}
