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

  test("bounce kinds are kept apart", () => {
    const t = emptyMailboxTally();
    applyEmailToTally(t, sent("2026-09-11T10:00:00Z", "bounced"), 1);
    applyEmailToTally(t, sent("2026-09-11T11:00:00Z", "failed"), 1);
    applyEmailToTally(t, sent("2026-09-11T12:00:00Z", "complained"), 1);
    const day = t.byDay["2026-09-11"];
    expect(day).toEqual({
      sent: 3,
      received: 0,
      bounced: 1,
      failed: 1,
      complained: 1,
    });
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

  test("keeps at most 45 days, discarding the oldest", () => {
    const t = emptyMailboxTally();
    const DAY = 86_400_000;
    const first = at("2026-07-01T08:00:00Z");
    for (let d = 0; d < 60; d++) {
      const when = new Date(first + d * DAY).toISOString();
      applyEmailToTally(t, sent(when), 1);
    }
    const rows = dayRows(t.byDay);
    expect(rows).toHaveLength(45);
    // 60 days starting 1 July ends on 29 August, and only the newest 45 stay.
    expect(rows[0].day).toBe("2026-08-29");
    expect(rows[44].day).toBe("2026-07-16");
  });
});
