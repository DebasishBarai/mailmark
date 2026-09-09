import { describe, expect, test } from "bun:test";
import { simpleParser } from "mailparser";

// The premise of internal.ses.repairSubjectsFromS3: for the subjects the old
// Lambda mangled, the raw message in S3 still yields the exact text, so a
// reread is worth the GetObject. These are real shapes from the inbox, folded
// and split the way senders actually send them.
function rawMessage(subjectHeaderLines: string[]): Buffer {
  return Buffer.from(
    [
      "From: Applicant <applicant@example.com>",
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
