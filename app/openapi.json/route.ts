/**
 * The OpenAPI description of the Mailmark API, at the conventional location
 * agents look for it first: https://www.mailmark.dev/openapi.json
 *
 * Also served from /api/openapi.json and /api/openapi.yaml.
 */

import { openApiSpec } from "../../lib/openapi/spec";

export const dynamic = "force-static";

export function GET(): Response {
  return new Response(JSON.stringify(openApiSpec, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export const HEAD = GET;
