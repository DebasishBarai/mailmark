export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCSV(text: string): ParsedCSV {
  const lines = splitCSVLines(text);
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseCSVRow(lines[0]).map((h) => h.trim());
  const rows = lines
    .slice(1)
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const values = parseCSVRow(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = (values[i] ?? "").trim();
      });
      return row;
    });

  return { headers, rows };
}

export function detectEmailColumn(
  headers: string[],
  rows: Record<string, string>[],
): string | null {
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

  const emailHeaders = [
    "email",
    "e-mail",
    "emailaddress",
    "email_address",
    "email address",
    "mail",
  ];
  for (const h of headers) {
    if (emailHeaders.includes(h.toLowerCase())) return h;
  }

  let bestCol = "";
  let bestCount = 0;
  for (const h of headers) {
    const count = rows.filter((r) => emailRegex.test(r[h] ?? "")).length;
    if (count > bestCount) {
      bestCount = count;
      bestCol = h;
    }
  }
  return bestCount > 0 ? bestCol : null;
}

function splitCSVLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += ch;
      }
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      lines.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function parseCSVRow(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}
