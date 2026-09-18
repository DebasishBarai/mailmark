#!/usr/bin/env node
/**
 * Create the three Mailmark subscription products in Dodo Payments and print the
 * env var block to paste into Convex.
 *
 *   DODO_PAYMENTS_API_KEY=dodo_test_... node scripts/create-dodo-products.mjs test
 *   DODO_PAYMENTS_API_KEY=dodo_live_... node scripts/create-dodo-products.mjs live
 *
 * Node 18+ for global fetch. No dependencies, no bash, works the same on
 * Windows, macOS and Linux.
 *
 * Prices are in cents and must stay equal to PLANS in convex/subscriptions.ts,
 * which is what gets written to subscriptions.priceMonthly.
 *
 * trial_period_days is deliberately not set on the product. A recurring price
 * can carry one, but convex/lib/billing.ts trialDaysForPlan sends it per
 * checkout (7 days for Starter and Pro, none for Business), and setting it in
 * both places would leave two sources of truth for the same number.
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const PLANS = [
  { env: "DODO_PRODUCT_ID_STARTER", name: "Mailmark Starter", cents: 1000,
    description: "1,000 emails per month, 1 domain, 3 mailboxes" },
  { env: "DODO_PRODUCT_ID_PRO", name: "Mailmark Pro", cents: 5000,
    description: "25,000 emails per month, 5 domains, unlimited mailboxes" },
  { env: "DODO_PRODUCT_ID_BUSINESS", name: "Mailmark Business", cents: 10000,
    description: "100,000 emails per month, unlimited domains and mailboxes" },
];

const mode = process.argv[2];
const BASE = { test: "https://test.dodopayments.com", live: "https://live.dodopayments.com" }[mode];
if (!BASE) {
  console.error("usage: node scripts/create-dodo-products.mjs <test|live>");
  process.exit(2);
}

const KEY = process.env.DODO_PAYMENTS_API_KEY;
if (!KEY) {
  console.error("DODO_PAYMENTS_API_KEY is not set.");
  console.error("  macOS/Linux : DODO_PAYMENTS_API_KEY=dodo_" + mode + "_... node scripts/create-dodo-products.mjs " + mode);
  console.error("  PowerShell  : $env:DODO_PAYMENTS_API_KEY='dodo_" + mode + "_...'; node scripts/create-dodo-products.mjs " + mode);
  process.exit(2);
}
// Refuse a key that does not match the mode, so live products cannot be created
// with a test key or the reverse.
if (!KEY.startsWith(`dodo_${mode}_`)) {
  console.error(`The key does not look like a ${mode} key (expected it to start with "dodo_${mode}_"). Refusing.`);
  process.exit(2);
}

async function dodo(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} failed (${res.status}): ${text}`);
  }
  return body;
}

/** Products already in this environment, so a second run cannot silently
 *  create a duplicate set that the env vars then disagree about. */
async function existingByName() {
  const found = new Map();
  for (let page = 0; page < 20; page++) {
    const res = await dodo(`/products?page_size=100&page_number=${page}`);
    const items = res.items ?? [];
    for (const item of items) {
      if (item?.name && item?.product_id && !item.is_archived) found.set(item.name, item.product_id);
    }
    if (items.length < 100) break;
  }
  return found;
}

async function createProduct(plan) {
  const body = await dodo("/products", {
    method: "POST",
    body: JSON.stringify({
      name: plan.name,
      description: plan.description,
      tax_category: "saas",
      price: {
        type: "recurring_price",
        currency: "USD",
        price: plan.cents,
        discount: 0,
        payment_frequency_count: 1,
        payment_frequency_interval: "Month",
        subscription_period_count: 1,
        subscription_period_interval: "Month",
        purchasing_power_parity: false,
      },
    }),
  });
  if (!body.product_id) throw new Error(`No product_id in response: ${JSON.stringify(body)}`);
  return body.product_id;
}

async function confirm(question) {
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim() === "yes";
}

async function main() {
  const existing = await existingByName();
  const toCreate = PLANS.filter((p) => !existing.has(p.name));
  const reused = PLANS.filter((p) => existing.has(p.name));

  console.log(`\nDodo ${mode} mode: ${BASE}\n`);
  for (const p of reused) {
    console.log(`  exists  ${p.name.padEnd(18)} ${existing.get(p.name)}`);
  }
  for (const p of toCreate) {
    console.log(`  create  ${p.name.padEnd(18)} $${(p.cents / 100).toFixed(2)}/mo`);
  }

  if (toCreate.length === 0) {
    console.log("\nAll three already exist. Nothing to create.");
  } else {
    if (mode === "live") {
      console.log("\nThese will be REAL products. Dodo has no delete, only archive.");
      if (!(await confirm("Type 'yes' to continue: "))) {
        console.log("Aborted.");
        process.exit(1);
      }
    }
    console.log("");
    for (const plan of toCreate) {
      const id = await createProduct(plan);
      existing.set(plan.name, id);
      console.log(`  created ${plan.name.padEnd(18)} ${id}`);
    }
  }

  console.log(`
  Set these in the Convex dashboard (Settings, Environment Variables) on the
  PRODUCTION deployment, or with the CLI. Before merging to main.

    DODO_PAYMENTS_BASE_URL     ${BASE}
    DODO_PAYMENTS_API_KEY      ${KEY}
    DODO_PAYMENTS_WEBHOOK_KEY  whsec_...   <- from the webhook endpoint's Overview tab
  ${PLANS.map((p) => `  ${p.env.padEnd(26)} ${existing.get(p.name)}`).join("\n")}

  As CLI commands:

    bunx convex env set --prod DODO_PAYMENTS_BASE_URL ${BASE}
    bunx convex env set --prod DODO_PAYMENTS_API_KEY '${KEY}'
    bunx convex env set --prod DODO_PAYMENTS_WEBHOOK_KEY 'whsec_...'
  ${PLANS.map((p) => `  bunx convex env set --prod ${p.env} ${existing.get(p.name)}`).join("\n")}

  Then confirm, and that APP_URL is already present:

    bunx convex env list --prod
  `);
}

main().catch((err) => {
  // Dodo's own message is the useful part. A stack trace here only tells the
  // reader which line of this script did the fetch, which they do not need.
  console.error(`\n${err instanceof Error ? err.message : String(err)}\n`);
  if (String(err).includes("401")) {
    console.error("That looks like a bad or wrong-mode API key. Check Settings, API Keys in the Dodo dashboard.\n");
  }
  process.exit(1);
});
