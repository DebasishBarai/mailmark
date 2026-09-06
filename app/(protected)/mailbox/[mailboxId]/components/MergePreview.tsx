"use client";

import { useMemo } from "react";
import { marked } from "marked";
import { resolveMergeFields } from "@/lib/mergeFields";
import type { MergeRecipient } from "./MergeImport";

interface MergePreviewProps {
  recipients: MergeRecipient[];
  previewIndex: number;
  onChangeIndex: (index: number) => void;
  subject: string;
  body: string;
  contentType?: "plain" | "markdown" | "html";
}

export default function MergePreview({
  recipients,
  previewIndex,
  onChangeIndex,
  subject,
  body,
  contentType = "plain",
}: MergePreviewProps) {
  const recipient = recipients[previewIndex];
  const fields = recipient?.fields;

  const resolvedSubject = useMemo(
    () => (fields ? resolveMergeFields(subject, fields) : ""),
    [subject, fields],
  );

  // Render the body the same way sending does: convert Markdown/HTML to HTML
  // first, then substitute merge fields into the rendered markup. Doing it in
  // this order keeps `**{Company}**` bold instead of leaking literal asterisks.
  const resolvedBodyHtml = useMemo(() => {
    if (!fields) return "";
    const html =
      contentType === "markdown"
        ? (marked.parse(body) as string)
        : contentType === "html"
          ? body
          : body.replace(/\n/g, "<br>");
    return resolveMergeFields(html, fields);
  }, [body, contentType, fields]);

  // const resolvedBody = useMemo(
  //   () => resolveMergeFields(body, recipient.fields),
  //   [body, recipient.fields],
  // );

  if (!recipient) return null;

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-900/10">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
          Preview
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeIndex(Math.max(0, previewIndex - 1))}
            disabled={previewIndex === 0}
            className="rounded px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            &larr;
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {previewIndex + 1} of {recipients.length}
          </span>
          <button
            type="button"
            onClick={() =>
              onChangeIndex(
                Math.min(recipients.length - 1, previewIndex + 1),
              )
            }
            disabled={previewIndex === recipients.length - 1}
            className="rounded px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-200 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            &rarr;
          </button>
        </div>
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="flex gap-2">
          <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
            To:
          </span>
          <span className="text-xs text-gray-800 dark:text-gray-200">
            {recipient.email}
          </span>
        </div>
        <div className="flex gap-2">
          <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
            Subject:
          </span>
          <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
            {resolvedSubject}
          </span>
        </div>
        <div
          className="rounded border border-gray-200 bg-white p-2 text-xs text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mb-1 [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-violet-600 [&_a]:underline [&_code]:font-mono [&_code]:bg-gray-200 [&_code]:dark:bg-gray-700 [&_code]:rounded [&_code]:px-1 [&_pre]:bg-gray-200 [&_pre]:dark:bg-gray-700 [&_pre]:rounded [&_pre]:p-2 [&_pre]:overflow-x-auto [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_p]:mb-2 [&_p:last-child]:mb-0"
          dangerouslySetInnerHTML={{ __html: resolvedBodyHtml }}
        />
      </div>
    </div>
  );
}
