import { describe, expect, test } from "bun:test";
import {
  dayKeyOf,
  daysInUtcMonth,
  periodStartDayKey,
} from "../convex/lib/period";

const at = (iso: string) => Date.parse(iso);

describe("dayKeyOf", () => {
  test("is the UTC calendar day, zero padded", () => {
    expect(dayKeyOf(at("2026-09-11T19:44:27.032Z"))).toBe("2026-09-11");
    expect(dayKeyOf(at("2026-01-02T00:00:00.000Z"))).toBe("2026-01-02");
  });

  test("keys sort chronologically as strings, which is what summing relies on", () => {
    const keys = [
      dayKeyOf(at("2026-10-01T00:00:00Z")),
      dayKeyOf(at("2026-09-09T00:00:00Z")),
      dayKeyOf(at("2026-09-10T00:00:00Z")),
    ];
    expect([...keys].sort()).toEqual(["2026-09-09", "2026-09-10", "2026-10-01"]);
  });

  test("late in a UTC day is still that day, not the next one", () => {
    expect(dayKeyOf(at("2026-09-11T23:59:59.999Z"))).toBe("2026-09-11");
  });
});

describe("daysInUtcMonth", () => {
  test("knows the short months and leap years", () => {
    expect(daysInUtcMonth(2026, 0)).toBe(31); // January
    expect(daysInUtcMonth(2026, 1)).toBe(28); // February, common year
    expect(daysInUtcMonth(2028, 1)).toBe(29); // February, leap year
    expect(daysInUtcMonth(2026, 10)).toBe(30); // November
  });
});

describe("periodStartDayKey", () => {
  const started = at("2026-03-18T14:30:00Z");

  test("the anniversary this month, once it has passed", () => {
    expect(periodStartDayKey(started, at("2026-09-25T09:00:00Z"))).toBe(
      "2026-09-18"
    );
  });

  test("the anniversary last month, when this month's has not arrived", () => {
    expect(periodStartDayKey(started, at("2026-09-11T19:44:00Z"))).toBe(
      "2026-08-18"
    );
  });

  test("the anniversary itself starts the new period", () => {
    expect(periodStartDayKey(started, at("2026-09-18T00:00:00Z"))).toBe(
      "2026-09-18"
    );
    // One second before it, the previous period is still running.
    expect(periodStartDayKey(started, at("2026-09-17T23:59:59Z"))).toBe(
      "2026-08-18"
    );
  });

  test("the boundary ignores the time of day startedAt fell on", () => {
    // 14:30 on the 18th, but the reset is midnight on the 18th, so a send at
    // 09:00 that day belongs to the new period rather than the old one.
    expect(periodStartDayKey(started, at("2026-09-18T09:00:00Z"))).toBe(
      "2026-09-18"
    );
  });

  test("an anchor day the month does not have clamps to its last day", () => {
    const endOfMonth = at("2026-01-31T12:00:00Z");
    expect(periodStartDayKey(endOfMonth, at("2026-02-28T12:00:00Z"))).toBe(
      "2026-02-28"
    );
    expect(periodStartDayKey(endOfMonth, at("2026-11-30T12:00:00Z"))).toBe(
      "2026-11-30"
    );
    // A month that does have a 31st uses it.
    expect(periodStartDayKey(endOfMonth, at("2026-03-31T12:00:00Z"))).toBe(
      "2026-03-31"
    );
  });

  test("stepping back across a year boundary", () => {
    const s = at("2025-06-20T00:00:00Z");
    expect(periodStartDayKey(s, at("2026-01-05T00:00:00Z"))).toBe("2025-12-20");
  });

  test("never reports a period that began before the subscription did", () => {
    // Signed up on the 25th, asked on the 26th: the step back would land on
    // the 25th of the month before, which predates the subscription.
    const fresh = at("2026-09-25T10:00:00Z");
    expect(periodStartDayKey(fresh, at("2026-09-26T10:00:00Z"))).toBe(
      "2026-09-25"
    );
    // And on the signup day itself.
    expect(periodStartDayKey(fresh, at("2026-09-25T23:00:00Z"))).toBe(
      "2026-09-25"
    );
  });

  test("no subscription falls back to the calendar month", () => {
    expect(periodStartDayKey(undefined, at("2026-09-11T19:44:00Z"))).toBe(
      "2026-09-01"
    );
    expect(periodStartDayKey(undefined, at("2026-01-01T00:00:00Z"))).toBe(
      "2026-01-01"
    );
  });
});
