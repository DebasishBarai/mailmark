import { describe, expect, test } from "bun:test";
import { simpleParser } from "mailparser";
import { formatSender } from "../convex/lib/mimeHeader";

// The premise of internal.ses.repairSubjectsFromS3: for the subjects the old
// Lambda mangled, the raw message in S3 still yields the exact text, so a
// reread is worth the GetObject. These are real shapes from the inbox, folded
// and split the way senders actually send them.
function rawMessage(
  subjectHeaderLines: string[],
  fromHeader = "From: Applicant <applicant@example.com>"
): Buffer {
  return Buffer.from(
    [
      fromHeader,
      "To: jobs@mailmark.dev",
      ...subjectHeaderLines,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "",
      "Body.",
      "",
    ].join("\r\n"),
    "utf-8"
  );
}

describe("subjects read back from the raw message", () => {
  test("a name split across two encoded words keeps no space in it", async () => {
    // What the old decoder stored for this: "Nilambar Beh era".
    const raw = rawMessage([
      "Subject: =?UTF-8?Q?Application_=E2=80=94_Full-Stack_Engineer_=E2=80=94_Nilambar_Beh?=",
      " =?UTF-8?Q?era?=",
    ]);
    expect((await simpleParser(raw)).subject).toBe(
      "Application — Full-Stack Engineer — Nilambar Behera"
    );
  });

  test("a multi-byte character split across two encoded words survives", async () => {
    const raw = rawMessage([
      "Subject: =?UTF-8?Q?Junior_Software_Engineer_/_Full_Stack_=E2=80=93_Kevin_L=C3=BC?=",
      " =?UTF-8?Q?beck?=",
    ]);
    expect((await simpleParser(raw)).subject).toBe(
      "Junior Software Engineer / Full Stack – Kevin Lübeck"
    );
  });

  test("a space the sender actually typed is kept", async () => {
    const raw = rawMessage([
      "Subject: =?UTF-8?Q?Product_Designer_=E2=80=94_Remote_Worldwide?=",
      " =?UTF-8?Q?_=E2=80=94_Johanes_Antonius?=",
    ]);
    expect((await simpleParser(raw)).subject).toBe(
      "Product Designer — Remote Worldwide — Johanes Antonius"
    );
  });

  test("a plain unencoded subject folded across lines joins with one space", async () => {
    const raw = rawMessage([
      "Subject: Full-Stack Software Engineer",
      " Worldwide Remote",
    ]);
    expect((await simpleParser(raw)).subject).toBe(
      "Full-Stack Software Engineer Worldwide Remote"
    );
  });
});

describe("sender display names read back from the raw message", () => {
  // The Lambda copies deployed today store From undecoded, so the message list
  // showed the encoded word itself as the sender's name. This is the header
  // from that message, verbatim.
  test("an encoded display name decodes, address intact", async () => {
    const raw = rawMessage(
      ["Subject: Welcome to MillionVerifier"],
      "From: =?UTF-8?q?Tam=C3=A1s_H=C3=A1m-Szab=C3=B3_from_MillionVerifier?= <tamas@millionverifier.com>"
    );
    const parsed = await simpleParser(raw);
    expect(formatSender(parsed.from?.value)).toBe(
      "Tamás Hám-Szabó from MillionVerifier <tamas@millionverifier.com>"
    );
  });

  test("a plain display name is returned unchanged", async () => {
    const raw = rawMessage(
      ["Subject: Hello"],
      "From: Nick <nick@example.com>"
    );
    const parsed = await simpleParser(raw);
    expect(formatSender(parsed.from?.value)).toBe("Nick <nick@example.com>");
  });

  // getDisplayName splits on "Name <address>" and getRawEmail takes what is
  // inside the brackets, so both keep working on the decoded value.
  test("the decoded value still splits into a name and an address", async () => {
    const raw = rawMessage(
      ["Subject: Hello"],
      "From: =?UTF-8?B?VGFtw6Fz?= <tamas@millionverifier.com>"
    );
    const text = formatSender((await simpleParser(raw)).from?.value);
    const match = text.match(/^(.+?)\s*<([^>]+)>$/);
    expect(match?.[1]).toBe("Tamás");
    expect(match?.[2]).toBe("tamas@millionverifier.com");
  });
});

describe("formatSender", () => {
  test("an address with no display name is returned bare", () => {
    expect(formatSender([{ address: "nick@example.com" }])).toBe(
      "nick@example.com"
    );
  });

  test("several addresses stay comma separated", () => {
    expect(
      formatSender([
        { name: "Nick", address: "nick@example.com" },
        { address: "jane@example.com" },
      ])
    ).toBe("Nick <nick@example.com>, jane@example.com");
  });

  test("a missing or empty field yields an empty string", () => {
    expect(formatSender(undefined)).toBe("");
    expect(formatSender([])).toBe("");
    expect(formatSender([{ name: "No Address" }])).toBe("");
  });
});
