import { describe, expect, test } from "bun:test";
import { API_VERSION, OPENAPI_VERSION, openApiSpec } from "../lib/openapi/spec";
import { toYaml } from "../lib/openapi/yaml";

type Json = Record<string, unknown>;

const spec = openApiSpec as unknown as Json;
const paths = spec.paths as Record<string, Record<string, Json>>;
const components = spec.components as Json;
const schemas = (components.schemas ?? {}) as Json;

const HTTP_METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

function operations(): Array<{ path: string; method: string; operation: Json }> {
  const found: Array<{ path: string; method: string; operation: Json }> = [];
  for (const [path, item] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (HTTP_METHODS.includes(method)) found.push({ path, method, operation });
    }
  }
  return found;
}

/** Every "$ref" string anywhere in the document. */
function refs(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) refs(item, found);
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "$ref" && typeof child === "string") found.push(child);
      else refs(child, found);
    }
  }
  return found;
}

describe("the OpenAPI document", () => {
  test("declares a supported OpenAPI version and its own version", () => {
    expect(spec.openapi).toBe(OPENAPI_VERSION);
    expect(OPENAPI_VERSION.startsWith("3.")).toBe(true);
    expect((spec.info as Json).version).toBe(API_VERSION);
  });

  test("has the info a client needs to identify the API", () => {
    const info = spec.info as Json;
    expect(info.title).toBe("Mailmark API");
    expect(typeof info.description).toBe("string");
    expect((info.contact as Json).email).toBe("support@mailmark.dev");
  });

  test("names both servers", () => {
    const urls = (spec.servers as Json[]).map((server) => server.url);
    expect(urls).toContain("https://api.mailmark.dev");
    expect(urls).toContain("https://www.mailmark.dev");
  });

  test("declares bearer authentication and applies it by default", () => {
    const schemes = (components.securitySchemes as Json).bearerAuth as Json;
    expect(schemes.type).toBe("http");
    expect(schemes.scheme).toBe("bearer");
    expect(spec.security).toEqual([{ bearerAuth: [] }]);
  });

  test("every path is rooted and every operation is described", () => {
    for (const { path, method, operation } of operations()) {
      expect(path.startsWith("/")).toBe(true);
      expect(typeof operation.operationId, `${method} ${path}`).toBe("string");
      expect(typeof operation.summary, `${method} ${path}`).toBe("string");
      expect(Object.keys(operation.responses as Json).length).toBeGreaterThan(0);
    }
  });

  test("operation ids are unique", () => {
    const ids = operations().map(({ operation }) => operation.operationId as string);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("covers the endpoints the REST API actually serves", () => {
    for (const path of [
      "/v1/mailboxes",
      "/v1/mailboxes/{address}",
      "/v1/sender-groups",
      "/v1/sender-groups/{id}",
      "/v1/send",
      "/v1/emails",
      "/v1/emails/{id}",
      "/v1/contacts",
      "/v1/contacts/{id}",
      "/v1/sequences",
      "/v1/sequences/{id}",
      "/v1/sequences/{id}/enroll",
      "/v1/domain-health",
      "/v1/warmup",
      "/v1/bounces",
      "/v1/suppressions",
      "/v1/campaign-stats",
    ]) {
      expect(paths[path], `missing ${path}`).toBeDefined();
    }
  });

  test("the public tool endpoints are documented as needing no key", () => {
    for (const path of [
      "/api/tools/check-deliverability",
      "/api/tools/validate-emails",
      "/api/tools/generate-subject-lines",
    ]) {
      const operation = paths[path].post;
      expect(operation.security).toEqual([]);
      expect(operation.servers).toEqual([{ url: "https://www.mailmark.dev" }]);
    }
  });

  test("every $ref resolves to a schema that exists", () => {
    for (const ref of refs(spec)) {
      expect(ref.startsWith("#/components/schemas/"), ref).toBe(true);
      const name = ref.replace("#/components/schemas/", "");
      expect(schemas[name], `dangling $ref: ${ref}`).toBeDefined();
    }
  });

  test("the error schema documents the fields the API really sends", () => {
    const error = schemas.Error as Json;
    const properties = error.properties as Json;
    for (const field of ["error", "code", "message", "hint", "status", "documentation_url"]) {
      expect(properties[field], `Error schema is missing ${field}`).toBeDefined();
    }
    expect((properties.code as Json).enum).toContain("unauthorized");
    expect((properties.code as Json).enum).toContain("rate_limited");
  });

  test("authenticated operations document their failure modes", () => {
    for (const { path, method, operation } of operations()) {
      if (path.startsWith("/api/tools/")) continue;
      const responses = operation.responses as Json;
      expect(responses["401"], `${method} ${path} does not document a 401`).toBeDefined();
    }
  });

  test("serialises to JSON without cycles or undefined values", () => {
    const json = JSON.stringify(spec);
    expect(json).not.toContain("undefined");
    expect(JSON.parse(json).openapi).toBe(OPENAPI_VERSION);
  });
});

describe("the YAML rendering", () => {
  const yaml = toYaml(spec);

  test("parses back to exactly the same document", () => {
    expect(Bun.YAML.parse(yaml)).toEqual(JSON.parse(JSON.stringify(spec)));
  });

  test("starts with the OpenAPI version, as a YAML document should", () => {
    expect(yaml.startsWith(`openapi: ${OPENAPI_VERSION}`)).toBe(true);
  });

  test("handles the cases the serializer has to get right", () => {
    const sample = {
      plain: "value",
      needsQuotes: "yes: really",
      looksNumeric: "3.10",
      looksBoolean: "true",
      multiline: "first line\nsecond line",
      emptyObject: {},
      emptyArray: [],
      nested: [{ a: 1, b: [true, null] }],
      "odd key": 1,
    };
    expect(Bun.YAML.parse(toYaml(sample))).toEqual(sample);
  });
});
