/**
 * The one shape every JSON error on www.mailmark.dev takes.
 *
 * `error` stays a plain string because that is what the existing clients read
 * (`data.error ?? "Something went wrong"`); everything around it is additive,
 * so an agent gets a stable machine-readable code and a resolution hint
 * without any existing caller changing.
 */

import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "method_not_allowed"
  | "not_acceptable"
  | "conflict"
  | "unprocessable_entity"
  | "rate_limited"
  | "internal_error"
  | "service_unavailable"
  | "upstream_error";

export interface ApiErrorBody extends Record<string, unknown> {
  /** Human-readable message. Kept for backwards compatibility. */
  error: string;
  /** Stable identifier to branch on. */
  code: ApiErrorCode;
  /** Same text as `error`, under the name most API clients expect. */
  message: string;
  /** What the caller can do about it. */
  hint: string;
  status: number;
  documentation_url: string;
}

const DOCS_URL = "https://www.mailmark.dev/docs/api";

/** The default resolution hint per code, used when a caller does not give one. */
const DEFAULT_HINTS: Record<ApiErrorCode, string> = {
  invalid_request:
    "Check the request body and query parameters against the endpoint reference at https://www.mailmark.dev/docs/api.",
  unauthorized:
    'Pass a valid API key as "Authorization: Bearer dm_live_...". Keys are created in Dashboard -> Developer.',
  forbidden:
    "The credential is valid but not allowed to do this. Check the key's scope at https://www.mailmark.dev/docs/api#authentication.",
  not_found:
    "Check the path and any identifiers in it. The full endpoint list is at https://www.mailmark.dev/openapi.json.",
  method_not_allowed:
    "Use one of the methods listed in the Allow header for this path.",
  not_acceptable:
    "Ask for a media type this endpoint can produce, such as application/json.",
  conflict: "The resource already exists or is in a state that blocks this change.",
  unprocessable_entity:
    "The request was understood but cannot be completed as written. This is permanent; do not retry unchanged.",
  rate_limited: "Wait for the window to reset and retry with backoff.",
  internal_error:
    "Retry with exponential backoff. If it persists, contact support@mailmark.dev with the time of the request.",
  service_unavailable:
    "The dependency this endpoint needs is not configured or is temporarily down. Retry later.",
  upstream_error:
    "An upstream service failed. Retry with backoff; if it persists, contact support@mailmark.dev.",
};

const DEFAULT_STATUS: Record<ApiErrorCode, number> = {
  invalid_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  method_not_allowed: 405,
  not_acceptable: 406,
  conflict: 409,
  unprocessable_entity: 422,
  rate_limited: 429,
  internal_error: 500,
  service_unavailable: 503,
  upstream_error: 502,
};

export interface ApiErrorOptions {
  code: ApiErrorCode;
  message: string;
  /** Overrides the code's default status. */
  status?: number;
  /** Overrides the code's default resolution hint. */
  hint?: string;
  /** Extra fields merged into the body (e.g. `blocked`, `retryAfter`). */
  details?: Record<string, unknown>;
  /** Response headers to add, such as Allow or Retry-After. */
  headers?: Record<string, string>;
  documentationUrl?: string;
}

/** Builds the JSON body without wrapping it in a Response. */
export function apiErrorBody(options: ApiErrorOptions): ApiErrorBody {
  const status = options.status ?? DEFAULT_STATUS[options.code];

  return {
    error: options.message,
    code: options.code,
    message: options.message,
    hint: options.hint ?? DEFAULT_HINTS[options.code],
    status,
    documentation_url: options.documentationUrl ?? DOCS_URL,
    ...(options.details ?? {}),
  };
}

/** The JSON error response every API route returns. */
export function apiError(options: ApiErrorOptions): NextResponse {
  const body = apiErrorBody(options);

  return NextResponse.json(body, {
    status: body.status,
    headers: {
      "Cache-Control": "no-store",
      ...(options.headers ?? {}),
    },
  });
}

/** The 404 body for any /api path this app does not serve. */
export function apiNotFound(pathname: string): NextResponse {
  return apiError({
    code: "not_found",
    message: `No API endpoint at ${pathname}.`,
    hint: "The endpoints this host serves are described at https://www.mailmark.dev/openapi.json. The authenticated REST API lives on https://api.mailmark.dev.",
    details: {
      path: pathname,
      openapi_url: "https://www.mailmark.dev/openapi.json",
      api_base_url: "https://api.mailmark.dev",
    },
  });
}

/**
 * A handler for a method an endpoint does not implement. Next.js answers those
 * with an empty 405; this says which methods do work, in JSON.
 */
export function methodNotAllowed(allow: string[]) {
  return async function handler(request: Request): Promise<NextResponse> {
    const { pathname } = new URL(request.url);

    return apiError({
      code: "method_not_allowed",
      message: `${request.method} is not supported on ${pathname}.`,
      hint: `Use ${allow.join(" or ")} on this endpoint. See https://www.mailmark.dev/openapi.json.`,
      headers: { Allow: allow.join(", ") },
      details: { path: pathname, allow },
    });
  };
}
