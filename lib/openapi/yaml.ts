/**
 * A minimal YAML serializer for the OpenAPI document.
 *
 * The spec is plain JSON data (objects, arrays, strings, numbers, booleans,
 * null), so this covers exactly that and nothing else. It exists so
 * /api/openapi.yaml can be served without pulling in a YAML dependency.
 */

type JsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonValue[]
  | { readonly [key: string]: JsonValue };

/** Keys that are safe unquoted in YAML. Anything else gets quoted. */
const PLAIN_KEY = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

/** Strings that must be quoted so they do not read as another YAML type. */
const NEEDS_QUOTES =
  /^(?:$|[\s#&*!|>'"%@`\-?:,[\]{}]|.*[:#]\s|.*[\s]$|true$|false$|null$|~$|[-+]?\d+(?:\.\d+)?$|0x)/i;

function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function scalar(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (value.includes("\n")) return ""; // handled by the caller as a block scalar
  return NEEDS_QUOTES.test(value) ? quote(value) : value;
}

function isMultilineString(value: JsonValue): value is string {
  return typeof value === "string" && value.includes("\n");
}

/** Renders a multi-line string as a literal block scalar. */
function blockScalar(value: string, indent: string): string {
  const lines = value.split("\n").map((line) => (line ? `${indent}  ${line}` : ""));
  // "|-" strips the trailing newline, which JSON strings do not carry.
  return `|-\n${lines.join("\n")}`;
}

function key(name: string): string {
  return PLAIN_KEY.test(name) ? name : quote(name);
}

function isEmpty(value: JsonValue): boolean {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

function render(value: JsonValue, indent: string): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((item) => {
        if (item !== null && typeof item === "object" && !isEmpty(item)) {
          const nested = render(item, `${indent}  `);
          return `${indent}- ${nested.slice(indent.length + 2)}`;
        }
        if (isMultilineString(item)) return `${indent}- ${blockScalar(item, indent)}`;
        return `${indent}- ${scalar(item as string | number | boolean | null)}`;
      })
      .join("\n");
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return "{}";

    return entries
      .map(([name, child]) => {
        if (child !== null && typeof child === "object" && !isEmpty(child as JsonValue)) {
          return `${indent}${key(name)}:\n${render(child as JsonValue, `${indent}  `)}`;
        }
        if (isEmpty(child as JsonValue)) {
          return `${indent}${key(name)}: ${Array.isArray(child) ? "[]" : "{}"}`;
        }
        if (isMultilineString(child)) {
          return `${indent}${key(name)}: ${blockScalar(child, indent)}`;
        }
        return `${indent}${key(name)}: ${scalar(child as string | number | boolean | null)}`;
      })
      .join("\n");
  }

  if (isMultilineString(value)) return `${indent}${blockScalar(value, indent)}`;
  return `${indent}${scalar(value)}`;
}

/** Serializes a JSON-compatible value as a YAML document. */
export function toYaml(value: unknown): string {
  return `${render(value as JsonValue, "")}\n`;
}
