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

### Doing all of this without a terminal

Nothing in this runbook needs a local checkout. Both sides are web dashboards:

- **Dodo dashboard** creates the products and the webhook endpoint.
- **Convex dashboard** sets the environment variables, under Settings then
  Environment Variables. It is the same thing `bunx convex env set --prod` does,
  and it needs no CLI login.

The script in `scripts/create-dodo-products.sh` is a convenience for getting the
three ids without copying them by hand. For three products the dashboard is
about as quick, and it is the better choice if you are not set up to run bash
locally.

### Values to enter, either way

| Field | Starter | Pro | Business |
|---|---|---|---|
| Name | Mailmark Starter | Mailmark Pro | Mailmark Business |
| Pricing model | Recurring | Recurring | Recurring |
| Price | $10.00 | $50.00 | $100.00 |
| Currency | USD | USD | USD |
| Billing period | Monthly | Monthly | Monthly |
| Tax category | SaaS | SaaS | SaaS |
| Free trial | **leave off** | **leave off** | **leave off** |

Two things that are easy to get wrong:

- **Check whether the price field wants dollars or cents.** The API takes the
  smallest currency unit, so $10.00 is `1000`. If the dashboard field is labelled
  in dollars, enter `10`. Getting this wrong is a factor of 100 in either
  direction.
- **Leave the trial off on all three products.** A recurring price can carry
  `trial_period_days`, but `lib/billing.trialDaysForPlan` sends it per checkout:
  7 days for Starter and Pro, none for Business. Setting it in both places gives
  two sources of truth for the same number.

Copy each product's `pdt_...` id as you go. Those are the three
`DODO_PRODUCT_ID_*` values.

### If you would rather run the script

It lives on the migration branch, which is not merged yet, so check the branch
out rather than `main`. It needs `bash`, `curl` and `node`, so on Windows use
Git Bash or WSL rather than PowerShell.

```bash
git fetch origin claude/relaxed-darwin-8jb5io
git checkout claude/relaxed-darwin-8jb5io
DODO_PAYMENTS_API_KEY=dodo_live_... ./scripts/create-dodo-products.sh live
```

It prints the six `bunx convex env set --prod` lines with the ids filled in. To
run those you need the Convex CLI logged in (`bunx convex login`); otherwise
paste the values into the Convex dashboard instead.

### Product reference



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

### These are Convex deployment config, not repository config

`bunx convex deploy` pushes code and schema. **It does not set environment
variables.** They live on the Convex deployment and have to be set separately,
through the dashboard or the CLI, and they survive deploys.

That matters here because deployment is a GitHub Action on merge to `main`. The
moment the merge lands, the new code is live. **Set the variables before you
merge.** Setting them early is completely safe: nothing reads them until the
code that reads them exists.

If the code lands first, the gap costs you this:

- a new signup clicking a plan gets `DODO_PAYMENTS_BASE_URL is not configured`
- `/dodo-webhook` answers 401 to everything, which is harmless while no Dodo
  webhook is configured yet
- **the existing customer is unaffected**, because their row is untouched and
  `needsUpgrade` is false for anyone holding an active subscription

Nothing is corrupted by the gap, but new signups cannot pay during it.

### The six variables

All six are Convex, backend only. **Nothing goes in Vercel**: no `NEXT_PUBLIC_`
variable is involved, because no payment code runs in the browser.

| Variable | Value | Status |
|---|---|---|
| `DODO_PAYMENTS_BASE_URL` | `https://live.dodopayments.com` (or `https://test.dodopayments.com`) | new |
| `DODO_PAYMENTS_API_KEY` | `dodo_live_...` / `dodo_test_...` | new |
| `DODO_PAYMENTS_WEBHOOK_KEY` | `whsec_...` from the endpoint's Overview tab | new |
| `DODO_PRODUCT_ID_STARTER` | `pdt_...` | new |
| `DODO_PRODUCT_ID_PRO` | `pdt_...` | new |
| `DODO_PRODUCT_ID_BUSINESS` | `pdt_...` | new |
| `APP_URL` | your site origin | already set, seven other call sites use it. Verify only. |

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

## 2b. No dev deployment: test in Dodo test mode against production

With only one Convex deployment, the dev-deployment path is not available. You
can still get real end to end validation, because **test mode is a Dodo
concept, not a Convex one.** Point the production deployment at Dodo test mode
first, prove the whole lifecycle with a test card, then flip six variables to
live.

Nothing is charged, no real card is touched, and the existing customer is
untouched throughout: their row already says `active`, so they see no paywall
whichever mode the variables point at.

**Phase A, test mode on production.** Create the products in test mode and set:

```bash
DODO_PAYMENTS_API_KEY=dodo_test_... ./scripts/create-dodo-products.sh test
# then the six env set lines it prints, with the test webhook secret
```

Add a **test mode** webhook in Dodo pointing at
`https://<deployment>.convex.site/dodo-webhook`, then walk the checklist in
section 3 using a Dodo test card and a throwaway account, not your own.

The one cost of this window: a real new signup who reaches checkout during it
gets a test-mode subscription that never charges them. Keep the window short,
do it at a quiet hour, and check afterwards whether any `subscriptions` row was
created that you did not create yourself.

**Phase B, flip to live.** Create the products again in live mode, because test
and live product ids differ, then re-set the same six variables:

```bash
DODO_PAYMENTS_API_KEY=dodo_live_... ./scripts/create-dodo-products.sh live
```

Add a **live mode** webhook at the same URL, re-run the 401 check from section 3
against it, and delete any test-mode subscription rows the window produced.

The flip is six `convex env set` commands and takes effect immediately. No
deploy is involved, so there is no window where the code and the configuration
disagree beyond the seconds between the commands.

## 3. Point Dodo at the webhook and test the whole lifecycle

Endpoint URL: `https://<your-deployment>.convex.site/dodo-webhook`

Find it in the Convex dashboard under Settings, as the HTTP Actions URL. It is
the deployment URL with `.convex.site` in place of `.convex.cloud`.

**Use that URL directly. Do not use `https://api.mailmark.dev/dodo-webhook`**,
even though `next.config.ts` rewrites that host to Convex and it would appear to
work. Signature verification hashes the exact bytes Dodo sent, and that route
proxies the request through Vercel and Next.js first, which is one more place
the body can be re-encoded. It also makes webhook delivery depend on the
frontend being up. Point Dodo straight at Convex.

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

Deployment is `.github/workflows/convex-dev.yml`, which runs `bunx convex deploy`
on every push to `main`. So the merge *is* the deploy, and the order around it is
what matters:

1. Set the six variables on the **prod** Convex deployment with live-mode values.
   Before the merge, for the reason in step 2.

   ```bash
   bunx convex env set --prod DODO_PAYMENTS_BASE_URL https://live.dodopayments.com
   bunx convex env set --prod DODO_PAYMENTS_API_KEY dodo_live_...
   bunx convex env set --prod DODO_PAYMENTS_WEBHOOK_KEY whsec_...
   bunx convex env set --prod DODO_PRODUCT_ID_STARTER pdt_...
   bunx convex env set --prod DODO_PRODUCT_ID_PRO pdt_...
   bunx convex env set --prod DODO_PRODUCT_ID_BUSINESS pdt_...
   bunx convex env list --prod   # confirm, and check APP_URL is present
   ```

2. Merge to `main`. The Action deploys. It applies, with nothing manual to run:
   - the `webhookEvents` table
   - the new optional fields on `users`, `subscriptions` and `referrals`, which
     existing documents satisfy without a backfill because every one is optional
   - the two new indexes, on tables small enough to build instantly
   - the daily `prune webhook events` cron

   If the push is rejected for any reason the Action fails and **nothing is
   deployed**. There is no half-applied state to clean up.

3. Vercel deploys the frontend from the same merge. It needs no new variables.

4. Only now add the **live mode** webhook endpoint in Dodo, and re-run the 401
   check from step 3 against production before trusting it.

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
