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

**Every `POLAR_*` variable can be deleted now.** Nothing in the repository reads
one: a sweep across every file type outside `node_modules` finds `POLAR_` only in
documentation and in one comment. Deleting them changes no behaviour.

```bash
bunx convex env remove POLAR_BASE_URL
bunx convex env remove POLAR_ACCESS_TOKEN
bunx convex env remove POLAR_WEBHOOK_SECRET
bunx convex env remove POLAR_PRICE_ID_STARTER
bunx convex env remove POLAR_PRICE_ID_PRO
bunx convex env remove POLAR_PRICE_ID_BUSINESS
bunx convex env remove POLAR_PRODUCT_ID_STARTER
bunx convex env remove POLAR_PRODUCT_ID_PRO
bunx convex env remove POLAR_PRODUCT_ID_BUSINESS
```

Run `bunx convex env list` afterwards and confirm nothing starting with `POLAR_`
is left.

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

### First: find out what Polar has actually done

The Polar account is banned. Before planning around the 28 September renewal,
establish which of these is true, because they need different responses:

- **Polar has already cancelled the subscription.** Then there is no renewal, no
  double charge, and no deadline other than your own revenue. Move the customer
  as soon as you can.
- **Polar will still charge on 28 September.** Then the customer pays for a month
  through an account you cannot issue a refund from. Move them before the 28th.
- **You cannot tell.** Assume the second. It is the one that costs the customer
  money.

Ask the customer whether their card was charged, and check whether any Polar
dashboard or email receipt is still reachable. Do not assume a banned account
stops billing, and do not assume it keeps billing.

### Timing

The customer's Polar renewal is **28 September**.

Starter and Pro carry a 7 day Dodo trial, and here that trial is not a giveaway,
it is the bridge. Dodo charges nothing for 7 days, so the first Dodo charge lands
7 days after they re-subscribe:

| They re-subscribe | First Dodo charge | Result |
|---|---|---|
| 20 Sep | 27 Sep | 1 day double paid |
| **21 Sep** | **28 Sep** | **exact handoff, no gap, no overlap** |
| 22 Sep | 29 Sep | 1 day free, costs you a day |
| 25 Sep | 2 Oct | 4 days free |
| after 28 Sep | - | Polar has already renewed, refund needed |

If Polar is still billing, **21 or 22 September** is the clean window: earlier
double pays, later costs a few free days. A day or two of free access is much
the cheaper mistake, so given the choice, choose late.

If Polar has already cancelled, ignore the table and move them immediately. The
7 day trial is then simply a week free, which is a reasonable thing to give the
only customer who has to re-enter a card because of a problem that was not
theirs.

Either way you cannot rely on cancelling the Polar subscription yourself: a
banned account may have no working dashboard. That is fine, and it is why the
Polar webhook route was removed. Whatever Polar does to that subscription,
including cancelling it outright, **it can no longer reach this database.**

**Expect the customer to show as "Trialing" for those 7 days.** That is correct
and they keep their full plan limits throughout: `quotas.isEntitledStatus` treats
trialing exactly like active. The badge on the billing page will say Trialing and
the row will say `status: "trialing"`. Nothing is degraded.



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

5. **Then** stop the Polar subscription, if the banned account still lets you.
   If it does not, there is nothing further to do: that subscription can no
   longer affect this application in any way. `/polar-webhook` does not exist,
   and the Polar id has been retired off the row, so even a delivery that
   somehow arrived would have nothing to match.

   This is the reason the Polar route was removed rather than kept. Had it
   stayed live, a mass cancellation fired when the account was banned would have
   matched the id still on the row, passed the stale-subscription guard, and
   flipped a live, paid-up customer to `canceled`, locking them out of an
   account they had paid for.

6. If the overlap leaves them out of pocket and you cannot refund through Polar,
   give it back on the Dodo side with a discount code at checkout, or extend the
   trial by a few days when you create the subscription.

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

## What the pre-merge review checked

Verified directly rather than assumed:

- **The HTTP route table is unchanged apart from the swap.** Enumerated at
  runtime from the real router on `main` and on this branch: 36 routes both
  sides, diff is exactly `- POST /polar-webhook` / `+ POST /dodo-webhook`.
  Email ingestion, the tracking pixels and every `/v1/*` endpoint are untouched.
- **Relinking the existing customer moves no platform counter.**
  `lib/counters.bumpCounters` skips a zero delta, and a pro/active row relinked
  to pro/active produces exactly that.
- **No live reference to Polar remains.** Every remaining mention in `convex/`
  and `app/` is a comment or a retained schema field.
- **Missing the Polar renewal on 28 September is harmless if the customer has
  not moved yet.** Their row already says `active`, a Polar renewal event would
  have patched it to the same values, and with the route gone the delivery just
  404s. The row is untouched either way, so they keep working.
- **Between deploy and re-subscribe the customer sees nothing.** `needsUpgrade`
  is `trialExpired && !hasActiveSubscription && ...`; they have an active
  subscription, so no paywall.
- **A trial that ends with no webhook leaves the row `trialing`, not expired.**
  That is the safe direction: trialing is entitled, so a missed event cannot
  revoke a paying customer. The row corrects itself on the next event, and Dodo
  fires `subscription.renewed` at the first charge.

- **No client-callable function can cancel a subscription.** Verified by
  importing the module and listing what it actually registers: nine functions,
  and the only three that can write a subscription's `status` are internal
  mutations. `handleDodoSubscriptionEvent` is reachable solely from
  `/dodo-webhook` behind signature verification; `relinkSubscriptionToDodo` is
  manual. The old local-only `cancel` mutation is commented out and confirmed
  absent from the module's exports, as is `cancelViaPolar`.
- **Deleting the `POLAR_*` environment variables changes nothing.** A sweep over
  every file type in the repository outside `node_modules` finds `POLAR_` only
  in documentation and one comment.

Two bugs were found and fixed during this review, both introduced by the move:

- **`recordCommission` double paid affiliates.** It added the full commission to
  `totalEarnedCents` on every call while only `activeReferrals` was guarded.
  Harmless on Polar, where it ran once per subscription from
  `subscription.created`. Dodo re-fires `subscription.active` on every recovery
  from `on_hold`, so a referred customer whose card failed and was fixed would
  have paid their referrer again each time. Now adjusts by the difference from
  what the referral already contributes, covered by `tests/affiliateCommission.test.ts`.
- **A plan change stopped moving the commission rate.** On Polar a plan change
  cancelled and recreated the subscription, so `subscription.created` fired again
  with the new plan. Dodo keeps the same subscription, so
  `subscription.plan_changed` now triggers the same path.

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

## The legacy Polar fields

Three fields and one index survive from the Polar era:
`users.polarCustomerId`, `subscriptions.polarSubscriptionId`,
`referrals.polarSubscriptionId` and `referrals.by_polarSubscriptionId`.

**No code reads or writes any of them.** They are left exactly as they are, and
that is deliberate rather than laziness:

- It is the audit trail. A subscription row carrying both `polarSubscriptionId`
  and `dodoSubscriptionId` is one that was migrated, and that field is the only
  remaining record of what it used to be billed under once the Polar account is
  gone.
- Nothing can act on it. `/polar-webhook` does not exist and no code path looks a
  subscription up by that id, so the value is inert.
- Dropping them would need two deploys, because Convex validates every stored
  document against the schema on push, so the data would have to be cleared
  first. There is no reason to spend a production deploy on it.

If you ever do want them gone, the order is: clear the fields from every stored
document, confirm none remain, then delete the fields and the index from
`convex/schema.ts` and deploy again. Not before.

## Rollback

**There is no rollback to Polar.** The account is banned, so a `git revert` would
restore code that calls an API you cannot authenticate against and a webhook
endpoint Polar cannot be configured to call. Reverting would leave checkout
broken with no working alternative. The only direction is forward, which is why
step 3's test-mode checklist matters more here than it normally would.

What protects the existing customer is not a rollback, it is that **nothing can
change their subscription row.** It says `active`. Polar cannot reach the
database, because the route is gone. Dodo does not know them yet. So for as long
as it takes to get Dodo working, they keep their plan, their limits and their
sending, whatever happens on either provider's side.

| Situation | Action |
|---|---|
| Dodo checkout broken, nobody has subscribed yet | Fix forward. The existing customer is unaffected: their row is untouched and they see no paywall. New signups cannot pay until it is fixed, which is the only real cost. |
| Somebody has already subscribed on Dodo | Fix forward, and do not revert. A revert has no `/dodo-webhook`, so their renewals would go unrecorded and they would eventually be locked out. |
| Webhooks 401ing | Check `DODO_PAYMENTS_WEBHOOK_KEY` matches the endpoint's Overview tab. Dodo redelivers eight times over about 28 hours, so nothing is lost once it matches. |
| A customer wrongly shows as unsubscribed | `subscriptions:relinkSubscriptionToDodo` restores the row, preserving `startedAt`. |
| You need to buy time | Set the customer's `users.category` to `beta` or `admin`. That bypasses the paywall entirely, independent of any subscription row or provider. |
