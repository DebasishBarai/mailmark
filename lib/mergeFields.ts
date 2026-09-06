export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// export function resolveMergeFields(
//   template: string,
//   fields: Record<string, string>,
// ): string {
export function resolveMergeFields(
  template: string,
  fields: Record<string, string>,
  options?: { escapeValues?: boolean },
): string {
  // In plain-text mode the surrounding body is escaped, so substituted values
  // must be escaped too or a value containing "<" would become live markup.
  const out = (value: string) =>
    options?.escapeValues ? escapeHtml(value) : value;
  return template.replace(
    /\{([^{}|]+?)(?:\|([^{}]*?))?\}/g,
    (match, fieldName: string, fallback?: string) => {
      const value = fields[fieldName.trim()];
      if (value !== undefined && value !== "") return out(value);
      if (fallback !== undefined) return out(fallback);
      return match;
    },
  );
}

export function extractMergeFields(template: string): string[] {
  const regex = /\{([^{}|]+?)(?:\|[^{}]*?)?\}/g;
  const fields = new Set<string>();
  let match;
  while ((match = regex.exec(template)) !== null) {
    fields.add(match[1].trim());
  }
  return [...fields];
}
