"use client";

import { useState } from "react";

// Assumptions behind the counts, spelled out in the footnote below so the
// comparison stays honest: three mailboxes per product, and a stitched-together
// stack of five tools (domain mail hosting, a sending API, a campaign tool, a
// warm-up service and a deliverability monitor).
const MAILBOXES_PER_PRODUCT = 3;
const STITCHED_TOOL_COUNT = 5;

const MIN_PRODUCTS = 1;
const MAX_PRODUCTS = 10;

// Approximate US list prices as of August 2026, taking the cheaper credible
// option in each category so the total reads as a floor rather than a
// worst case. Each figure is named in the footnote so a reader can check it.
const PRICE_MAILBOX = 7; // Google Workspace Business Starter, per mailbox, annual billing
const PRICE_SENDING_API = 20; // Resend Pro, 50,000 emails / month
const PRICE_CAMPAIGN_TOOL = 39; // Kit Creator, 1,000 subscribers
const PRICE_WARMUP = 15; // Warmbox, per warmed sending address (one per product)
const PRICE_MONITORING = 55; // GlockApps Essential

// Mailmark's own plans, from the pricing section further down the page.
const MAILMARK_PLANS = [
  { name: "Starter", maxDomains: 1, price: 10 },
  { name: "Pro", maxDomains: 5, price: 50 },
  { name: "Business", maxDomains: Infinity, price: 100 },
];

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

export default function Arithmetic() {
  const [products, setProducts] = useState(4);

  const mailboxes = products * MAILBOXES_PER_PRODUCT;

  // Rows are paired so a row whose two sides land on the same number can be
  // shown in neutral gray: those are the costs Mailmark does not pretend to
  // remove, and coloring them red against green would overclaim.
  const countRows = [
    {
      left: "DNS panels to configure & keep valid",
      right: "DNS setup, guided & auto-verified",
      stitched: products,
      mailmark: products,
    },
    {
      left: "Mailboxes to create and watch",
      right: "Mailboxes, managed in one place",
      stitched: mailboxes,
      mailmark: mailboxes,
    },
    {
      left: "Separate tools & logins",
      right: "Separate tools & logins",
      stitched: STITCHED_TOOL_COUNT,
      mailmark: 1,
    },
    {
      left: "Places a user reply can land",
      right: "Places a user reply can land",
      stitched: mailboxes,
      mailmark: 1,
    },
    {
      left: "Separate bills each month",
      right: "Separate bills each month",
      stitched: STITCHED_TOOL_COUNT,
      mailmark: 1,
    },
  ];

  const mailboxHosting = mailboxes * PRICE_MAILBOX;
  const warmup = products * PRICE_WARMUP;

  const costRows = [
    { label: "Mailbox hosting", stitched: mailboxHosting },
    { label: "Sending API", stitched: PRICE_SENDING_API },
    { label: "Campaign tool", stitched: PRICE_CAMPAIGN_TOOL },
    { label: "Inbox warm-up", stitched: warmup },
    { label: "Deliverability monitoring", stitched: PRICE_MONITORING },
  ];

  const stitchedTotal = costRows.reduce((sum, row) => sum + row.stitched, 0);

  const plan =
    MAILMARK_PLANS.find((p) => products <= p.maxDomains) ??
    MAILMARK_PLANS[MAILMARK_PLANS.length - 1];

  const monthlySaving = stitchedTotal - plan.price;

  return (
    <section className="bg-gray-50 px-6 py-24 dark:bg-gray-900">
      <div className="mx-auto max-w-5xl">
        {/* Section header */}
        <div className="mb-6 flex items-center gap-4">
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
            02 / The arithmetic
          </span>
          <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="grid gap-4 md:grid-cols-[1.15fr_1fr] md:items-end md:gap-14">
          <h2 className="font-display text-3xl leading-[1.06] text-gray-900 dark:text-white md:text-5xl">
            The cost isn&rsquo;t the subscription. It&rsquo;s the
            multiplication.
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            One product&rsquo;s email setup is an afternoon. The problem is that
            it&rsquo;s an afternoon <em>again</em> for every product you ship,
            and then it&rsquo;s yours to maintain forever.
          </p>
        </div>

        {/* Calculator */}
        <div className="mt-12 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 md:p-9">
          <label
            htmlFor="product-count"
            className="font-mono text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400"
          >
            How many products do you run?
          </label>

          <div className="mt-4">
            <div className="flex items-baseline gap-3.5">
              <span className="font-display text-5xl tabular-nums text-gray-900 dark:text-white">
                {products}
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                {products === 1 ? "product in flight" : "products in flight"}
              </span>
            </div>
            <input
              id="product-count"
              type="range"
              min={MIN_PRODUCTS}
              max={MAX_PRODUCTS}
              step={1}
              value={products}
              onChange={(e) => setProducts(Number(e.target.value))}
              className="mt-4 w-full accent-violet-600"
            />
            <div className="mt-1 flex justify-between font-mono text-[0.68rem] text-gray-400 dark:text-gray-500">
              {Array.from(
                { length: MAX_PRODUCTS - MIN_PRODUCTS + 1 },
                (_, i) => MIN_PRODUCTS + i
              ).map((n) => (
                <span key={n}>{n}</span>
              ))}
            </div>
          </div>

          {/* Before / after */}
          <div className="mt-9 grid overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 sm:grid-cols-2">
            {/* Stitching it together yourself */}
            <div className="border-b border-gray-200 bg-violet-50/60 p-6 dark:border-gray-700 dark:bg-violet-950/20 sm:border-b-0 sm:border-r">
              <h3 className="mb-4 font-mono text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                Stitching it together yourself
              </h3>
              <dl>
                {countRows.map((row) => (
                  <div
                    key={row.left}
                    className="flex items-baseline justify-between gap-4 border-b border-dotted border-gray-300 py-2.5 dark:border-gray-600"
                  >
                    <dt className="text-sm text-gray-700 dark:text-gray-300">
                      {row.left}
                    </dt>
                    <dd
                      className={`font-display text-2xl tabular-nums ${
                        row.stitched === row.mailmark
                          ? "text-gray-400 dark:text-gray-500"
                          : "text-violet-600 dark:text-violet-400"
                      }`}
                    >
                      {row.stitched}
                    </dd>
                  </div>
                ))}
              </dl>

              <h4 className="mb-1 mt-6 font-mono text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                Monthly cost
              </h4>
              <dl>
                {costRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-4 border-b border-dotted border-gray-300 py-2.5 dark:border-gray-600"
                  >
                    <dt className="text-sm text-gray-700 dark:text-gray-300">
                      {row.label}
                    </dt>
                    <dd className="font-display text-lg leading-7 tabular-nums text-gray-700 dark:text-gray-300">
                      {money(row.stitched)}
                    </dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-4 border-t-2 border-gray-300 pt-3 dark:border-gray-600">
                  <dt className="text-sm font-semibold text-gray-900 dark:text-white">
                    Every month
                  </dt>
                  <dd className="font-display text-3xl leading-9 tabular-nums text-violet-600 dark:text-violet-400">
                    {money(stitchedTotal)}
                  </dd>
                </div>
              </dl>
            </div>

            {/* With Mailmark */}
            <div className="bg-white p-6 dark:bg-gray-800">
              <h3 className="mb-4 font-mono text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                With Mailmark
              </h3>
              <dl>
                {countRows.map((row) => (
                  <div
                    key={row.right}
                    className="flex items-baseline justify-between gap-4 border-b border-dotted border-gray-300 py-2.5 dark:border-gray-600"
                  >
                    <dt className="text-sm text-gray-700 dark:text-gray-300">
                      {row.right}
                    </dt>
                    <dd
                      className={`font-display text-2xl tabular-nums ${
                        row.stitched === row.mailmark
                          ? "text-gray-400 dark:text-gray-500"
                          : "text-[#3f6b44] dark:text-[#8fbf95]"
                      }`}
                    >
                      {row.mailmark}
                    </dd>
                  </div>
                ))}
              </dl>

              <h4 className="mb-1 mt-6 font-mono text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                Monthly cost
              </h4>
              <dl>
                {costRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-4 border-b border-dotted border-gray-300 py-2.5 dark:border-gray-600"
                  >
                    <dt className="text-sm text-gray-700 dark:text-gray-300">
                      {row.label}
                    </dt>
                    <dd className="font-mono text-xs leading-7 uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                      Included
                    </dd>
                  </div>
                ))}
                <div className="flex items-baseline justify-between gap-4 border-t-2 border-gray-300 pt-3 dark:border-gray-600">
                  <dt className="text-sm font-semibold text-gray-900 dark:text-white">
                    Every month
                    <span className="ml-2 font-mono text-[0.65rem] font-normal uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400">
                      {plan.name}
                    </span>
                  </dt>
                  <dd className="font-display text-3xl leading-9 tabular-nums text-[#3f6b44] dark:text-[#8fbf95]">
                    {money(plan.price)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Savings */}
          <div className="mt-5 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 rounded-xl bg-gray-50 px-6 py-4 text-center dark:bg-gray-900">
            <span className="text-gray-600 dark:text-gray-400">
              At {products} {products === 1 ? "product" : "products"},
              that&rsquo;s
            </span>
            <span className="font-display text-2xl tabular-nums text-gray-900 dark:text-white">
              {money(monthlySaving)}
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              a month, or {money(monthlySaving * 12)} a year, on tools you
              wouldn&rsquo;t be paying for.
            </span>
          </div>

          <p className="mt-4 font-mono text-[0.72rem] leading-relaxed text-gray-500 dark:text-gray-400">
            Counts assume {MAILBOXES_PER_PRODUCT} mailboxes per product (hello@,
            support@, team@). Costs use approximate US list prices as of August
            2026, taking the cheaper credible option in each category:{" "}
            {money(PRICE_MAILBOX)} per mailbox (Google Workspace Business
            Starter, annual billing), {money(PRICE_SENDING_API)} for a sending
            API (Resend Pro, 50,000 emails), {money(PRICE_CAMPAIGN_TOOL)} for a
            campaign tool (Kit Creator, 1,000 subscribers), {money(PRICE_WARMUP)}{" "}
            per warmed sending address (Warmbox, one per product) and{" "}
            {money(PRICE_MONITORING)} for deliverability monitoring (GlockApps
            Essential). Your own stack will differ. Mailmark plans carry their
            own monthly sending limits.
          </p>
        </div>
      </div>
    </section>
  );
}
