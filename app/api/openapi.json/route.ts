/** The same OpenAPI document as /openapi.json, under /api for agents that
 *  look there first. */

import { openApiSpec } from "../../../lib/openapi/spec";

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
