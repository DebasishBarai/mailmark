/**
 * The JSON envelope every response from the public REST API uses.
 *
 * Kept out of http.ts so it can be tested on its own, without the Convex
 * runtime.
 */

/** Stable, machine-readable code per status, so a caller can branch without
 *  parsing the English in `error`. */
export function errorCodeFor(status: number): string {
  switch (status) {
    case 400: return "invalid_request";
    case 401: return "unauthorized";
    case 403: return "forbidden";
    case 404: return "not_found";
    case 405: return "method_not_allowed";
    case 409: return "conflict";
    case 422: return "unprocessable_entity";
    case 429: return "rate_limited";
    case 502: return "upstream_error";
    case 503: return "service_unavailable";
    default: return status >= 500 ? "internal_error" : "invalid_request";
  }
}

export const ERROR_HINTS: Record<string, string> = {
  invalid_request:
    "Check the request body and query parameters against https://www.mailmark.dev/docs/api.",
  unauthorized:
    'Pass a valid API key as "Authorization: Bearer dm_live_...". Keys are created in Dashboard -> Developer.',
  forbidden:
    "The key is valid but not scoped for this. Domain-scoped keys only reach their own domain; org-wide keys cannot write. See https://www.mailmark.dev/docs/api#authentication.",
  not_found:
    "Check the path and any identifiers in it. The endpoint list is at https://www.mailmark.dev/openapi.json.",
  method_not_allowed: "Use one of the methods documented for this path.",
  conflict: "The resource already exists or is in a state that blocks this change.",
  unprocessable_entity:
    "The request was understood but cannot be completed as written. This is permanent; do not retry unchanged.",
  rate_limited: "Wait for the window to reset and retry with backoff.",
  upstream_error: "An upstream service failed. Retry with backoff.",
  service_unavailable: "The dependency this endpoint needs is unavailable. Retry later.",
  internal_error:
    "Retry with exponential backoff. If it persists, contact support@mailmark.dev with the time of the request.",
};

/**
 * Every JSON response the API returns.
 *
 * Error bodies used to be `{ "error": "..." }` and nothing else, which left an
 * agent guessing from prose. An error body is now enriched in place: `error`
 * keeps the exact same string (so existing clients and the SDK are unaffected)
 * and gains `code`, `message`, `hint`, `status` and `documentation_url`
 * alongside it. Success bodies pass through untouched.
 *
 * Old:
 *   return new Response(JSON.stringify(body), { status, headers: {...} });
 */
export function jsonResponse(body: unknown, status: number) {
  let payload = body;

  if (
    status >= 400 &&
    body !== null &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    typeof (body as { error?: unknown }).error === "string"
  ) {
    const message = (body as { error: string }).error;
    const code = errorCodeFor(status);
    payload = {
      ...(body as Record<string, unknown>),
      code,
      message,
      hint: ERROR_HINTS[code],
      status,
      documentation_url: "https://www.mailmark.dev/docs/api",
    };
  }

  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
