/**
 * Day keys and subscription period boundaries.
 *
 * Kept free of any Convex import so it is plain, testable arithmetic. Both the
 * counters that write day buckets and the quota readers that sum them derive
 * their keys from here, so the two can never disagree about where a day or a
 * period begins.
 *
 * Everything is UTC. A period boundary should mean the same instant wherever
 * it is read, and should not move when a deployment's timezone does.
 */

/** The bucket key a timestamp falls in, "YYYY-MM-DD".
 *
 *  Zero padded, so lexical comparison of two keys is chronological comparison
 *  of the days. Summing a period is a string compare per bucket because of it.
 */
export const dayKeyOf = (timestamp: number): string =>
  new Date(timestamp).toISOString().slice(0, 10);

/** Days in a UTC month. Day 0 of the next month is the last day of this one. */
export const daysInUtcMonth = (year: number, monthIndex: number): number =>
  new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

/**
 * First day of the subscription period in progress, as a day key.
 *
 * The send allowance runs over the subscription period, not the calendar
 * month. Every plan bills monthly, so the period is the month anchored on the
 * day of subscriptions.startedAt: a subscription that began on the 18th runs
 * the 18th to the 17th.
 *
 * `startedAt` undefined means the user has no subscription row and is on the
 * free allowance, which has no billing period to anchor to. That falls back to
 * the calendar month, which is what the whole system measured before periods
 * were honoured.
 *
 * The boundary is midnight UTC on the anchor day rather than the exact instant
 * of startedAt, because the counts this is compared against are bucketed by
 * day and a partial day cannot be split out of one. That moves the reset by up
 * to a day from the billing instant, always in the direction of resetting
 * early, which errs towards letting a customer send rather than refusing them.
 *
 * An anchor day that does not exist in the month being landed in, the 31st in
 * November, clamps to the last day of that month.
 */
export function periodStartDayKey(
  startedAt: number | undefined,
  now: number
): string {
  const at = new Date(now);

  if (startedAt === undefined) {
    return dayKeyOf(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  }

  const started = new Date(startedAt);
  const anchorDay = started.getUTCDate();

  // The anniversary in the month now falls in. If it has not arrived yet, the
  // period in progress began on the anniversary in the month before.
  let year = at.getUTCFullYear();
  let month = at.getUTCMonth();
  let day = Math.min(anchorDay, daysInUtcMonth(year, month));
  if (day > at.getUTCDate()) {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
    day = Math.min(anchorDay, daysInUtcMonth(year, month));
  }

  // A subscription cannot have a period that began before the subscription
  // did, which is exactly what the step back above produces in its first month.
  const startedDay = Date.UTC(
    started.getUTCFullYear(),
    started.getUTCMonth(),
    started.getUTCDate()
  );
  return dayKeyOf(Math.max(Date.UTC(year, month, day), startedDay));
}
