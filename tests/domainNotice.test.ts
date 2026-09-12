import { describe, expect, test } from "bun:test";
import { expectedRecords } from "../convex/lib/domainNotice";

const base = {
  domain: "example.com",
  region: "ap-south-1",
  dkimTokens: ["tok1", "tok2", "tok3"],
  dkimRecordStatus: [false, false, false],
  mxVerified: false,
  spfVerified: false,
  dmarcVerified: false,
  mailFromMxVerified: false,
  mailFromSpfVerified: false,
};

function valueFor(purpose: string, region = "ap-south-1"): string {
  const row = expectedRecords({ ...base, region }).find(
    (r) => r.purpose === purpose
  );
  if (!row) throw new Error(`no record for purpose ${purpose}`);
  return row.value;
}

describe("expectedRecords SES endpoints", () => {
  // These two hostnames differ by more than a suffix, and getting the MAIL
  // FROM one wrong is invisible from inside the product: our own verifier
  // matched the wrong hostname it published, so the record looked verified
  // while SES never accepted it. Lock both.
  test("custom MAIL FROM points at the amazonses.com feedback endpoint", () => {
    expect(valueFor("MAIL FROM")).toBe("10 feedback-smtp.ap-south-1.amazonses.com");
  });

  test("inbound receiving points at the amazonaws.com endpoint", () => {
    expect(valueFor("Receiving")).toBe("10 inbound-smtp.ap-south-1.amazonaws.com");
  });

  test("both endpoints follow the region they are given", () => {
    expect(valueFor("MAIL FROM", "us-east-1")).toBe(
      "10 feedback-smtp.us-east-1.amazonses.com"
    );
    expect(valueFor("Receiving", "eu-west-1")).toBe(
      "10 inbound-smtp.eu-west-1.amazonaws.com"
    );
  });

  test("DKIM CNAME targets stay on dkim.amazonses.com", () => {
    const dkim = expectedRecords(base).filter((r) =>
      r.purpose.startsWith("DKIM")
    );
    expect(dkim).toHaveLength(3);
    expect(dkim[0].name).toBe("tok1._domainkey");
    expect(dkim[0].value).toBe("tok1.dkim.amazonses.com");
  });
});
