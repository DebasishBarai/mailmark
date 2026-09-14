import { describe, expect, test } from "bun:test";
import {
  MAIL_FROM_RETRY_COOLDOWN_MS,
  canRetryMailFrom,
  mailFromCheckStopped,
  retryCooldownRemainingMs,
} from "../convex/lib/mailFromRetry";

describe("mailFromCheckStopped", () => {
  test("PENDING means SES is still polling, so nothing to retry", () => {
    expect(mailFromCheckStopped("PENDING")).toBe(false);
  });

  test("SUCCESS needs no retry", () => {
    expect(mailFromCheckStopped("SUCCESS")).toBe(false);
  });

  test("FAILED means SES gave up and will not look again", () => {
    expect(mailFromCheckStopped("FAILED")).toBe(true);
  });

  test("TEMPORARY_FAILURE is also stopped", () => {
    expect(mailFromCheckStopped("TEMPORARY_FAILURE")).toBe(true);
  });

  test("a domain never checked carries no status", () => {
    expect(mailFromCheckStopped(undefined)).toBe(false);
  });
});

describe("canRetryMailFrom", () => {
  test("offered once SES stopped and our own lookup agrees", () => {
    expect(
      canRetryMailFrom({ sesMailFromStatus: "FAILED", mailFromMxVerified: true })
    ).toBe(true);
  });

  test("withheld while the record is still wrong in DNS", () => {
    expect(
      canRetryMailFrom({ sesMailFromStatus: "FAILED", mailFromMxVerified: false })
    ).toBe(false);
  });

  test("withheld while SES is still polling, even with correct DNS", () => {
    expect(
      canRetryMailFrom({ sesMailFromStatus: "PENDING", mailFromMxVerified: true })
    ).toBe(false);
  });

  test("withheld once SES reports success", () => {
    expect(
      canRetryMailFrom({ sesMailFromStatus: "SUCCESS", mailFromMxVerified: true })
    ).toBe(false);
  });

  test("a missing mailFromMxVerified reads as not verified", () => {
    expect(canRetryMailFrom({ sesMailFromStatus: "FAILED" })).toBe(false);
  });
});

describe("retryCooldownRemainingMs", () => {
  const now = 1_700_000_000_000;

  test("a domain never retried is not held back", () => {
    expect(retryCooldownRemainingMs(undefined, now)).toBe(0);
  });

  test("a retry just made holds the full window", () => {
    expect(retryCooldownRemainingMs(now, now)).toBe(MAIL_FROM_RETRY_COOLDOWN_MS);
  });

  test("time already served comes off the remainder", () => {
    const fiveMinutes = 5 * 60 * 1000;
    expect(retryCooldownRemainingMs(now - fiveMinutes, now)).toBe(
      MAIL_FROM_RETRY_COOLDOWN_MS - fiveMinutes
    );
  });

  test("an elapsed cooldown never reports negative time", () => {
    expect(
      retryCooldownRemainingMs(now - MAIL_FROM_RETRY_COOLDOWN_MS - 1, now)
    ).toBe(0);
  });
});
