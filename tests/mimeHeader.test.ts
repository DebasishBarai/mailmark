import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repairLatin1Mojibake } from "../convex/lib/mimeHeader";

// The Lambda is a standalone .mjs deployed to AWS, not part of the app's
// module graph, so its decoder is pulled out of the source and evaluated here
// rather than imported. Loading the whole file would run the S3 client setup.
function loadDecoder(): (value: string) => string {
  const source = readFileSync(
    join(import.meta.dir, "..", "lambda", "ses-s3-handler.mjs"),
    "utf-8"
  );
  const start = source.indexOf("function decodeMimeHeader");
  const end = source.indexOf("/**\n * Check if the email likely has attachments");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return new Function(`${source.slice(start, end)}\nreturn decodeMimeHeader;`)();
}

const decodeMimeHeader = loadDecoder();

describe("decodeMimeHeader", () => {
  test("a Q-encoded UTF-8 subject keeps its non-ASCII characters", () => {
    expect(
      decodeMimeHeader(
        "=?UTF-8?Q?Application_=E2=80=93_Remote_Worldwide_Product_Designer_=E2=80=93_Nishant_Verma?="
      )
    ).toBe("Application – Remote Worldwide Product Designer – Nishant Verma");
  });

  test("a B-encoded subject decodes, including astral characters", () => {
    expect(decodeMimeHeader("Re: =?UTF-8?B?8J+agCBsYXVuY2g=?= today")).toBe(
      "Re: 🚀 launch today"
    );
  });

  test("a character split across two encoded words survives", () => {
    expect(
      decodeMimeHeader("=?UTF-8?Q?Application_=E2=80?= =?UTF-8?Q?=93_Nishant?=")
    ).toBe("Application – Nishant");
  });

  test("the whitespace between two encoded words is a separator, not text", () => {
    expect(decodeMimeHeader("=?UTF-8?Q?a?= =?UTF-8?Q?b?= plain =?UTF-8?Q?c?=")).toBe(
      "ab plain c"
    );
  });

  test("a charset other than UTF-8 is honoured", () => {
    expect(decodeMimeHeader("=?ISO-8859-1?Q?Caf=E9_r=E9sum=E9?=")).toBe(
      "Café résumé"
    );
  });

  test("plain and empty headers are returned untouched", () => {
    expect(decodeMimeHeader("Plain ASCII subject")).toBe("Plain ASCII subject");
    expect(decodeMimeHeader("")).toBe("");
  });

  test("an encoded display name decodes without losing the address", () => {
    expect(decodeMimeHeader("=?UTF-8?B?TmljaywgTsOpZQ==?= <nick@example.com>")).toBe(
      "Nick, Née <nick@example.com>"
    );
  });

  test("a charset the runtime does not know still yields readable text", () => {
    expect(decodeMimeHeader("=?bogus-charset?Q?hi_=41?=")).toBe("hi A");
  });
});

describe("repairLatin1Mojibake", () => {
  test("a subject stored by the old decoder is recovered exactly", () => {
    const stored = "Application â Nishant Verma";
    expect(repairLatin1Mojibake(stored)).toBe("Application – Nishant Verma");
  });

  test("text that was never damaged is left alone", () => {
    expect(repairLatin1Mojibake("Plain ASCII subject")).toBeNull();
    expect(repairLatin1Mojibake("Application – Nishant Verma")).toBeNull();
    expect(repairLatin1Mojibake("")).toBeNull();
  });

  test("a genuine Latin-1 subject is not mistaken for mojibake", () => {
    expect(repairLatin1Mojibake("Café résumé")).toBeNull();
  });
});
