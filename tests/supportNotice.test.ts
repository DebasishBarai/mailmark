import { describe, expect, test } from "bun:test";
import { buildSupportNotice } from "../convex/lib/supportNotice";

const base = {
  name: "Jane Smith",
  email: "jane@example.com",
  subject: "Billing question",
  message: "My invoice looks wrong.",
  createdAt: Date.UTC(2026, 0, 2, 3, 4, 5),
};

describe("buildSupportNotice", () => {
  test("names the topic and the sender in the subject", () => {
    expect(buildSupportNotice(base).subject).toBe(
      "[Contact] Billing question from Jane Smith"
    );
  });

  test("carries the message into both bodies", () => {
    const notice = buildSupportNotice(base);
    expect(notice.html).toContain("My invoice looks wrong.");
    expect(notice.text).toContain("My invoice looks wrong.");
    expect(notice.text).toContain("jane@example.com");
  });

  test("escapes markup from every visitor supplied field", () => {
    const notice = buildSupportNotice({
      ...base,
      name: '<img src=x onerror="alert(1)">',
      subject: "a & b",
      message: "<script>alert('xss')</script>",
    });

    expect(notice.html).not.toContain("<script>");
    expect(notice.html).not.toContain("<img src=x");
    expect(notice.html).toContain("&lt;script&gt;");
    expect(notice.html).toContain("a &amp; b");
  });

  test("keeps newlines out of the subject, which becomes a header", () => {
    const notice = buildSupportNotice({
      ...base,
      subject: "Billing\r\nBcc: attacker@example.com",
      name: "Jane\nSmith",
    });

    expect(notice.subject).not.toContain("\n");
    expect(notice.subject).not.toContain("\r");
  });

  test("falls back when name and subject are blank", () => {
    const notice = buildSupportNotice({ ...base, name: "  ", subject: "" });
    expect(notice.subject).toBe("[Contact] No subject from Someone");
  });
});
