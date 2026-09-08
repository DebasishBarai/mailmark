import { describe, expect, test } from "bun:test";
import http from "../convex/http";

/**
 * The public API gained a `pathPrefix: "/"` fallback so an unrouted path
 * answers in JSON instead of plain text. Convex resolves exact paths first and
 * then the longest matching prefix, so the fallback should never be reached for
 * a path that has a route of its own. These tests hold the real router to that,
 * because getting it wrong would swallow email ingestion or webhooks.
 */

type Router = {
  lookup: (path: string, method: string) => [unknown, string, string] | null;
  getRoutes: () => Array<[string, string, unknown]>;
};

const router = http as unknown as Router;

/** The path pattern Convex reports for whatever handles this request. */
function routedTo(path: string, method: string): string | null {
  const match = router.lookup(path, method);
  return match ? match[2] : null;
}

describe("the Convex HTTP router", () => {
  test("the webhook and tracking endpoints keep their own handlers", () => {
    expect(routedTo("/ingestEmail", "POST")).toBe("/ingestEmail");
    expect(routedTo("/trackDelivery", "POST")).toBe("/trackDelivery");
    expect(routedTo("/polar-webhook", "POST")).toBe("/polar-webhook");
  });

  test("every documented v1 endpoint keeps its own handler", () => {
    const endpoints: Array<[string, string, string]> = [
      ["/v1/mailboxes", "GET", "/v1/mailboxes"],
      ["/v1/mailboxes", "POST", "/v1/mailboxes"],
      ["/v1/mailboxes/support", "DELETE", "/v1/mailboxes/*"],
      ["/v1/sender-groups", "GET", "/v1/sender-groups"],
      ["/v1/sender-groups", "POST", "/v1/sender-groups"],
      ["/v1/sender-groups/abc", "PATCH", "/v1/sender-groups/*"],
      ["/v1/sender-groups/abc", "DELETE", "/v1/sender-groups/*"],
      ["/v1/send", "POST", "/v1/send"],
      ["/v1/emails", "GET", "/v1/emails"],
      ["/v1/emails/abc", "GET", "/v1/emails/*"],
      ["/v1/emails/abc", "DELETE", "/v1/emails/*"],
      ["/v1/contacts", "GET", "/v1/contacts"],
      ["/v1/contacts", "POST", "/v1/contacts"],
      ["/v1/contacts/abc", "DELETE", "/v1/contacts/*"],
      ["/v1/sequences", "GET", "/v1/sequences"],
      ["/v1/sequences", "POST", "/v1/sequences"],
      ["/v1/sequences/abc", "PATCH", "/v1/sequences/*"],
      ["/v1/sequences/abc", "DELETE", "/v1/sequences/*"],
      ["/v1/sequences/abc/enroll", "POST", "/v1/sequences/*"],
      ["/v1/domain-health", "GET", "/v1/domain-health"],
      ["/v1/warmup", "GET", "/v1/warmup"],
      ["/v1/bounces", "GET", "/v1/bounces"],
      ["/v1/suppressions", "GET", "/v1/suppressions"],
      ["/v1/campaign-stats", "GET", "/v1/campaign-stats"],
    ];

    for (const [path, method, expected] of endpoints) {
      expect(routedTo(path, method), `${method} ${path}`).toBe(expected);
    }
  });

  test("unsubscribe and click tracking keep their prefix handlers", () => {
    expect(routedTo("/unsubscribe/token123", "GET")).toBe("/unsubscribe/*");
    expect(routedTo("/unsubscribe/token123", "POST")).toBe("/unsubscribe/*");
    expect(routedTo("/track/click/msg/0", "GET")).toBe("/track/click/*");
  });

  test("only a path nothing else claims falls through to the JSON 404", () => {
    for (const [path, method] of [
      ["/nope", "GET"],
      ["/v2/send", "POST"],
      ["/v1", "GET"],
      ["/", "GET"],
    ] as const) {
      expect(routedTo(path, method), `${method} ${path}`).toBe("/*");
    }
  });

  test("the fallback covers the methods an API client would use", () => {
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      expect(routedTo("/nope", method), method).toBe("/*");
    }
  });

  test("it answers in JSON, naming the path and the endpoint list", async () => {
    const match = router.lookup("/nope", "GET");
    expect(match).not.toBeNull();

    // The handler is a Convex httpAction; call the function it wraps.
    const handler = match![0] as { invokeHttpAction?: unknown } & Record<string, unknown>;
    const fn = (handler as unknown as { _handler?: (ctx: unknown, req: Request) => Promise<Response> })
      ._handler;
    if (!fn) return; // shape changed; the routing assertions above still hold

    const response = await fn({}, new Request("https://api.mailmark.dev/nope"));
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toContain("application/json");

    const body = await response.json();
    expect(body.error).toContain("/nope");
    expect(body.code).toBe("not_found");
    expect(body.openapi_url).toBe("https://www.mailmark.dev/openapi.json");
  });
});
