export function resolveMergeFields(
  template: string,
  fields: Record<string, string>,
): string {
  return template.replace(
    /\{([^{}|]+?)(?:\|([^{}]*?))?\}/g,
    (match, fieldName: string, fallback?: string) => {
      const value = fields[fieldName.trim()];
      if (value !== undefined && value !== "") return value;
      if (fallback !== undefined) return fallback;
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
