import { describe, expect, test } from "bun:test";
import {
  apiError,
  apiErrorBody,
  apiNotFound,
  methodNotAllowed,
} from "../lib/http/apiError";
import { errorCodeFor, jsonResponse } from "../convex/lib/apiResponse";

describe("apiErrorBody", () => {
  test("keeps `error` a plain string, which is what existing clients read", () => {
    const body = apiErrorBody({ code: "invalid_request", message: "Domain is required." });
    expect(body.error).toBe("Domain is required.");
    expect(typeof body.error).toBe("string");
  });

  test("adds the machine-readable fields around it", () => {
    const body = apiErrorBody({ code: "unauthorized", message: "Unauthorized" });
    expect(body).toMatchObject({
      code: "unauthorized",
      message: "Unauthorized",
      status: 401,
      documentation_url: "https://www.mailmark.dev/docs/api",
    });
    expect(body.hint.length).toBeGreaterThan(0);
  });

  test("each code carries its conventional status", () => {
    const cases: Array<[Parameters<typeof apiErrorBody>[0]["code"], number]> = [
      ["invalid_request", 400],
      ["unauthorized", 401],
      ["forbidden", 403],
      ["not_found", 404],
      ["method_not_allowed", 405],
      ["not_acceptable", 406],
      ["conflict", 409],
      ["unprocessable_entity", 422],
      ["rate_limited", 429],
      ["internal_error", 500],
      ["upstream_error", 502],
      ["service_unavailable", 503],
    ];
    for (const [code, status] of cases) {
      expect(apiErrorBody({ code, message: "x" }).status).toBe(status);
    }
  });

  test("an explicit status and hint override the defaults", () => {
    const body = apiErrorBody({
      code: "invalid_request",
      message: "x",
      status: 422,
      hint: "Do the other thing.",
    });
    expect(body.status).toBe(422);
    expect(body.hint).toBe("Do the other thing.");
  });

  test("details are merged into the body", () => {
    const body = apiErrorBody({
      code: "rate_limited",
      message: "Slow down.",
      details: { generationsRemaining: 0 },
    });
    expect(body.generationsRemaining).toBe(0);
  });
});

describe("apiError", () => {
  test("responds as JSON with the code's status and no caching", async () => {
    const response = apiError({ code: "not_found", message: "Nope." });
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ error: "Nope.", code: "not_found" });
  });

  test("extra headers are passed through", () => {
    const response = apiError({
      code: "method_not_allowed",
      message: "x",
      headers: { Allow: "POST" },
    });
    expect(response.headers.get("Allow")).toBe("POST");
  });
});

describe("apiNotFound", () => {
  test("points the caller at the endpoint list", async () => {
    const response = apiNotFound("/api/nope");
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toContain("/api/nope");
    expect(body.code).toBe("not_found");
    expect(body.openapi_url).toBe("https://www.mailmark.dev/openapi.json");
  });
});

describe("methodNotAllowed", () => {
  test("says which methods do work, in the body and the Allow header", async () => {
    const handler = methodNotAllowed(["POST"]);
    const response = await handler(
      new Request("https://www.mailmark.dev/api/tools/validate-emails", { method: "GET" })
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
    const body = await response.json();
    expect(body.code).toBe("method_not_allowed");
    expect(body.error).toContain("GET");
    expect(body.allow).toEqual(["POST"]);
  });
});

describe("the Convex API envelope", () => {
  test("maps statuses to stable codes", () => {
    expect(errorCodeFor(400)).toBe("invalid_request");
    expect(errorCodeFor(401)).toBe("unauthorized");
    expect(errorCodeFor(403)).toBe("forbidden");
    expect(errorCodeFor(404)).toBe("not_found");
    expect(errorCodeFor(409)).toBe("conflict");
    expect(errorCodeFor(422)).toBe("unprocessable_entity");
    expect(errorCodeFor(429)).toBe("rate_limited");
    expect(errorCodeFor(418)).toBe("invalid_request");
    expect(errorCodeFor(500)).toBe("internal_error");
    expect(errorCodeFor(504)).toBe("internal_error");
  });

  test("enriches an error body while leaving `error` exactly as it was", async () => {
    const response = jsonResponse({ error: "Unauthorized" }, 401);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
    expect(body).toMatchObject({
      code: "unauthorized",
      message: "Unauthorized",
      status: 401,
      documentation_url: "https://www.mailmark.dev/docs/api",
    });
    expect(typeof body.hint).toBe("string");
  });

  test("keeps the extra fields an error already carried", async () => {
    const blocked = [{ email: "a@b.com", reason: "suppressed", message: "suppressed" }];
    const body = await jsonResponse({ error: "No eligible recipients.", blocked }, 422).json();
    expect(body.blocked).toEqual(blocked);
    expect(body.code).toBe("unprocessable_entity");
  });

  test("success bodies pass through untouched", async () => {
    const success = { messageId: "abc", status: "queued" };
    expect(await jsonResponse(success, 200).json()).toEqual(success);

    const list = [{ id: "1" }, { id: "2" }];
    expect(await jsonResponse(list, 200).json()).toEqual(list);
  });

  test("an error body without a string `error` is left alone", async () => {
    const body = await jsonResponse({ detail: "no error field" }, 400).json();
    expect(body).toEqual({ detail: "no error field" });
  });

  test("arrays and null bodies at an error status are not mangled", async () => {
    expect(await jsonResponse([], 404).json()).toEqual([]);
    expect(await jsonResponse(null, 500).json()).toBeNull();
  });
});
