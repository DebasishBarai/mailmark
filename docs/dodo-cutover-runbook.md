# Dodo Payments cutover runbook

The code change is done. This is the order to deploy it in, and the one manual
step that moves the single existing paying customer.

Read the whole thing before starting. Step 4 is the only one that is hard to
undo, and it happens after the customer is already safe.

---

## 0. What actually changed

| Was | Now |
|---|---|
| `POST /v1/customers` on signup, blocking | nothing. The customer is created at checkout. |
| `POST /v1/checkouts` | `POST /checkouts` (Dodo checkout session) |
| second checkout for a plan change | `POST /subscriptions/{id}/change-plan` |
| `DELETE /v1/subscriptions/{id}`, access revoked at once | `PATCH /subscriptions/{id}` with `cancel_at_next_billing_date`, access kept to period end |
| `/polar-webhook`, signature check disabled | `/dodo-webhook`, Standard Webhooks HMAC enforced |
| no idempotency | `webhookEvents` table, keyed on `webhook-id` |
| `customer.external_id` identified the user | `metadata.clerkId` identifies the user |

Entitlement is untouched. `quotas.ts`, `mailboxes.ts`, `lib/counters.ts` and
`lib/period.ts` never learned what a payment provider is, and still have not.

---

## 1. Create the products in Dodo

Test mode first, then repeat in live mode. The ids differ between modes.

| Plan | Price | Trial | Env var |
|---|---|---|---|
| Starter | $10 / month | 7 days | `DODO_PRODUCT_ID_STARTER` |
| Pro | $50 / month | 7 days | `DODO_PRODUCT_ID_PRO` |
| Business | $100 / month | none | `DODO_PRODUCT_ID_BUSINESS` |

The trial length is sent per checkout from `lib/billing.trialDaysForPlan`, so
the product itself does not need one configured. Prices must match: they are
what `Pricing.tsx`, `UpgradeModal.tsx`, `billing/page.tsx` and `llms.txt` quote,
and what `subscriptions.PLANS` now records as `priceMonthly`.

## 2. Set the environment variables

On the Convex **dev** deployment first:

```bash
bunx convex env set DODO_PAYMENTS_BASE_URL       https://test.dodopayments.com
bunx convex env set DODO_PAYMENTS_API_KEY        <test api key>
bunx convex env set DODO_PAYMENTS_WEBHOOK_KEY <test signing secret>
bunx convex env set DODO_PRODUCT_ID_STARTER  <test product id>
bunx convex env set DODO_PRODUCT_ID_PRO      <test product id>
bunx convex env set DODO_PRODUCT_ID_BUSINESS <test product id>
```

`APP_URL` is already set and is reused for `return_url`.

Leave every `POLAR_*` variable in place for now. Nothing reads them, and they
are the audit trail if something needs checking against Polar.

### The webhook secret is load-bearing

`/dodo-webhook` fails closed. With no `DODO_PAYMENTS_WEBHOOK_KEY` it answers 401 to
everything, and no subscription is ever recorded. **Set the secret before
pointing Dodo at the endpoint.**

Dodo retries a non-2xx eight times: immediately, then after 5s, 5m, 30m, 2h, 5h,
10h and 10h. So a secret set within about a day is recovered on its own, and a
secret never set means a customer pays and gets nothing.

## 3. Point Dodo at the webhook and test the whole lifecycle

Endpoint URL: `https://<your-deployment>.convex.site/dodo-webhook`

Subscribe it to at least: `subscription.active`, `subscription.renewed`,
`subscription.plan_changed`, `subscription.on_hold`, `subscription.past_due`,
`subscription.cancelled`, `subscription.expired`, `subscription.failed`,
`subscription.updated`.

In test mode, with a test card, walk all of it and check the `subscriptions` row
after each step:

- [ ] Start a Starter checkout. Row appears, `status: "trialing"`,
      `trialEndsAt` about 7 days out, `dodoSubscriptionId` set.
- [ ] `getUsageAndLimits` returns starter limits, not free.
- [ ] Let the trial convert (or advance it in the Dodo dashboard). Row flips to
      `active`. **`startedAt` has not moved.**
- [ ] Change Starter to Pro from the billing page. Same `dodoSubscriptionId`,
      `plan: "pro"`, `priceMonthly: 5000`, **`startedAt` still has not moved**,
      and there is exactly ONE subscription in the Dodo dashboard, not two.
- [ ] Change Pro back to Starter.
- [ ] Start a Business checkout on a second test account. No trial, straight to
      `active`.
- [ ] Force a failed renewal. Row goes `past_due` and the paywall appears.
- [ ] Recover it with the update payment method flow. Row returns to `active`.
- [ ] Cancel from the billing page. **The row stays `active`**, gains
      `cancelAtPeriodEnd: true`, and the page says "Cancels on ...". The user
      can still send mail. This is the behaviour change: cancelling no longer
      revokes access on the spot.
- [ ] Let the period lapse. Row goes `canceled` and the paywall appears.
- [ ] Redeliver any one webhook from the Dodo dashboard. Nothing changes twice
      and the log says "duplicate delivery".
- [ ] Send an unsigned POST to `/dodo-webhook`. It answers 401.

```bash
# Should print 401. If it prints 200 the secret is not set on that deployment.
curl -si -X POST https://<deployment>.convex.site/dodo-webhook \
  -H 'content-type: application/json' \
  -d '{"type":"subscription.active","data":{"subscription_id":"x"}}' | head -1
```

## 4. Go live

1. Repeat steps 1 and 2 against live mode and the **prod** Convex deployment.
2. Add the live webhook endpoint in Dodo and confirm the 401 check above.
3. Merge and deploy. `.github/workflows/convex-dev.yml` runs `bunx convex deploy`
   on a push to `main`, which applies the schema additions. Every added field is
   optional, so existing documents validate unchanged and no backfill runs.
4. Vercel deploys the frontend.

`/polar-webhook` stops existing at this point. That is deliberate, and it is the
safer direction: see step 5.

## 5. Move the one paying customer

Do this **after** the deploy, and do it in this order.

1. Tell them first. Something like: "We are switching payment processors. Please
   re-enter your card once at <app>/billing. Your plan, your data and your
   sending limits stay exactly as they are, and we are cancelling the old
   subscription so you are never billed twice."
2. They open `/billing` and choose their current plan. Their existing row has no
   `dodoSubscriptionId`, so this goes through a fresh Dodo checkout, which is
   what establishes the new mandate.
3. `subscription.active` arrives. `handleDodoSubscriptionEvent` finds the
   existing row and **patches** it:
   - `startedAt` is not touched, so their monthly send allowance window does not
     move by a single day
   - `polarSubscriptionId` is retired into `migratedFromPolarId`
   - `dodoSubscriptionId` is set
4. Verify in the Convex dashboard before touching Polar:

```bash
bunx convex run --prod subscriptions:getByUserId '{"userId":"<their user id>"}'
```

   Expect `status` active or trialing, `dodoSubscriptionId` set,
   `polarSubscriptionId` absent, `migratedFromPolarId` holding the old id, and
   `startedAt` equal to what it was before.

5. **Only now** cancel and refund the Polar subscription from the Polar
   dashboard. Because `/polar-webhook` no longer exists and the Polar id has
   been retired off the row, that cancellation cannot reach the database.

   This ordering is the reason the Polar route was removed rather than kept. Had
   it stayed live, Polar's `subscription.canceled` would have matched the id
   still on the row, passed the stale-subscription guard, and flipped a live,
   paid-up customer to `canceled`, dropping them to free tier limits.

6. If they are mid-period on Polar and you would rather not refund, give them
   the overlap back with a Dodo discount code at checkout instead.

### If the webhook does not match them

Only happens if a subscription is created from the Dodo dashboard rather than
through the app, because then there is no `clerkId` in the metadata. The handler
logs `no clerkId in metadata` and acknowledges. Repair it by hand:

```bash
bunx convex run --prod subscriptions:relinkSubscriptionToDodo '{
  "clerkId": "user_xxx",
  "dodoSubscriptionId": "sub_xxx",
  "plan": "pro",
  "status": "active"
}'
```

It patches and refuses to insert, so `startedAt` cannot be clobbered. It returns
the old Polar id it retired, so you can confirm you relinked the right row.

## Known limits

**Delivery order is not guaranteed.** Dodo says so explicitly, and events can
arrive out of order across its retry window. `webhookEvents` stops the same
delivery being applied twice, and the stale-subscription guard stops a terminal
event for an old subscription touching a row that has moved on, but a retried
`subscription.active` arriving after a `subscription.cancelled` for the *same*
subscription would re-apply the older state. It self-heals on the next event,
because every delivery carries the subscription's current state and Dodo emits
`subscription.updated` on any change. With one subscriber this is not worth
building sequence tracking for. Revisit it if the customer count grows.

**The `@dodopayments/convex` adapter was not used.** It exists and is the
vendor's blessed path for this stack, but it installs as a Convex *component*,
which means adding a `convex.config.ts` this repo does not have and taking on
its own tables and its own model of a subscription alongside the `subscriptions`
table that the whole entitlement chain already reads. That is a re-architecture,
not a one for one provider swap. The hand-written client in `convex/lib/billing.ts`
is the smaller change. If the adapter is adopted later, do it as its own piece
of work with its own testing.

**Webhook verification is hand-written on purpose.** Dodo's guidance is to use
`client.webhooks.unwrap()`, and its fallback suggestion is the `standardwebhooks`
package. Both need Node's `crypto`, which the Convex default runtime that
`http.ts` runs in does not have. Moving verification into a `"use node"` action
would mean an httpAction hopping to a second function before it can trust its
own body. `verifyWebhookSignature` implements the same spec on Web Crypto, which
Convex does provide: HMAC-SHA256 over `webhook-id.webhook-timestamp.raw_body`,
base64, with timestamp tolerance and multi-signature rotation support. It is
covered by 12 tests including tampered body, wrong secret, wrong webhook id,
expired and future timestamps, rotation, and malformed headers.

## 6. Afterwards

- [ ] Watch the Convex logs for `[dodo-webhook] signature verification failed`.
      Any hit means a secret mismatch, not an attack, until proven otherwise.
- [ ] Confirm the first renewal actually charges, roughly a month out. This is
      the one thing test mode cannot prove.
- [ ] Download Polar invoices and tax documents before closing that account.
- [ ] After 90 days with nothing referring to Polar, the retained schema fields
      (`users.polarCustomerId`, `subscriptions.polarSubscriptionId`,
      `referrals.polarSubscriptionId` and its index) can be dropped. Dropping
      them needs the stored documents cleared of those fields first, or the
      schema push is rejected.

## Rollback

Nothing in this change is destructive, so rollback is a revert and a redeploy.

| Situation | Action |
|---|---|
| Checkout broken, nobody has subscribed on Dodo yet | `git revert` the commit, redeploy, re-add the Polar webhook endpoint in Polar. The retained `POLAR_*` vars and schema fields mean the old code still works. |
| Somebody has already subscribed on Dodo | Do not revert. The revert has no `/dodo-webhook`, so their renewals would go unrecorded. Fix forward. |
| Webhooks 401ing | Check `DODO_PAYMENTS_WEBHOOK_KEY` matches the endpoint's Overview tab. Dodo redelivers, so nothing is lost once it matches. |
| A customer wrongly shows as unsubscribed | `subscriptions:relinkSubscriptionToDodo` restores the row. Their `startedAt` is preserved either way. |
