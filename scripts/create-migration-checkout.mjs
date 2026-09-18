#!/usr/bin/env node
/**
 * Create a one-off Dodo checkout link for a customer being moved off the old
 * payment provider, with a trial long enough to cover whatever they have
 * already paid for elsewhere.
 *
 *   node scripts/create-migration-checkout.mjs <clerkId> <plan> <trialDays> [email]
 *
 * Example: Business customer paid through 28 Sep, link made on the 18th:
 *   node scripts/create-migration-checkout.mjs user_2abc business 10 them@example.com
 *
 * Why this rather than creating a subscription in the Dodo dashboard:
 *
 *  - It goes through POST /checkouts, the same call convex/lib/billing.ts
 *    createCheckout makes, so it is the path already proven in production.
 *  - It puts clerkId in metadata, which is what the webhook matches on. A
 *    subscription created in the dashboard carries no clerkId, so the handler
 *    logs "no clerkId in metadata", acknowledges, and the row has to be
 *    repaired by hand with subscriptions.relinkSubscriptionToDodo.
 *  - trial_period_days is per checkout, so the Business product stays with no
 *    trial and nobody else is affected.
 *
 * The customer's existing row is patched, not replaced: startedAt keeps its
 * original value and their monthly send allowance window does not move.
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const [clerkId, plan, trialDaysRaw, email] = process.argv.slice(2);

const PLANS = { starter: "DODO_PRODUCT_ID_STARTER", pro: "DODO_PRODUCT_ID_PRO", business: "DODO_PRODUCT_ID_BUSINESS" };

if (!clerkId || !plan || trialDaysRaw === undefined) {
  console.error("usage: node scripts/create-migration-checkout.mjs <clerkId> <plan> <trialDays> [email]");
  console.error("  plan: starter | pro | business");
  console.error("  trialDays: days before the first charge, 0 to charge immediately");
  process.exit(2);
}
if (!PLANS[plan]) {
  console.error(`Unknown plan "${plan}". Expected one of: ${Object.keys(PLANS).join(", ")}`);
  process.exit(2);
}
const trialDays = Number(trialDaysRaw);
if (!Number.isInteger(trialDays) || trialDays < 0 || trialDays > 10000) {
  console.error(`trialDays must be a whole number between 0 and 10000, got "${trialDaysRaw}"`);
  process.exit(2);
}
if (!clerkId.startsWith("user_")) {
  console.error(`"${clerkId}" does not look like a Clerk id. They start with "user_".`);
  console.error("Find it on the users table row that the subscription's userId points at.");
  process.exit(2);
}

const KEY = process.env.DODO_PAYMENTS_API_KEY;
const BASE = (process.env.DODO_PAYMENTS_BASE_URL ?? "https://live.dodopayments.com").replace(/\/+$/, "");
const PRODUCT = process.env[PLANS[plan]];
const APP_URL = (process.env.APP_URL ?? "https://www.mailmark.dev").replace(/\/+$/, "");

for (const [name, value] of [["DODO_PAYMENTS_API_KEY", KEY], [PLANS[plan], PRODUCT]]) {
  if (!value) { console.error(`${name} is not set in this shell.`); process.exit(2); }
}

const firstCharge = new Date(Date.now() + trialDays * 86400000);

console.log(`
  environment   ${BASE}
  plan          ${plan}
  product       ${PRODUCT}
  clerkId       ${clerkId}
  email         ${email ?? "(the customer enters it on the checkout page)"}
  trial         ${trialDays} day(s)
  first charge  ${trialDays === 0 ? "immediately at checkout" : firstCharge.toISOString().slice(0, 10)}
`);

async function main() {
  if (BASE.includes("live")) {
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = await rl.question("This creates a LIVE checkout. Type 'yes' to continue: ");
    rl.close();
    if (answer.trim() !== "yes") { console.log("Aborted."); process.exit(1); }
  }

  const body = {
    product_cart: [{ product_id: PRODUCT, quantity: 1 }],
    return_url: `${APP_URL}/dashboard?upgraded=true`,
    // What the webhook matches on. Without it the subscription cannot be tied
    // back to a user and the row has to be repaired by hand.
    metadata: { clerkId, plan },
  };
  if (email) body.customer = { email, name: undefined };
  if (trialDays > 0) body.subscription_data = { trial_period_days: trialDays };

  const res = await fetch(`${BASE}/checkouts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST /checkouts failed (${res.status}): ${text}`);

  const session = JSON.parse(text);
  if (!session.checkout_url) throw new Error(`No checkout_url in response: ${text}`);

  console.log(`Send this to the customer. Single use, expires in 24 hours:

  ${session.checkout_url}

When they complete it:
  - subscription.active fires with clerkId in its metadata
  - their existing row is PATCHED, so startedAt and their send quota window
    are untouched
  - status becomes ${trialDays > 0 ? '"trialing" until the first charge' : '"active"'}
  - polarSubscriptionId stays on the row as the record of what they were
    billed under before
`);
}

main().catch((err) => {
  console.error(`\n${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
