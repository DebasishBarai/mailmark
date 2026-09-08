/**
 * /api has no endpoint of its own; the catch-all below it cannot match a bare
 * path, so this returns the same JSON 404 rather than the HTML shell.
 */

import { apiNotFound } from "../../lib/http/apiError";

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
