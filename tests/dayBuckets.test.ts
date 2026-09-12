import { describe, expect, test } from "bun:test";
import type { Doc } from "../convex/_generated/dataModel";
import {
  applyEmailToTally,
  dayRows,
  emptyMailboxTally,
} from "../convex/lib/counters";

const at = (iso: string) => Date.parse(iso);

/** A sent email, with only the fields the tally reads. */
const sent = (
  date: string,
  deliveryStatus?: Doc<"emails">["deliveryStatus"]
) =>
  ({
    folder: "sent",
    date: at(date),
    read: true,
    deliveryStatus,
  }) as unknown as Doc<"emails">;

const inbox = (date: string, read = false) =>
  ({ folder: "inbox", date: at(date), read }) as unknown as Doc<"emails">;

describe("day buckets", () => {
  test("a sent message counts once, on the day of its own date", () => {
    const t = emptyMailboxTally();
    applyEmailToTally(t, sent("2026-09-11T19:44:00Z"), 1);
    expect(t.byDay["2026-09-11"].sent).toBe(1);
    expect(t.byDay["2026-09-11"].received).toBe(0);
  });

  test("every delivery outcome is counted in its own field", () => {
    const t = emptyMailboxTally();
    applyEmailToTally(t, sent("2026-09-11T09:00:00Z", "delivered"), 1);
    applyEmailToTally(t, sent("2026-09-11T10:00:00Z", "bounced"), 1);
    applyEmailToTally(t, sent("2026-09-11T11:00:00Z", "failed"), 1);
    applyEmailToTally(t, sent("2026-09-11T12:00:00Z", "complained"), 1);
    const day = t.byDay["2026-09-11"];
    expect(day).toEqual({
      sent: 4,
      received: 0,
      delivered: 1,
      bounced: 1,
      failed: 1,
      complained: 1,
    });
  });

  test("a send with no notification yet counts as sent and nothing else", () => {
    const t = emptyMailboxTally();
    applyEmailToTally(t, sent("2026-09-11T09:00:00Z"), 1);
    expect(t.byDay["2026-09-11"]).toEqual({
      sent: 1,
      received: 0,
      delivered: 0,
      bounced: 0,
      failed: 0,
      complained: 0,
    });
  });

  test("a blocked send counts as sent but as no outcome", () => {
    // It matches byFolder["sent"], which counts the row too, and it is not a
    // bounce or a complaint because nothing ever left.
    const t = emptyMailboxTally();
    applyEmailToTally(t, sent("2026-09-11T09:00:00Z", "blocked"), 1);
    const day = t.byDay["2026-09-11"];
    expect(day.sent).toBe(1);
    expect(day.delivered + day.bounced + day.failed + day.complained).toBe(0);
  });

  test("a delivery notification arriving later moves counts within the send day", () => {
    // What patchEmailCounted does: remove the before, add the after. The
    // notification lands hours later but the message's date has not changed,
    // so both halves hit the same bucket.
    const t = emptyMailboxTally();
    const before = sent("2026-09-11T23:30:00Z", "pending");
    const after = sent("2026-09-11T23:30:00Z", "bounced");
    applyEmailToTally(t, before, 1);
    applyEmailToTally(t, before, -1);
    applyEmailToTally(t, after, 1);

    expect(t.byDay["2026-09-11"]).toEqual({
      sent: 1,
      received: 0,
      delivered: 0,
      bounced: 1,
      failed: 0,
      complained: 0,
    });
    expect(Object.keys(t.byDay)).toEqual(["2026-09-11"]);
  });

  test("inbox mail counts as received whether read or not", () => {
    const t = emptyMailboxTally();
    applyEmailToTally(t, inbox("2026-09-11T08:00:00Z", false), 1);
    applyEmailToTally(t, inbox("2026-09-11T09:00:00Z", true), 1);
    expect(t.byDay["2026-09-11"].received).toBe(2);
    expect(t.byDay["2026-09-11"].sent).toBe(0);
    expect(t.unread).toBe(1);
  });

  test("sent and received share one bucket per day", () => {
    const t = emptyMailboxTally();
    applyEmailToTally(t, sent("2026-09-11T08:00:00Z"), 1);
    applyEmailToTally(t, inbox("2026-09-11T09:00:00Z"), 1);
    expect(t.byDay["2026-09-11"].sent).toBe(1);
    expect(t.byDay["2026-09-11"].received).toBe(1);
  });
});

describe("dayRows", () => {
  test("orders newest first and drops days that fell to zero", () => {
    const t = emptyMailboxTally();
    applyEmailToTally(t, sent("2026-09-09T08:00:00Z"), 1);
    applyEmailToTally(t, sent("2026-09-11T08:00:00Z"), 1);
    // Sent then removed, so the 10th nets to nothing.
    applyEmailToTally(t, sent("2026-09-10T08:00:00Z"), 1);
    applyEmailToTally(t, sent("2026-09-10T08:00:00Z"), -1);

    const rows = dayRows(t.byDay);
    expect(rows.map((r) => r.day)).toEqual(["2026-09-11", "2026-09-09"]);
  });

  test("keeps at most 95 days, discarding the oldest", () => {
    // 95 is sized by the widest window any reader asks for, the 90 day cap on
    // the /v1/bounces days parameter. A reader asking for a window wider than
    // what is kept would silently get a short period reported as a full one.
    const t = emptyMailboxTally();
    const DAY = 86_400_000;
    const first = at("2026-01-01T08:00:00Z");
    for (let d = 0; d < 120; d++) {
      const when = new Date(first + d * DAY).toISOString();
      applyEmailToTally(t, sent(when), 1);
    }
    const rows = dayRows(t.byDay);
    expect(rows).toHaveLength(95);

    // Newest first, and the newest is the 120th day from 1 January.
    const last = new Date(first + 119 * DAY).toISOString().slice(0, 10);
    const oldestKept = new Date(first + 25 * DAY).toISOString().slice(0, 10);
    expect(rows[0].day).toBe(last);
    expect(rows[94].day).toBe(oldestKept);
  });

  test("a 90 day window, the widest any reader asks for, is fully covered", () => {
    const t = emptyMailboxTally();
    const DAY = 86_400_000;
    const now = at("2026-09-12T08:00:00Z");
    for (let d = 0; d < 90; d++) {
      applyEmailToTally(t, sent(new Date(now - d * DAY).toISOString()), 1);
    }
    const rows = dayRows(t.byDay);
    const since = new Date(now - 90 * DAY).toISOString().slice(0, 10);
    const inWindow = rows.filter((r) => r.day >= since);
    expect(inWindow).toHaveLength(90);
    expect(inWindow.reduce((n, r) => n + r.sent, 0)).toBe(90);
  });
});
