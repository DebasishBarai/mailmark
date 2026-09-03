/**
 * MillionVerifier client.
 *
 * Pure fetch, no Convex imports, so it can be pulled into either runtime.
 *
 * Two endpoints are used, and the difference between them is money: the single
 * address API is charged per lookup, while the bulk endpoint is a fraction of
 * that per address. Anything list-shaped (the backfill over 22,024 queued
 * recipients) goes through bulk; the single API is for one address arriving on
 * its own, at contact ingestion or on an interactive compose.
 *
 * Every function here reports failure as data rather than throwing, because
 * "the verifier could not answer" is a routine state the send policy has an
 * explicit rule for, not an exception. The caller must not be able to confuse
 * it with a verdict about the address.
 */

export type MvResult =
  | "ok"
  | "catch_all"
  | "unknown"
  | "invalid"
  | "disposable"
  | "error";

export type MvLookup = {
  email: string;
  result: MvResult;
  subResult?: string;
  /**
   * MillionVerifier's integer verdict: 1 ok, 2 catch_all, 3 unknown, 4 error,
   * 5 disposable, 6 invalid. Preferred over `result` for classification —
   * see normalizeResult.
   */
  resultCode?: number;
  /** Credits remaining, when the response reported it. */
  credits?: number;
  /** Set when result is "error": why we could not get an answer. */
  errorReason?: string;
  /**
   * True when the failure is account- or infrastructure-level (no credits, IP
   * blocked, bad key, internal error) rather than something about this one
   * address. A systemic failure means every remaining call in a batch will
   * fail the same way, so stop rather than paying the latency to find out.
   */
  systemic?: boolean;
};

const SINGLE_API = "https://api.millionverifier.com/api/v3/";
const BULK_API = "https://bulkapi.millionverifier.com/bulkapi/v2";

/**
 * The marker an unset key produces, so a caller can distinguish a deploy that
 * forgot MILLIONVERIFIER_API_KEY from MillionVerifier being down. Both hold
 * sends, but only one of them is fixed by waiting.
 */
export const NOT_CONFIGURED = "not_configured";

/** Absent key holds sends by default; it is never a verdict about an address. */
export function apiKey(): string | null {
  const key = process.env.MILLIONVERIFIER_API_KEY;
  return key && key.length > 0 ? key : null;
}

/** Whether a recorded error came from the key being unset. */
export function isNotConfigured(reason?: string): boolean {
  return reason === NOT_CONFIGURED;
}

/**
 * MillionVerifier's own vocabulary, mapped onto ours.
 *
 * `resultcode` is the authority and the string is only a fallback. The
 * documented codes are 1 ok, 2 catch_all, 3 unknown, 4 error, 5 disposable,
 * 6 invalid, and an integer cannot be reworded the way a label can. The docs
 * and the live API already disagree about wording once: the spec's example
 * for a bad key is "apikey_not_found" while the running service answers
 * "Api key not found".
 *
 * "error" is kept distinct from "unknown" rather than folded into it.
 * "unknown" is a statement about a mailbox that would not answer; "error" is a
 * statement about our own call, and the send policy treats them very
 * differently.
 *
 * resultcode 0 / "unverified" is undocumented in the response enum but the
 * service does emit it (there is a demo key for it, and bulk reports an
 * `unverified` count). It means the address was not checked, most often
 * because credits ran out mid-run, so it maps to "error" — not to a verdict.
 */
function normalizeResult(raw: unknown, code?: number): MvResult {
  switch (code) {
    case 1:
      return "ok";
    case 2:
      return "catch_all";
    case 3:
      return "unknown";
    case 4:
      return "error";
    case 5:
      return "disposable";
    case 6:
      return "invalid";
    case 0:
      return "error";
  }

  switch (String(raw ?? "").toLowerCase()) {
    case "ok":
    case "valid":
      return "ok";
    case "catch_all":
    case "catchall":
      return "catch_all";
    case "disposable":
      return "disposable";
    case "invalid":
      return "invalid";
    case "unknown":
      return "unknown";
    case "unverified":
    default:
      return "error";
  }
}

/**
 * Whether a resultcode-4 failure is about our account rather than the address.
 *
 * Everything the service reports at code 4 is systemic - no credits, IP
 * blocked, unknown key, internal error - except a malformed request, which is
 * our caller's fault for one address and says nothing about the rest of a
 * batch.
 */
function isSystemicFailure(errorText: string): boolean {
  const text = errorText.toLowerCase();
  if (text.includes("no email specified")) return false;
  if (text.includes("invalid_syntax")) return false;
  return true;
}

// Retired in favour of the `systemic` flag on MvLookup, which is derived from
// `resultcode` rather than from the error's wording.
//
// Matching English substrings was wrong in both directions. It missed real
// systemic failures - "IP address blocked", "Internal error" and "No apikey
// specified" matched none of these patterns, so a blocked IP looked like a
// per-address problem and the caller kept hammering every remaining address in
// the batch. And it was hostage to wording that is demonstrably not stable:
// the published spec gives "apikey_not_found" for a rejected key while the
// live service answers "Api key not found".
//
// export function isOutageError(reason?: string): boolean {
//   if (!reason) return false;
//   if (reason === NOT_CONFIGURED) return true;
//   const text = reason.toLowerCase();
//   return (
//     text.includes("credit") ||
//     text.includes("limit") ||
//     text.includes("quota") ||
//     text.includes("api key") ||
//     text.includes("unauthorized") ||
//     text.includes("forbidden") ||
//     text.includes("timeout") ||
//     text.includes("network")
//   );
// }

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Verify one address. Never throws. */
export async function verifyOne(
  email: string,
  timeoutMs = 12000
): Promise<MvLookup> {
  const key = apiKey();
  if (!key) {
    return { email, result: "error", errorReason: NOT_CONFIGURED, systemic: true };
  }

  // The API's own timeout is capped below ours so it answers before we abort.
  const apiTimeout = Math.max(5, Math.floor(timeoutMs / 1000) - 2);
  const url = `${SINGLE_API}?api=${encodeURIComponent(key)}&email=${encodeURIComponent(
    email
  )}&timeout=${apiTimeout}`;

  try {
    const response = await fetchWithTimeout(url, { method: "GET" }, timeoutMs);
    if (!response.ok) {
      return {
        email,
        result: "error",
        errorReason: `HTTP ${response.status}`,
        // 4xx here is a bad key or a blocked IP, 5xx is their side. Neither is
        // fixed by trying the next address.
        systemic: true,
      };
    }
    const body = (await response.json()) as Record<string, unknown>;

    const code =
      typeof body.resultcode === "number" ? body.resultcode : undefined;
    const credits = typeof body.credits === "number" ? body.credits : undefined;
    const normalized = normalizeResult(body.result, code);

    // Call-level problems are reported in an `error` field with HTTP 200, so
    // a non-empty `error` is the failure signal, not the status line.
    const errorField = typeof body.error === "string" ? body.error : "";
    if (errorField || normalized === "error") {
      const reason = errorField || (code === 0 ? "unverified" : "error");
      return {
        email,
        result: "error",
        resultCode: code,
        errorReason: reason,
        credits,
        // An address that was simply never checked (code 0) is treated as
        // systemic: the usual cause is the account running out of credits
        // partway through, and continuing would burn latency on calls that
        // cannot succeed.
        systemic: code === 0 ? true : isSystemicFailure(reason),
      };
    }

    return {
      email: typeof body.email === "string" ? body.email : email,
      result: normalized,
      resultCode: code,
      subResult:
        typeof body.subresult === "string" && body.subresult.length > 0
          ? body.subresult
          : undefined,
      credits,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      email,
      result: "error",
      errorReason: message.includes("abort") ? "timeout" : `network: ${message}`,
      // The network is not per-address: if one call cannot leave the box, the
      // next one will not either.
      systemic: true,
    };
  }
}

// ── Bulk ──

export type BulkUpload =
  | { ok: true; fileId: string }
  | { ok: false; error: string };

/**
 * Submit a list for bulk verification.
 *
 * The payload is a newline-separated file of addresses, which is what the
 * endpoint expects; there is no JSON form of this call.
 */
export async function bulkUpload(
  emails: string[],
  fileName: string
): Promise<BulkUpload> {
  const key = apiKey();
  if (!key) return { ok: false, error: NOT_CONFIGURED };
  if (emails.length === 0) return { ok: false, error: "empty batch" };

  const form = new FormData();
  form.append(
    "file_contents",
    new Blob([emails.join("\n")], { type: "text/plain" }),
    fileName
  );

  try {
    const response = await fetchWithTimeout(
      `${BULK_API}/upload?key=${encodeURIComponent(key)}`,
      { method: "POST", body: form },
      60000
    );
    const text = await response.text();
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { ok: false, error: `unparseable response: ${text.slice(0, 200)}` };
    }

    if (typeof body.error === "string" && body.error.length > 0) {
      return { ok: false, error: body.error };
    }
    const fileId = body.file_id;
    if (fileId === undefined || fileId === null) {
      return { ok: false, error: `no file_id in response: ${text.slice(0, 200)}` };
    }
    return { ok: true, fileId: String(fileId) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `network: ${message}` };
  }
}

export type BulkStatus =
  | {
      ok: true;
      /** MillionVerifier's own status string, e.g. "in_progress", "finished". */
      status: string;
      finished: boolean;
      percent?: number;
      total?: number;
      counts?: Record<string, number>;
    }
  | {
      ok: false;
      error: string;
      /**
       * True when the file will never progress (it ended in "error", or the
       * key is unusable). The caller must stop polling rather than retrying a
       * state that cannot change.
       */
      terminal?: boolean;
    };

export async function bulkStatus(fileId: string): Promise<BulkStatus> {
  const key = apiKey();
  if (!key) return { ok: false, error: NOT_CONFIGURED };

  try {
    const response = await fetchWithTimeout(
      `${BULK_API}/fileinfo?key=${encodeURIComponent(key)}&file_id=${encodeURIComponent(fileId)}`,
      { method: "GET" },
      30000
    );
    const text = await response.text();
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { ok: false, error: `unparseable response: ${text.slice(0, 200)}` };
    }
    if (typeof body.error === "string" && body.error.length > 0) {
      return {
        ok: false,
        error: body.error,
        terminal: /not_found|invalid_api_key|apikey|file_not_found/i.test(
          body.error
        ),
      };
    }

    const status = String(body.status ?? "unknown");
    const numeric = (field: string) =>
      typeof body[field] === "number" ? (body[field] as number) : undefined;

    // The documented states are in_progress, in_queue_to_start, finished,
    // error, canceled and paused. Only the first two are worth waiting on:
    // treating the rest as "not finished yet" left the poller asking every
    // fifteen minutes, forever, about a file that was never going to change.
    //
    // canceled and paused still have partial results worth collecting, and
    // MillionVerifier's own docs say a stopped file's verified rows can be
    // downloaded, so they are reported as finished rather than failed.
    const terminalFailure = status === "error";
    const done =
      status === "finished" ||
      status === "completed" ||
      status === "canceled" ||
      status === "paused";

    if (terminalFailure) {
      return {
        ok: false,
        terminal: true,
        error: `file ended in status "error": ${String(body.error ?? "no detail")}`,
      };
    }

    return {
      ok: true,
      status,
      finished: done,
      percent: numeric("percent"),
      total: numeric("total_rows") ?? numeric("total"),
      counts: {
        ok: numeric("ok") ?? 0,
        catch_all: numeric("catch_all") ?? 0,
        unknown: numeric("unknown") ?? 0,
        invalid: numeric("invalid") ?? 0,
        disposable: numeric("disposable") ?? 0,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `network: ${message}` };
  }
}

export type BulkResults =
  | { ok: true; rows: Array<{ email: string; result: MvResult }> }
  | { ok: false; error: string };

/**
 * Download a finished file's verdicts.
 *
 * The download is CSV. Rows are parsed positionally by header name rather than
 * by column index, because the column set differs between plans and a
 * positional read would silently attribute the wrong field once that changed.
 */
export async function bulkDownload(fileId: string): Promise<BulkResults> {
  const key = apiKey();
  if (!key) return { ok: false, error: NOT_CONFIGURED };

  try {
    const response = await fetchWithTimeout(
      `${BULK_API}/download?key=${encodeURIComponent(key)}&file_id=${encodeURIComponent(fileId)}&filter=all`,
      { method: "GET" },
      120000
    );
    const text = await response.text();
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
    }

    // The endpoint answers 200 with either the report (octet-stream) or a JSON
    // error such as {"error":"invalid_api_key"}. Both look like a successful
    // HTTP call, so the body has to be inspected.
    const trimmed = text.trim();
    if (trimmed.startsWith("{")) {
      try {
        const body = JSON.parse(trimmed) as Record<string, unknown>;
        if (typeof body.error === "string" && body.error.length > 0) {
          return { ok: false, error: body.error };
        }
      } catch {
        // Not JSON after all; fall through and try to parse it as a report.
      }
    }

    const rows = parseBulkCsv(text);

    // An empty parse of a non-empty body is a failure, not an empty report.
    //
    // Treating it as success is how a paid-for file gets silently discarded:
    // the caller marks the batch applied, 5,000 verdicts are thrown away, and
    // the credits are already spent. Anything that is not recognisably a
    // report - a JSON error, an HTML error page, a compressed payload - lands
    // here, and is reported as an error so the batch is retried instead.
    if (rows.length === 0 && trimmed.length > 0) {
      return {
        ok: false,
        error: `unrecognised report body: ${trimmed.slice(0, 200)}`,
      };
    }

    return { ok: true, rows };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `network: ${message}` };
  }
}

/** Split one CSV line, honouring double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

export function parseBulkCsv(
  text: string
): Array<{ email: string; result: MvResult }> {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  let emailIndex = header.indexOf("email");
  let resultIndex = header.indexOf("result");

  // Some exports come back without a header row. Fall back to the documented
  // column order rather than dropping the whole file.
  const hasHeader = emailIndex !== -1 && resultIndex !== -1;
  if (!hasHeader) {
    emailIndex = 0;
    resultIndex = 1;
  }

  const rows: Array<{ email: string; result: MvResult }> = [];
  for (const line of lines.slice(hasHeader ? 1 : 0)) {
    const fields = splitCsvLine(line);
    const email = (fields[emailIndex] ?? "").toLowerCase();
    if (!email || !email.includes("@")) continue;
    rows.push({ email, result: normalizeResult(fields[resultIndex]) });
  }
  return rows;
}
