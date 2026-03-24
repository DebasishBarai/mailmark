"use client";

import { useState, useRef } from "react";
import { parseCSV, detectEmailColumn } from "@/lib/csvParser";

export interface MergeRecipient {
  email: string;
  fields: Record<string, string>;
}

interface MergeImportProps {
  onImport: (
    recipients: MergeRecipient[],
    columns: string[],
    emailColumn: string,
  ) => void;
  onCancel: () => void;
}

export default function MergeImport({ onImport, onCancel }: MergeImportProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [emailColumn, setEmailColumn] = useState("");
  const [error, setError] = useState("");
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processCSVText = (text: string) => {
    const parsed = parseCSV(text);
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setError("CSV is empty or has no data rows.");
      return;
    }
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    const detected = detectEmailColumn(parsed.headers, parsed.rows);
    setEmailColumn(detected ?? parsed.headers[0]);
    setError("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      processCSVText(ev.target?.result as string);
    };
    reader.onerror = () => setError("Failed to read file.");
    reader.readAsText(file);
  };

  const handleFetchSheets = async () => {
    if (!sheetsUrl.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/fetch-csv?url=${encodeURIComponent(sheetsUrl.trim())}`,
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch spreadsheet");
      }
      const text = await res.text();
      processCSVText(text);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch spreadsheet.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleImport = () => {
    if (!emailColumn) return;
    const recipients: MergeRecipient[] = rows
      .filter((row) => {
        const email = row[emailColumn]?.trim();
        return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      })
      .map((row) => ({
        email: row[emailColumn].trim(),
        fields: { ...row },
      }));
    if (recipients.length === 0) {
      setError("No valid email addresses found in the selected column.");
      return;
    }
    onImport(recipients, headers, emailColumn);
  };

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Import Recipients
        </h3>
        <button
          onClick={onCancel}
          className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Cancel
        </button>
      </div>

      {/* Import methods */}
      <div className="space-y-3">
        {/* CSV Upload */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-600 transition-colors hover:border-violet-400 hover:text-violet-600 dark:border-gray-600 dark:text-gray-400 dark:hover:border-violet-500 dark:hover:text-violet-400"
          >
            Upload CSV file
          </button>
        </div>

        {/* Google Sheets */}
        <div className="flex gap-2">
          <input
            type="text"
            value={sheetsUrl}
            onChange={(e) => setSheetsUrl(e.target.value)}
            placeholder="Paste Google Sheets URL..."
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-500"
          />
          <button
            onClick={handleFetchSheets}
            disabled={!sheetsUrl.trim() || loading}
            className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Fetch"}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
      )}

      {/* Column mapping + preview */}
      {headers.length > 0 && (
        <>
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Email column:
            </label>
            <select
              value={emailColumn}
              onChange={(e) => setEmailColumn(e.target.value)}
              className="rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            >
              {headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500">
              {rows.length} row{rows.length !== 1 ? "s" : ""} found
            </span>
          </div>

          {/* Preview table */}
          <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700/50">
                  {headers.map((h) => (
                    <th
                      key={h}
                      className={`px-3 py-1.5 text-left font-medium ${h === emailColumn ? "text-violet-600 dark:text-violet-400" : "text-gray-600 dark:text-gray-400"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, i) => (
                  <tr
                    key={i}
                    className="border-t border-gray-100 dark:border-gray-700"
                  >
                    {headers.map((h) => (
                      <td
                        key={h}
                        className="px-3 py-1.5 text-gray-700 dark:text-gray-300"
                      >
                        {row[h] || "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 5 && (
              <p className="px-3 py-1.5 text-xs text-gray-400">
                ...and {rows.length - 5} more rows
              </p>
            )}
          </div>

          <button
            onClick={handleImport}
            className="w-full rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
          >
            Import {rows.length} recipient{rows.length !== 1 ? "s" : ""}
          </button>
        </>
      )}
    </div>
  );
}
