import { describe, expect, test } from "bun:test";
import {
  normalizeUrl,
  isKnownHeardAbout,
  buildJobApplicationNotice,
  buildApplicantAcknowledgement,
  OPEN_APPLICATION,
} from "../convex/lib/jobApplication";

describe("normalizeUrl", () => {
  test("keeps http and https links", () => {
    expect(normalizeUrl("https://github.com/jane")).toBe("https://github.com/jane");
    expect(normalizeUrl("http://example.com/cv.pdf")).toBe("http://example.com/cv.pdf");
  });

  test("fills in a missing scheme, which is what people type", () => {
    expect(normalizeUrl("linkedin.com/in/jane")).toBe("https://linkedin.com/in/jane");
  });

  test("refuses schemes that would be dangerous as an href", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(normalizeUrl("mailto:jane@example.com")).toBeNull();
    expect(normalizeUrl("file:///etc/passwd")).toBeNull();
  });

  test("refuses prose, blanks and hostnames without a dot", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("   ")).toBeNull();
    expect(normalizeUrl("see my site: example.com")).toBeNull();
    expect(normalizeUrl("localhost")).toBeNull();
  });

  test("refuses a link longer than the cap", () => {
    expect(normalizeUrl(`https://example.com/${"a".repeat(600)}`)).toBeNull();
  });
});

describe("isKnownHeardAbout", () => {
  test("accepts an answer from the list and nothing else", () => {
    expect(isKnownHeardAbout("Google search")).toBe(true);
    expect(isKnownHeardAbout("X / Twitter")).toBe(true);
    expect(isKnownHeardAbout("A billboard")).toBe(false);
    expect(isKnownHeardAbout("")).toBe(false);
  });
});

const base = {
  name: "Jane Smith",
  email: "jane@example.com",
  role: "Product Designer",
  location: "Lisbon (UTC+1)",
  profileUrl: "https://github.com/jane",
  resumeUrl: "https://example.com/cv.pdf",
  heardAbout: "Google search",
  note: "I designed the thing.",
  createdAt: Date.UTC(2026, 0, 2, 3, 4, 5),
};

describe("buildJobApplicationNotice", () => {
  test("names the role and the applicant in the subject", () => {
    expect(buildJobApplicationNotice(base).subject).toBe(
      "[Careers] Product Designer: Jane Smith"
    );
  });

  test("carries the answers into both bodies", () => {
    const notice = buildJobApplicationNotice(base);
    expect(notice.html).toContain("I designed the thing.");
    expect(notice.html).toContain("Google search");
    expect(notice.text).toContain("Heard about us: Google search");
    expect(notice.text).toContain("https://example.com/cv.pdf");
  });

  test("omits the resume row when no link was given", () => {
    const notice = buildJobApplicationNotice({ ...base, resumeUrl: undefined });
    expect(notice.text).not.toContain("Resume:");
  });

  test("escapes markup from every applicant supplied field", () => {
    const notice = buildJobApplicationNotice({
      ...base,
      name: '<img src=x onerror="alert(1)">',
      note: "<script>alert('xss')</script>",
      location: "a & b",
    });

    expect(notice.html).not.toContain("<script>");
    expect(notice.html).not.toContain("<img src=x");
    expect(notice.html).toContain("&lt;script&gt;");
    expect(notice.html).toContain("a &amp; b");
  });

  test("keeps newlines out of the subject, which becomes a header", () => {
    const notice = buildJobApplicationNotice({
      ...base,
      role: "Designer\r\nBcc: attacker@example.com",
    });

    expect(notice.subject).not.toContain("\n");
    expect(notice.subject).not.toContain("\r");
  });
});

describe("buildApplicantAcknowledgement", () => {
  const jobsEmail = "jobs@mailmark.dev";

  test("names the role in the subject and greets by first name", () => {
    const notice = buildApplicantAcknowledgement(base, { jobsEmail });
    expect(notice.subject).toBe(
      "We received your application for Product Designer"
    );
    expect(notice.text.startsWith("Hi Jane,")).toBe(true);
  });

  test("tells them where a reply lands", () => {
    const notice = buildApplicantAcknowledgement(base, { jobsEmail });
    expect(notice.text).toContain(jobsEmail);
    expect(notice.html).toContain("jobs@mailmark.dev");
  });

  test("carries nothing the applicant wrote beyond their name and role", () => {
    const notice = buildApplicantAcknowledgement(
      { name: base.name, role: base.role },
      { jobsEmail }
    );
    expect(notice.text).not.toContain(base.note);
    expect(notice.text).not.toContain(base.profileUrl);
    expect(notice.text).not.toContain(base.resumeUrl);
  });

  test("escapes a name carrying markup", () => {
    const notice = buildApplicantAcknowledgement(
      { name: '<img src=x onerror="alert(1)">', role: base.role },
      { jobsEmail }
    );
    expect(notice.html).not.toContain("<img src=x");
    expect(notice.html).toContain("&lt;img");
  });

  test("falls back to a plain greeting when the name is unusable", () => {
    for (const name of ["", "   ", "a".repeat(60)]) {
      const notice = buildApplicantAcknowledgement(
        { name, role: base.role },
        { jobsEmail }
      );
      expect(notice.text.startsWith("Hi,")).toBe(true);
    }
  });

  test("keeps newlines out of the subject, which becomes a header", () => {
    const notice = buildApplicantAcknowledgement(
      { name: base.name, role: "Designer\r\nBcc: attacker@example.com" },
      { jobsEmail }
    );
    expect(notice.subject).not.toContain("\n");
    expect(notice.subject).not.toContain("\r");
  });
});

describe("the open application wording", () => {
  test("does not read as a role name", () => {
    const notice = buildApplicantAcknowledgement(
      { name: "Jane Smith", role: OPEN_APPLICATION },
      { jobsEmail: "jobs@mailmark.dev" }
    );
    expect(notice.subject).toBe("We received your application");
    expect(notice.text).not.toContain("application for Open application");
  });

  test("an empty role is treated the same way", () => {
    const notice = buildApplicantAcknowledgement(
      { name: "Jane Smith", role: "" },
      { jobsEmail: "jobs@mailmark.dev" }
    );
    expect(notice.subject).toBe("We received your application");
  });
});
