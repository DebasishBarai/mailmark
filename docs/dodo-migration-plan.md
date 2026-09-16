# Migrating billing from Polar to Dodo Payments

Status: proposal, not yet implemented.
Scope: replace Polar.sh as merchant of record with Dodo Payments without
interrupting any live subscription, entitlement, quota window or affiliate
commission.

---

## 1. Executive summary

Polar touches nine places in this codebase and exactly one database concept:
the `subscriptions` row. Everything else in the product (send quotas, mailbox
limits, domain limits, the paywall modal, platform stats, affiliate payouts)
reads that row and never talks to Polar. That is the whole reason this
migration is tractable: **swap what writes the row, keep the row.**

The recommended approach is a strangler migration in six phases:

1. Fix the latent defects that a naive port would bake in permanently.
2. Add provider-agnostic columns to the schema. Additive only, nothing dropped.
3. Build a `BillingProvider` adapter with Polar and Dodo implementations.
4. Route new signups to Dodo behind a flag. Polar webhook stays live.
5. Move existing subscribers over (two routes, see section 8).
6. Decommission Polar after a 90 day quiet period.

At no point are Polar and Dodo mutually exclusive. Both webhooks run at once,
both can write the same `subscriptions` row, and the row itself records which
provider owns it. That property is what makes the migration reversible.

**The single most important line in this document:** `subscriptions.startedAt`
is the anchor for every user's monthly send allowance
(`convex/lib/period.ts` `periodStartDayKey`). If the migration re-inserts
subscription rows instead of patching them, every paying customer's quota
window silently moves and some of them get billed a month of sends they cannot
use. Preserve `startedAt` verbatim.

---

## 2. Current Polar surface, file by file

### Backend (Convex)

| # | Location | What it does |
|---|---|---|
| 1 | `convex/users.ts:95-124` | `addUser` action creates a Polar customer (`POST /v1/customers`) with `external_id` = Clerk subject, stores `polarCustomerId` on the user row. Blocking: a Polar failure means no user row is created at all. |
| 2 | `convex/subscriptions.ts:75-121` | `createCheckoutSession` action. `POST /v1/checkouts` with `product_price_id`, `customer_external_id`, `success_url`. Hard requires `user.polarCustomerId` (line 90). |
| 3 | `convex/subscriptions.ts:131-206` | `handlePolarSubscriptionEvent` internal mutation. Upserts the `subscriptions` row. Carries a stale-event guard keyed on `polarSubscriptionId`. |
| 4 | `convex/subscriptions.ts:245-282` | `cancelViaPolar` action. `DELETE /v1/subscriptions/{id}`, then writes status `canceled` locally. |
| 5 | `convex/http.ts:1876-1976` | The `/polar-webhook` HTTP route. Maps `POLAR_PRODUCT_ID_*` to plan names, derives status, calls #3, then drives affiliate commissions. |
| 6 | `convex/affiliates.ts:257-314` | `recordCommission` / `cancelCommission`, both keyed on `polarSubscriptionId`. |
| 7 | `convex/schema.ts:10,281,310,314` | `users.polarCustomerId`, `subscriptions.polarSubscriptionId`, `referrals.polarSubscriptionId` plus the `by_polarSubscriptionId` index. |

### Frontend

| # | Location | What it does |
|---|---|---|
| 8 | `app/(protected)/billing/page.tsx:91-92,110-116` | `useAction(api.subscriptions.createCheckoutSession)` and `cancelViaPolar`. Redirects with `window.location.href = url`. |
| 9 | `app/components/UpgradeModal.tsx:58,68` | Same checkout action. Footer text at line 187 reads "Secure checkout via Polar". |

### Content and tests

- `app/privacy/page.tsx:30,49,67` names Polar as processor and as an EU
  sub-processor. This is a legal disclosure and has to change on the same day
  the first real Dodo charge lands, not before and not after.
- `public/llms.txt:933,1114` names Polar in the payments stack.
- `app/components/Pricing.tsx` carries the trial copy that the Dodo trial
  configuration has to keep true.
- `tests/convexRouter.test.ts:29` asserts `/polar-webhook` routes to itself.

---

## 3. What must not break

This is the entitlement chain. Nothing in it knows what a payment provider is,
and nothing in it should learn.

```
subscriptions row { plan, status, startedAt }
  |
  +-- quotas.isEntitledStatus(status)        -> "active" | "trialing" are entitled
  +-- quotas.resolvePlan(...)                -> plan name or "free"
  +-- quotas.PLAN_LIMITS[plan]               -> domains / mailboxes / emails / recipients
  +-- lib/period.periodStartDayKey(startedAt)-> the monthly send window
  |
  +-- quotas.getUserLimits          (internal, used by send paths)
  +-- quotas.getUsageAndLimits      (billing page usage bars)
  +-- quotas.countSentEmailsThisPeriod
  +-- mailboxes.ts:152, mailboxes.ts:360     (mailbox creation gate)
  +-- lib/counters.subscriptionBuckets       (platform stats)
  +-- platformStats.ts:233,257               (nightly rebuild)
  +-- subscriptions.currentStatus            -> TrialGate + UpgradeModal paywall
```

Acceptance criterion for the whole migration: for every user, the tuple
`(plan, status, startedAt)` is identical before and after cutover, or changed
only in a direction that is strictly better for the customer.

---

## 4. Defects to fix before porting, not after

A straight port would copy each of these into the new integration and they get
much harder to fix once Dodo is the system of record.

### 4.1 Webhook signature verification is switched off

`convex/http.ts:1887-1892` logs a mismatch and then falls through. The `401`
return is commented out.

```ts
if (expectedSecret && webhookSecret !== expectedSecret && ...) {
  console.warn(`[polar-webhook] Signature mismatch. Received: ${webhookSecret}`);
  // Skip signature check for now to unblock webhooks, log for debugging
  // return new Response("Unauthorized", { status: 401 });
}
```

The endpoint is public and unauthenticated. Anyone who can guess the Convex
site URL can POST a `subscription.created` body with an arbitrary
`customer.external_id` and grant themselves a Business subscription, or POST
`subscription.canceled` and drop a paying customer to free tier limits.

The comparison was also never a real Standard Webhooks check: it compares the
`webhook-signature` header to the raw secret, but Standard Webhooks puts an
HMAC of `id.timestamp.body` in that header, so it could never have matched.
That is why it got disabled.

**Fix in the Dodo handler from day one.** Section 10 has working code. Convex's
default runtime exposes Web Crypto (`crypto.subtle`), so this needs no npm
dependency and no `"use node"` action.

### 4.2 `priceMonthly` disagrees with every price the product shows

`convex/subscriptions.ts:9-13` says starter 1000, pro 2500, business 7500
(that is $10 / $25 / $75). Every surface that quotes a price says
$10 / $50 / $100:

- `app/components/Pricing.tsx:7,26,45`
- `app/components/UpgradeModal.tsx:12,21,29`
- `app/(protected)/billing/page.tsx:13-17,23,40,57`
- `public/llms.txt:937-939`

`priceMonthly` is written on every subscription insert and patch and is read by
nothing today, so the damage is dormant. It stops being dormant the moment
anyone builds MRR reporting off it. Correct it to 1000 / 5000 / 10000 in the
same change that introduces the Dodo plan catalogue, and backfill existing rows.

### 4.3 Cancelling revokes access immediately

`cancelViaPolar` (`convex/subscriptions.ts:274-281`) calls `DELETE` on Polar and
then writes `status: "canceled"` locally. `isEntitledStatus` returns false for
`canceled`, so the user drops to free tier limits (1 domain, 3 mailboxes, 1,000
emails) the instant they click Cancel, despite having paid through the end of
the period. `convex/subscriptions.ts:208-242` (the `cancel` mutation) does the
same thing.

Dodo supports `cancel_at_next_billing_date: true`, which is the behaviour the
UI copy already implies ("Cancellations take effect at the end of the current
billing period", `public/llms.txt:930`). Adopt it, and keep the local row
`active` with a `cancelAtPeriodEnd: true` flag until the provider sends the
terminal event.

### 4.4 Signup is coupled to the payment provider's uptime

`addUser` (`convex/users.ts:95-111`) throws if the provider customer call
fails, so the Convex user row is never created and the person cannot use the
product at all. `app/(protected)/layout.tsx:168-171` swallows the error and
retries on the next visit, but the user sees a broken app until then.

Dodo does not require a pre-created customer: `POST /subscriptions` accepts
`customer: { email, name }` inline and returns a `customer_id`. **Create the
billing customer lazily at first checkout, not at signup.** This deletes a
network dependency from the signup path entirely.

### 4.5 `startedAt` is never refreshed, and that is load-bearing

`handlePolarSubscriptionEvent` sets `startedAt` only in the insert branch
(`convex/subscriptions.ts:199`), never in the patch branch. That is correct
today and must stay correct: `periodStartDayKey` derives the send allowance
window from it, so a user who upgrades keeps their original billing anchor.

The migration must not re-insert rows for existing subscribers. Patch them.

---

## 5. Target architecture

Introduce `convex/lib/billing/` and let the rest of the codebase stop knowing
who processes payments.

```
convex/lib/billing/
  types.ts     BillingProvider interface, ProviderStatus, PlanKey
  catalog.ts   plan -> { priceMonthly, trialDays, productIds } per provider
  polar.ts     existing REST calls, read-only after cutover
  dodo.ts      Dodo REST calls
  index.ts     getProvider(name) + getActiveProvider() from env
  webhooks.ts  Standard Webhooks HMAC verification (shared)
```

```ts
// convex/lib/billing/types.ts
export type PlanKey = "starter" | "pro" | "business";
export type LocalStatus = "active" | "trialing" | "canceled" | "past_due";

export interface CheckoutResult { url: string; providerSubscriptionId?: string }

export interface BillingProvider {
  readonly name: "polar" | "dodo";
  createCheckout(input: {
    plan: PlanKey;
    clerkId: string;
    email: string;
    name?: string;
    countryCode?: string;
    successUrl: string;
  }): Promise<CheckoutResult>;
  changePlan(input: { providerSubscriptionId: string; plan: PlanKey }): Promise<void>;
  cancel(input: { providerSubscriptionId: string; atPeriodEnd: boolean }): Promise<void>;
  portalUrl?(input: { providerCustomerId: string; returnUrl: string }): Promise<string>;
}
```

The Convex actions in `subscriptions.ts` become thin: resolve the provider for
this user, call the interface, return the URL. No `fetch` calls to a named
vendor anywhere above this layer.

---

## 6. Schema changes

All additive. Every new field optional. No existing field is removed in this
migration, so a rollback is a code deploy and nothing else.

```ts
// convex/schema.ts

users: defineTable({
  // ...
  polarCustomerId: v.optional(v.string()),        // kept, read-only after cutover
  // New:
  billingProvider: v.optional(v.union(v.literal("polar"), v.literal("dodo"))),
  dodoCustomerId: v.optional(v.string()),
}).index("by_clerk_id", ["clerkId"]),

subscriptions: defineTable({
  userId: v.id("users"),
  plan: v.union(v.literal("starter"), v.literal("pro"), v.literal("business")),
  status: v.union(
    v.literal("active"), v.literal("trialing"),
    v.literal("canceled"), v.literal("past_due")
  ),
  priceMonthly: v.number(),
  startedAt: v.number(),                          // DO NOT TOUCH on migration
  canceledAt: v.optional(v.number()),
  polarSubscriptionId: v.optional(v.string()),    // kept
  // New:
  provider: v.optional(v.union(v.literal("polar"), v.literal("dodo"))),
  providerSubscriptionId: v.optional(v.string()),
  currentPeriodEnd: v.optional(v.number()),       // real renewal date, see 7.2
  trialEndsAt: v.optional(v.number()),            // real trial end, see 7.2
  cancelAtPeriodEnd: v.optional(v.boolean()),     // fixes defect 4.3
  migratedFromPolarId: v.optional(v.string()),    // audit trail
})
  .index("by_user_id", ["userId"])
  .index("by_provider_subscription", ["providerSubscriptionId"]),  // new

referrals: defineTable({
  // ...
  polarSubscriptionId: v.optional(v.string()),    // kept
  providerSubscriptionId: v.optional(v.string()), // new
})
  .index("by_polarSubscriptionId", ["polarSubscriptionId"])
  .index("by_providerSubscriptionId", ["providerSubscriptionId"]),  // new
```

Treat `provider === undefined` as `"polar"` everywhere during the transition.
That is what makes the deploy safe with zero backfill: existing rows read
correctly on the first request after the new code ships.

---

## 7. Mapping Polar concepts to Dodo

### 7.1 API calls

| Operation | Polar (today) | Dodo |
|---|---|---|
| Base URL | `POLAR_BASE_URL` | `https://test.dodopayments.com` / `https://live.dodopayments.com` |
| Auth | `Authorization: Bearer POLAR_ACCESS_TOKEN` | `Authorization: Bearer DODO_API_KEY` |
| Create customer | `POST /v1/customers` with `external_id` | not needed up front. Pass `customer: { email, name }` to the subscription call and keep the returned `customer_id`. |
| Start checkout | `POST /v1/checkouts` `{ product_price_id, customer_external_id, success_url }` | `POST /subscriptions` `{ product_id, quantity: 1, customer, billing: { country }, trial_period_days, return_url, metadata, payment_link: true }` returns `payment_link` |
| Change plan | not supported, user re-checks-out | `POST /subscriptions/{id}/change-plan` `{ product_id, proration_billing_mode, quantity }` |
| Cancel | `DELETE /v1/subscriptions/{id}` (immediate) | `PATCH /subscriptions/{id}` `{ cancel_at_next_billing_date: true }` |
| Self-serve billing | none | `POST /customers/{customer_id}/customer-portal/session` |

Two behavioural differences that matter:

- **Dodo keeps the same `subscription_id` across a plan change.** Polar cancels
  the old subscription and issues a new one, which is exactly why the stale
  event guard at `convex/subscriptions.ts:158-172` exists. Keep the guard (it
  is still correct, the IDs simply always match now) but add the change-plan
  path so an existing subscriber upgrading does not get sent through a second
  checkout and a second mandate.
- **Dodo locks the billing currency after the first successful charge**, and has
  a $1 minimum charge. Both are fine at $10 / $50 / $100 USD, but it means the
  `billing.country` sent at subscription creation is not a cosmetic field.

### 7.2 Statuses

Dodo has six statuses, the schema has four, and the names are not spelled the
same (`cancelled` vs `canceled`).

| Dodo | Local | Entitled? | Notes |
|---|---|---|---|
| `pending` | do not write | n/a | pre-authorization, wait for `active` |
| `active` | `active` or `trialing` | yes | see the trial note below |
| `on_hold` | `past_due` | no | renewal failed, recoverable via payment method update |
| `cancelled` | `canceled` | no | still entitled until `currentPeriodEnd` if `cancelAtPeriodEnd` |
| `expired` | `canceled` | no | term ended, not recoverable |
| `failed` | `canceled` | no | mandate creation failed, not recoverable |

**There is no `trialing` status in Dodo.** A subscription inside its
`trial_period_days` reports `active`. Three things depend on `trialing` today:

- `quotas.isEntitledStatus` (returns true for both, so no behaviour change)
- `lib/counters.subscriptionBuckets` (counts both, so no change)
- `app/(protected)/billing/page.tsx:173-177`, which renders "Trial ends
  {startedAt + 7 days}" and an amber badge

So derive it. Store the real trial end in the new `trialEndsAt` column from
the Dodo payload and compute `status: Date.now() < trialEndsAt ? "trialing" : "active"`.
That is also more correct than what ships today, which hardcodes seven days off
`startedAt` in the UI rather than reading the provider.

### 7.3 Webhook events

| Polar event (handled today) | Dodo equivalent |
|---|---|
| `subscription.created` | `subscription.active` (after mandate), `subscription.failed` on mandate failure |
| `subscription.active` | `subscription.active` |
| `subscription.updated` | `subscription.updated`, `subscription.renewed`, `subscription.plan_changed` |
| `subscription.canceled` | `subscription.cancelled`, `subscription.expired` |
| (none) | `subscription.on_hold` -> `past_due`. New capability: today a failed renewal is invisible. |
| (none) | `payment.succeeded` / `payment.failed`. Useful for dunning email. |

Note that `subscription.renewed` arrives alongside `payment.succeeded` whenever
money actually moves. Use `subscription.renewed` to advance `currentPeriodEnd`
and ignore `payment.succeeded` for entitlement purposes.

---

## 8. The hard part: existing subscribers

New signups are easy. Live subscribers have a payment mandate with Polar as the
merchant of record, and that mandate does not automatically become a Dodo
mandate. There are two routes.

### Route A: assisted card token migration (Dodo runs this)

Dodo has a documented migration programme
(`docs.dodopayments.com/miscellaneous/subscription-migration`). Shape of it:

1. **Prerequisite:** Polar must be PCI DSS Level 1 with a current Attestation of
   Compliance, and must agree to export card tokens. Dodo provides a PGP public
   key and SFTP credentials; Polar transfers the encrypted export server to
   server. **Mailmark never touches card data.**
2. **Subscriber CSV** from our side, one row per live subscription:
   `customer_id, email, name, country, currency, payment_amount,
   payment_interval, next_billing_date, card_token`. The `card_token` value must
   match Polar's export exactly, because that is the join key.
3. Dodo validates in test mode, imports to production, and returns a CSV
   mapping old subscription IDs to new Dodo subscription IDs.
4. We backfill `providerSubscriptionId` from that mapping and flip
   `provider` to `"dodo"`.

Timeline is roughly 3 to 4 weeks end to end, most of it waiting on the card
token transfer.

**Risks, stated plainly:**

- *Polar may simply decline.* As the outgoing merchant of record, the mandate
  was established with Polar as the legal seller, and MoRs are not obliged to
  hand over tokens. **Get this in writing from Polar before scheduling
  anything else in this plan.** If the answer is no, Route A is dead and Route
  B is the only option.
- Wallet payment methods (Apple Pay, Google Pay) cannot be transferred at all.
  Those subscribers need Route B regardless of Polar's answer.
- Even with tokens transferred, EU and UK cards may need SCA re-authorization
  because the merchant of record on the mandate changed. Expect some
  involuntary churn concentrated in the EU, which is where Polar's customers
  skew (`app/privacy/page.tsx:67` names Polar as an EU entity).
- Payment history does not transfer. Export invoices from Polar separately and
  keep them for tax and support purposes before closing the account.

### Route B: self-serve re-subscribe with a grace period

1. Ship Dodo checkout. Every new signup goes to Dodo.
2. Add a non-blocking banner for users whose `provider` is `polar`:
   "We are moving to a new payment processor. Move your subscription now and
   keep your plan, no charge until your current period ends." Include a
   discount code covering any overlap so nobody double-pays.
3. On click: create the Dodo subscription with
   `trial_period_days` set to the days remaining until `currentPeriodEnd`, so
   the first Dodo charge lands exactly when the Polar one would have.
4. On `subscription.active` from Dodo for a user who still has a live Polar
   subscription, cancel the Polar one at period end via the API and **patch**
   the existing row (`provider: "dodo"`, new `providerSubscriptionId`,
   `migratedFromPolarId` set, `startedAt` untouched).
5. Chase the stragglers by email at day 14, day 30 and day 45. At day 60 the
   banner becomes modal but still does not revoke access. Never let a billing
   migration cause a working account to stop sending mail.

**Route B is slower in calendar time but has zero third-party dependency and
zero PCI surface.** It also fixes the mandate and SCA problem by construction,
because every customer establishes a fresh mandate with Dodo.

### Which route

Run `bunx convex run --prod` against the subscriptions table and count rows with
`status in ("active","trialing")` before deciding. Rough guidance:

- **Under ~200 live subscribers:** Route B. The 3 to 4 weeks and the
  coordination cost of Route A are not worth it, and conversion on a
  well-written re-subscribe flow with a covering discount is high.
- **Over ~500:** Route A, with Route B as the fallback for wallet payers and
  anyone the import cannot match.
- **In between:** ask Polar the export question first. Their answer decides it.

Either way, **start the Polar conversation now**, because it is the longest
pole and it gates nothing else in the plan.

---

## 9. Phased execution

### Phase 0: decide and prepare (no code)

- [ ] Count live subscribers and their countries and payment method types.
- [ ] Email Polar: will they export card tokens to Dodo, and do they have a
      current PCI DSS Level 1 AoC? Get a written answer.
- [ ] Email support@dodopayments.com to open a migration thread and get a
      Solutions Engineer assigned, even if Route B looks likely.
- [ ] Export all Polar invoices and payment history for tax records.
- [ ] Create the Dodo account, business profile and tax registrations.
- [ ] Create three products in Dodo test mode: Starter $10/mo, Pro $50/mo,
      Business $100/mo. Starter and Pro with `trial_period_days: 7`, Business
      with none, matching `app/components/Pricing.tsx`.

### Phase 1: fix the latent defects (ship independently, before any Dodo code)

- [ ] Implement real Standard Webhooks verification and turn it on for
      `/polar-webhook`. Section 10 code, Polar uses the same spec.
- [ ] Correct `PLANS` in `convex/subscriptions.ts` to 1000 / 5000 / 10000 and
      write a one-off `internalMutation` to backfill `priceMonthly` on existing
      rows.
- [ ] Add `cancelAtPeriodEnd` handling so cancelling stops revoking access
      mid-period.

These are independently valuable and independently revertible. Shipping them
first means the Dodo work is a clean port rather than a port plus three fixes.

### Phase 2: schema and abstraction (no behaviour change)

- [ ] Land the schema additions from section 6. Convex applies optional field
      additions without downtime.
- [ ] Create `convex/lib/billing/` with `types.ts`, `catalog.ts`, `polar.ts`,
      `index.ts`. Move the existing Polar `fetch` calls into `polar.ts`
      unchanged.
- [ ] Rewrite `createCheckoutSession` and `cancelViaPolar` to go through
      `getProvider()`. Behaviour identical, Polar still the only provider.
- [ ] Rename `handlePolarSubscriptionEvent` to `handleSubscriptionEvent` and
      add `provider` plus `providerSubscriptionId` args. Keep writing
      `polarSubscriptionId` too, for rollback.
- [ ] Deploy. Nothing user-visible changes. This is the checkpoint: if anything
      regresses here, it is the abstraction, not Dodo.

### Phase 3: Dodo adapter, dark

- [ ] Implement `convex/lib/billing/dodo.ts`.
- [ ] Add the `/dodo-webhook` route to `convex/http.ts` with verification on
      from the first line. Add its assertion to `tests/convexRouter.test.ts`
      alongside the existing `/polar-webhook` one.
- [ ] Point Dodo test mode at the dev Convex deployment and run the full
      lifecycle: trial start, trial to active conversion, renewal, plan change
      up, plan change down, failed renewal to `on_hold` to recovery, cancel at
      period end, expiry.
- [ ] Verify after each one that `subscriptions` holds the right
      `(plan, status, startedAt)` and that `quotas.getUsageAndLimits` returns
      the right limits.

### Phase 4: new signups to Dodo

- [ ] Add `BILLING_PROVIDER=dodo` to the Convex production environment.
      `getActiveProvider()` reads it and only affects users with no existing
      subscription.
- [ ] Remove the Polar customer creation from `addUser` (defect 4.4). Keep
      `polarCustomerId` on the schema and stop writing it.
- [ ] Update `app/components/UpgradeModal.tsx:187` footer text. Suggested
      wording: "Secure checkout - Cancel anytime - All prices in USD", which
      avoids naming a processor and therefore avoids needing another change
      later.
- [ ] Watch for one full week. Success criteria: checkout conversion within 10%
      of the Polar baseline, zero unverified webhooks in the logs, zero
      entitlement mismatches.

### Phase 5: move existing subscribers

Route A or Route B per section 8. In both cases the database write is the same
and it is a **patch, never an insert**:

```ts
await ctx.db.patch(existing._id, {
  provider: "dodo",
  providerSubscriptionId: dodoSubscriptionId,
  migratedFromPolarId: existing.polarSubscriptionId,
  currentPeriodEnd,
  // startedAt: deliberately NOT patched. It anchors the send allowance window
  // in lib/period.periodStartDayKey, and moving it would move every migrated
  // user's quota reset date.
});
```

Also backfill `referrals.providerSubscriptionId` in the same pass, or affiliate
commissions for migrated subscribers will never cancel correctly
(`convex/affiliates.ts:292-299` looks up by `polarSubscriptionId`).

- [ ] Write a dry-run mode first. Log every intended patch, change nothing,
      diff the output against the Polar dashboard by hand.

### Phase 6: decommission

Not before **90 days** after the last subscriber moves. Polar can still send
late events (refunds, chargebacks, disputes) and the handler needs to be there
to receive them.

- [ ] Confirm zero `subscriptions` rows with `provider` unset or `"polar"` and
      a live status.
- [ ] Update `app/privacy/page.tsx:30,49,67` and `public/llms.txt:933,1114`.
      **The privacy page is a legal disclosure. It must change on the day the
      first real Dodo charge lands, not at the end of Phase 6.** Pull this task
      forward to Phase 4.
- [ ] Remove `/polar-webhook`, `polar.ts`, the `POLAR_*` env vars and the
      `polarSubscriptionId` / `polarCustomerId` fields. Per the repo convention
      in `CLAUDE.md`, comment the old code out rather than deleting it.
- [ ] Close the Polar account only after final payout and after tax documents
      for the year are downloaded.

---

## 10. Webhook handler

Convex's default runtime has Web Crypto, so this needs no dependency and no
`"use node"`.

```ts
// convex/lib/billing/webhooks.ts

/** Constant-time string compare. Avoids leaking the signature via timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * Standard Webhooks verification, as used by both Dodo and Polar.
 * The signed content is `${id}.${timestamp}.${rawBody}` and the header carries
 * one or more space separated `v1,<base64 hmac>` entries, so a secret rotation
 * in progress still verifies.
 */
export async function verifyStandardWebhook(opts: {
  secret: string;        // whsec_<base64>
  webhookId: string;
  webhookTimestamp: string;
  webhookSignature: string;
  rawBody: string;
}): Promise<boolean> {
  const ts = Number(opts.webhookTimestamp) * 1000;
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > FIVE_MINUTES) return false;

  const b64 = opts.secret.startsWith("whsec_") ? opts.secret.slice(6) : opts.secret;
  const keyBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signed = `${opts.webhookId}.${opts.webhookTimestamp}.${opts.rawBody}`;
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  return opts.webhookSignature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    return version === "v1" && sig !== undefined && timingSafeEqual(sig, expected);
  });
}
```

Handler shape. Two points worth calling out: the body must be read **once** as
text and reused, because re-reading it for `json()` after `text()` is not
possible and re-serializing it would break the HMAC; and `webhook-id` gives
idempotency for free, which the Polar handler never had.

```ts
// convex/http.ts

http.route({
  path: "/dodo-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();   // read once, verify against this exact string

    const webhookId = request.headers.get("webhook-id");
    const webhookTimestamp = request.headers.get("webhook-timestamp");
    const webhookSignature = request.headers.get("webhook-signature");
    const secret = process.env.DODO_WEBHOOK_SECRET;

    if (!secret || !webhookId || !webhookTimestamp || !webhookSignature) {
      return new Response("Unauthorized", { status: 401 });
    }
    const ok = await verifyStandardWebhook({
      secret, webhookId, webhookTimestamp, webhookSignature, rawBody,
    });
    // Unlike the Polar handler, this one actually rejects. See defect 4.1.
    if (!ok) return new Response("Unauthorized", { status: 401 });

    // webhook-id is stable across Dodo's retries, so a replay is a no-op.
    const fresh = await ctx.runMutation(internal.webhookEvents.claim, {
      provider: "dodo", eventId: webhookId,
    });
    if (!fresh) return new Response(JSON.stringify({ received: true }), { status: 200 });

    // ... parse rawBody, map product_id -> plan, map status, dispatch ...

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  }),
});
```

The idempotency claim needs a small table:

```ts
webhookEvents: defineTable({
  provider: v.union(v.literal("polar"), v.literal("dodo")),
  eventId: v.string(),
  receivedAt: v.number(),
}).index("by_provider_event", ["provider", "eventId"]),
```

Add a cron to `convex/crons.ts` to prune rows older than 30 days.

---

## 11. Environment variables

| Variable | Where | Action |
|---|---|---|
| `POLAR_BASE_URL` | Convex | keep until Phase 6 |
| `POLAR_ACCESS_TOKEN` | Convex | keep until Phase 6 |
| `POLAR_WEBHOOK_SECRET` | Convex | keep, and make it actually enforce in Phase 1 |
| `POLAR_PRICE_ID_{STARTER,PRO,BUSINESS}` | Convex | keep until Phase 6 |
| `POLAR_PRODUCT_ID_{STARTER,PRO,BUSINESS}` | Convex | keep until Phase 6 |
| `DODO_API_KEY` | Convex | new |
| `DODO_BASE_URL` | Convex | new, `https://test.dodopayments.com` then `https://live.dodopayments.com` |
| `DODO_WEBHOOK_SECRET` | Convex | new |
| `DODO_PRODUCT_ID_{STARTER,PRO,BUSINESS}` | Convex | new |
| `BILLING_PROVIDER` | Convex | new, `polar` then `dodo`. The single flag that flips new signups. |
| `APP_URL` | Convex | unchanged, used for `return_url` |

Set these with `bunx convex env set NAME value` against dev first, then prod.

---

## 12. Test plan

Unit (`bun test`, the existing `tests/` suite):

- [ ] `tests/convexRouter.test.ts`: assert `/dodo-webhook` routes to itself.
- [ ] New `tests/webhookSignature.test.ts`: valid signature passes; tampered
      body fails; expired timestamp fails; multi-signature header during
      rotation passes; malformed header fails closed.
- [ ] New `tests/statusMapping.test.ts`: every Dodo status maps to the intended
      local status, and `trialing` derives correctly from `trialEndsAt` at the
      boundary.
- [ ] Extend `tests/billingPeriod.test.ts`: `periodStartDayKey` is unchanged
      for a subscription whose `provider` flipped but whose `startedAt` did not.

Integration, against Dodo test mode:

- [ ] Signup to trial to active to renewal.
- [ ] Upgrade Starter to Pro mid-period. Assert `startedAt` unchanged, plan
      changed, and `subscriptionBuckets` moved the row from the starter counter
      to the pro counter exactly once.
- [ ] Downgrade Pro to Starter.
- [ ] Failed renewal to `on_hold`. Assert limits drop to free tier and the
      paywall modal appears with `upgradeReason: "subscription_ended"`.
- [ ] Recover from `on_hold` via payment method update.
- [ ] Cancel. Assert access **survives** to `currentPeriodEnd` (defect 4.3).
- [ ] Affiliate: referred signup, commission recorded, cancel, commission
      reversed, `affiliates.activeReferrals` back to its prior value.
- [ ] Replay the same webhook three times. Assert exactly one state change.

Manual:

- [ ] `bun run build` and `bun run lint` clean.
- [ ] Billing page renders correctly for: no subscription, trialing, active,
      past_due, canceled-but-still-in-period.

---

## 13. Rollback

Each phase is independently revertible because nothing is destructive until
Phase 6.

| Phase | Rollback |
|---|---|
| 1 | Revert the commit. Webhook verification returns to permissive. |
| 2 | Revert the commit. Schema keeps the unused optional fields, which is harmless. |
| 3 | Nothing is live. Remove the route. |
| 4 | Set `BILLING_PROVIDER=polar`. New signups return to Polar within one deploy. Subscribers already on Dodo keep working, because `provider` is per row. |
| 5 | Per-user. `provider` is a column, so a single subscriber can be moved back by patching one row and re-enabling their Polar subscription. |
| 6 | Not revertible. That is why it waits 90 days. |

---

## 14. Open questions

1. **Will Polar export card tokens to Dodo?** Gates the entire choice between
   Route A and Route B. Ask first, ask in writing.
2. **How many live subscribers, and where are they?** Decides the route and
   sizes the SCA churn risk.
3. **Any wallet (Apple Pay / Google Pay) payers?** Those cannot transfer under
   any circumstances and need Route B regardless.
4. **Is the intended Pro price $25 or $50?** Section 4.2. Every UI says $50,
   the code says $25. The code is almost certainly stale, but confirm before
   backfilling `priceMonthly`.
5. **Should Business get a trial?** `Pricing.tsx` says no, and the Dodo product
   needs to be configured to match.

---

## 15. Sources

- Dodo create subscription: https://docs.dodopayments.com/api-reference/subscriptions/post-subscriptions
- Dodo webhooks and Standard Webhooks signing: https://docs.dodopayments.com/developer-resources/webhooks
- Dodo subscription integration guide and statuses: https://docs.dodopayments.com/developer-resources/subscription-integration-guide
- Dodo subscription migration programme: https://docs.dodopayments.com/miscellaneous/subscription-migration
- Dodo change plan and proration: https://docs.dodopayments.com/api-reference/subscriptions/change-plan
- Dodo customer portal session: https://docs.dodopayments.com/api-reference/customers/create-customer-portal-session
- Convex runtime web API support: https://docs.convex.dev/functions/runtimes
