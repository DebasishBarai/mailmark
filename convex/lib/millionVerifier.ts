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
  /** Credits remaining, when the response reported it. */
  credits?: number;
  /** Set when result is "error": why we could not get an answer. */
  errorReason?: string;
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
 * It returns "error" for a lookup it could not complete, which we keep as
 * "error" rather than folding into "unknown": "unknown" is a statement about a
 * mailbox that would not answer, "error" is a statement about our call, and
 * the policy treats them very differently.
 */
function normalizeResult(raw: unknown): MvResult {
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
    default:
      return "error";
  }
}

/**
 * An error string that means "stop calling us", as opposed to one about this
 * particular address. Out of credits and rate limits both fall here: the right
 * response is to back off, not to treat every address in the batch as bad.
 */
export function isOutageError(reason?: string): boolean {
  if (!reason) return false;
  // An unset key belongs here too. It is not an incident, but it has the same
  // shape as one for control flow: every remaining call in the batch will fail
  // identically, so stop rather than retrying each address in turn.
  if (reason === NOT_CONFIGURED) return true;
  const text = reason.toLowerCase();
  return (
    text.includes("credit") ||
    text.includes("limit") ||
    text.includes("quota") ||
    text.includes("api key") ||
    text.includes("unauthorized") ||
    text.includes("forbidden") ||
    text.includes("timeout") ||
    text.includes("network")
  );
}

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
    return {
      email,
      result: "error",
      errorReason: NOT_CONFIGURED,
    };
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
      };
    }
    const body = (await response.json()) as Record<string, unknown>;

    // MillionVerifier reports call-level problems in an `error` field while
    // still returning HTTP 200.
    const errorField = typeof body.error === "string" ? body.error : "";
    if (errorField) {
      return {
        email,
        result: "error",
        errorReason: errorField,
        credits: typeof body.credits === "number" ? body.credits : undefined,
      };
    }

    return {
      email: typeof body.email === "string" ? body.email : email,
      result: normalizeResult(body.result),
      subResult:
        typeof body.subresult === "string" && body.subresult.length > 0
          ? body.subresult
          : undefined,
      credits: typeof body.credits === "number" ? body.credits : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      email,
      result: "error",
      // An abort is a timeout; say so, because isOutageError keys off it.
      errorReason: message.includes("abort") ? "timeout" : `network: ${message}`,
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
  | { ok: false; error: string };

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
      return { ok: false, error: body.error };
    }

    const status = String(body.status ?? "unknown");
    const numeric = (field: string) =>
      typeof body[field] === "number" ? (body[field] as number) : undefined;

    return {
      ok: true,
      status,
      finished: status === "finished" || status === "completed",
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
    return { ok: true, rows: parseBulkCsv(text) };
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
