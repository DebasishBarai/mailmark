/** The OpenAPI document as YAML, for tools that expect
 *  /api/openapi.yaml. Same content as /openapi.json. */

import { openApiSpec } from "../../../lib/openapi/spec";
import { toYaml } from "../../../lib/openapi/yaml";

export const dynamic = "force-static";

export function GET(): Response {
  return new Response(toYaml(openApiSpec), {
    headers: {
      "Content-Type": "application/yaml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export const HEAD = GET;
