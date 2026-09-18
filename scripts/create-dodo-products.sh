#!/usr/bin/env bash
#
# Create the three Mailmark subscription products in Dodo Payments and print the
# exact `bunx convex env set` lines for the ids they come back with.
#
#   ./scripts/create-dodo-products.sh test
#   ./scripts/create-dodo-products.sh live
#
# Needs DODO_PAYMENTS_API_KEY in the environment, matching the mode:
#
#   DODO_PAYMENTS_API_KEY=dodo_test_... ./scripts/create-dodo-products.sh test
#
# Prices are in cents and must stay equal to PLANS in convex/subscriptions.ts,
# which is what gets written to subscriptions.priceMonthly.
#
# trial_period_days is deliberately NOT set on the product. A recurring price can
# carry one, but convex/lib/billing.ts trialDaysForPlan sends it per checkout
# (7 days for Starter and Pro, none for Business), and having it in both places
# would leave two sources of truth for the same number.

set -euo pipefail

MODE="${1:-}"
case "$MODE" in
  test) BASE_URL="https://test.dodopayments.com" ;;
  live) BASE_URL="https://live.dodopayments.com" ;;
  *) echo "usage: $0 <test|live>" >&2; exit 2 ;;
esac

if [ -z "${DODO_PAYMENTS_API_KEY:-}" ]; then
  echo "DODO_PAYMENTS_API_KEY is not set" >&2
  exit 2
fi

case "$MODE:${DODO_PAYMENTS_API_KEY}" in
  test:dodo_test_*|live:dodo_live_*) ;;
  *) echo "The key does not match mode '$MODE'. Refusing, so live products are not created with a test key or the reverse." >&2; exit 2 ;;
esac

if [ "$MODE" = "live" ]; then
  echo "About to create three LIVE products in Dodo. These are real and cannot be deleted, only archived."
  printf "Type 'yes' to continue: "
  read -r reply
  [ "$reply" = "yes" ] || { echo "Aborted."; exit 1; }
fi

create_product() {
  local name="$1" description="$2" cents="$3"

  local body
  body=$(cat <<JSON
{
  "name": "$name",
  "description": "$description",
  "tax_category": "saas",
  "price": {
    "type": "recurring_price",
    "currency": "USD",
    "price": $cents,
    "discount": 0,
    "payment_frequency_count": 1,
    "payment_frequency_interval": "Month",
    "subscription_period_count": 1,
    "subscription_period_interval": "Month",
    "purchasing_power_parity": false
  }
}
JSON
)

  local response
  response=$(curl -sS -X POST "$BASE_URL/products" \
    -H "Authorization: Bearer $DODO_PAYMENTS_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$body")

  # node rather than jq: this repo already requires a JS runtime, jq may not be
  # installed. Prints the id, or the whole response on failure so the API's own
  # error message is what you see.
  node -e '
    let raw = "";
    process.stdin.on("data", (d) => (raw += d));
    process.stdin.on("end", () => {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.product_id) { console.log(parsed.product_id); process.exit(0); }
        console.error("No product_id in response:\n" + raw);
      } catch { console.error("Unparseable response:\n" + raw); }
      process.exit(1);
    });
  ' <<<"$response"
}

echo "Creating products against $BASE_URL"
echo

STARTER=$(create_product "Mailmark Starter" "1,000 emails per month, 1 domain, 3 mailboxes" 1000)
echo "  Starter   \$10/mo   $STARTER"
PRO=$(create_product "Mailmark Pro" "25,000 emails per month, 5 domains, unlimited mailboxes" 5000)
echo "  Pro       \$50/mo   $PRO"
BUSINESS=$(create_product "Mailmark Business" "100,000 emails per month, unlimited domains and mailboxes" 10000)
echo "  Business  \$100/mo  $BUSINESS"

cat <<OUT

Done. Set these on the Convex production deployment, BEFORE merging to main:

bunx convex env set --prod DODO_PAYMENTS_BASE_URL $BASE_URL
bunx convex env set --prod DODO_PAYMENTS_API_KEY '$DODO_PAYMENTS_API_KEY'
bunx convex env set --prod DODO_PAYMENTS_WEBHOOK_KEY 'whsec_...'   # from the webhook endpoint's Overview tab
bunx convex env set --prod DODO_PRODUCT_ID_STARTER $STARTER
bunx convex env set --prod DODO_PRODUCT_ID_PRO $PRO
bunx convex env set --prod DODO_PRODUCT_ID_BUSINESS $BUSINESS

Then confirm, and that APP_URL is already present:

bunx convex env list --prod
OUT
