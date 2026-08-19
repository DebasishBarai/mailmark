"use client";

import { useState } from "react";

// Assumptions behind the numbers, spelled out in the footnote below so the
// comparison stays honest: three mailboxes per product, and a stitched-together
// stack of five tools (domain mail hosting, a sending API, a campaign tool, a
// warm-up service and a deliverability monitor).
const MAILBOXES_PER_PRODUCT = 3;
const STITCHED_TOOL_COUNT = 5;

const MIN_PRODUCTS = 1;
const MAX_PRODUCTS = 10;

export default function Arithmetic() {
  const [products, setProducts] = useState(4);

  const mailboxes = products * MAILBOXES_PER_PRODUCT;

  const stitched = [
    { label: "DNS panels to configure & keep valid", value: products },
    { label: "Mailboxes to create and watch", value: mailboxes },
    { label: "Separate tools & logins", value: STITCHED_TOOL_COUNT },
    { label: "Places a user reply can land", value: mailboxes },
    { label: "Separate bills each month", value: STITCHED_TOOL_COUNT },
  ];

  const withMailmark = [
    { label: "DNS setup, guided & auto-verified", value: products },
    { label: "Mailboxes, unlimited on Pro", value: mailboxes },
    { label: "Separate tools & logins", value: 1 },
    { label: "Places a user reply can land", value: 1 },
    { label: "Separate bills each month", value: 1 },
  ];

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
            <div className="border-b border-gray-200 bg-violet-50/60 p-6 dark:border-gray-700 dark:bg-violet-950/20 sm:border-b-0 sm:border-r">
              <h3 className="mb-4 font-mono text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                Stitching it together yourself
              </h3>
              <dl>
                {stitched.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-4 border-b border-dotted border-gray-300 py-2.5 last:border-b-0 dark:border-gray-600"
                  >
                    <dt className="text-sm text-gray-700 dark:text-gray-300">
                      {row.label}
                    </dt>
                    <dd className="font-display text-2xl tabular-nums text-violet-600 dark:text-violet-400">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="bg-white p-6 dark:bg-gray-800">
              <h3 className="mb-4 font-mono text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                With Mailmark
              </h3>
              <dl>
                {withMailmark.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-baseline justify-between gap-4 border-b border-dotted border-gray-300 py-2.5 last:border-b-0 dark:border-gray-600"
                  >
                    <dt className="text-sm text-gray-700 dark:text-gray-300">
                      {row.label}
                    </dt>
                    <dd className="font-display text-2xl tabular-nums text-[#3f6b44] dark:text-[#8fbf95]">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <p className="mt-4 font-mono text-[0.72rem] leading-relaxed text-gray-500 dark:text-gray-400">
            Assumes {MAILBOXES_PER_PRODUCT} mailboxes per product (hello@,
            support@, team@) and a typical stack of domain mail hosting, a
            sending API, a campaign tool, a warm-up service and a deliverability
            monitor.
          </p>
        </div>
      </div>
    </section>
  );
}
