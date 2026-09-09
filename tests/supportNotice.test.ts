import { describe, expect, test } from "bun:test";
import {
  buildSupportNotice,
  buildSupportAcknowledgement,
} from "../convex/lib/supportNotice";

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

describe("buildSupportAcknowledgement", () => {
  const supportEmail = "support@mailmark.dev";

  test("names the topic in the subject and greets by first name", () => {
    const notice = buildSupportAcknowledgement(base, { supportEmail });
    expect(notice.subject).toBe(
      "We received your message about Billing question"
    );
    expect(notice.text.startsWith("Hi Jane,")).toBe(true);
  });

  test("drops the topic from the subject when there is none", () => {
    const notice = buildSupportAcknowledgement(
      { name: base.name, subject: "  " },
      { supportEmail }
    );
    expect(notice.subject).toBe("We received your message");
  });

  test("tells them where a reply lands", () => {
    const notice = buildSupportAcknowledgement(base, { supportEmail });
    expect(notice.text).toContain(supportEmail);
  });

  test("does not quote their message back to them", () => {
    const notice = buildSupportAcknowledgement(
      { name: base.name, subject: base.subject },
      { supportEmail }
    );
    expect(notice.text).not.toContain(base.message);
    expect(notice.html).not.toContain(base.message);
  });

  test("escapes a name and a topic carrying markup", () => {
    const notice = buildSupportAcknowledgement(
      {
        name: '<img src=x onerror="alert(1)">',
        subject: "<script>alert('xss')</script>",
      },
      { supportEmail }
    );
    expect(notice.html).not.toContain("<img src=x");
    expect(notice.html).not.toContain("<script>");
    expect(notice.html).toContain("&lt;script&gt;");
  });

  test("falls back to a plain greeting when the name is unusable", () => {
    for (const name of ["", "   ", "a".repeat(60)]) {
      const notice = buildSupportAcknowledgement(
        { name, subject: base.subject },
        { supportEmail }
      );
      expect(notice.text.startsWith("Hi,")).toBe(true);
    }
  });

  test("keeps newlines out of the subject, which becomes a header", () => {
    const notice = buildSupportAcknowledgement(
      { name: base.name, subject: "Billing\r\nBcc: attacker@example.com" },
      { supportEmail }
    );
    expect(notice.subject).not.toContain("\n");
    expect(notice.subject).not.toContain("\r");
  });
});
