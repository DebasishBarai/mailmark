import { describe, expect, test } from "bun:test";
import { commissionDelta } from "../convex/affiliates";

/**
 * Guards a regression the move to Dodo would otherwise have introduced.
 *
 * recordCommission used to add the whole commission to the affiliate's total
 * every time it ran, while only activeReferrals was guarded against running
 * twice. That was survivable on Polar, where it fired once per subscription
 * from subscription.created. Dodo re-fires subscription.active every time an
 * on_hold subscription recovers its payment method, so the unconditional add
 * would have paid an affiliate again for the same referral each time a referred
 * customer's card failed and was fixed.
 */

// 30% of $10 / $50 / $100, matching COMMISSION_CENTS and the rates the
// affiliate program page advertises.
const STARTER = 300;
const PRO = 1500;

describe("commissionDelta", () => {
  test("a first activation counts the whole commission", () => {
    expect(commissionDelta("pending", 0, PRO)).toBe(PRO);
  });

  test("a repeated activation counts nothing", () => {
    // subscription.active arriving again after an on_hold recovery.
    expect(commissionDelta("active", PRO, PRO)).toBe(0);
  });

  test("an upgrade counts only the difference", () => {
    expect(commissionDelta("active", STARTER, PRO)).toBe(PRO - STARTER);
  });

  test("a downgrade gives the difference back", () => {
    expect(commissionDelta("active", PRO, STARTER)).toBe(STARTER - PRO);
  });

  test("resubscribing after a cancel counts the whole commission again", () => {
    // cancelCommission already subtracted the old amount, so the affiliate is
    // back to zero for this referral and the full amount is owed afresh.
    expect(commissionDelta("canceled", PRO, PRO)).toBe(PRO);
  });

  test("a pending referral carrying a stale amount is not double counted", () => {
    // Only "active" means the amount is already in the affiliate's total.
    expect(commissionDelta("pending", PRO, PRO)).toBe(PRO);
  });

  test("repeated activations never accumulate", () => {
    let total = 0;
    let recorded = 0;
    let status = "pending";
    for (let i = 0; i < 5; i++) {
      total += commissionDelta(status, recorded, PRO);
      recorded = PRO;
      status = "active";
    }
    expect(total).toBe(PRO);
  });
});
