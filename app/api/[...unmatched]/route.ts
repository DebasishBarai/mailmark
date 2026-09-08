/**
 * The fallback for any /api path with no route of its own.
 *
 * Static segments win over a catch-all in the App Router, so this only ever
 * runs for paths nothing else claims. Without it an unknown /api/... path fell
 * through to the HTML 404 shell, which an API client cannot parse.
 */

import { apiNotFound } from "../../../lib/http/apiError";

async function handler(request: Request): Promise<Response> {
  return apiNotFound(new URL(request.url).pathname);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;
