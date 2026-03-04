"use client";

import { useMemo } from "react";
import { resolveMergeFields } from "@/lib/mergeFields";
import type { MergeRecipient } from "./MergeImport";

interface MergePreviewProps {
  recipients: MergeRecipient[];
  previewIndex: number;
  onChangeIndex: (index: number) => void;
  subject: string;
  body: string;
}

export default function MergePreview({
  recipients,
  previewIndex,
  onChangeIndex,
  subject,
  body,
}: MergePreviewProps) {
  const recipient = recipients[previewIndex];
  if (!recipient) return null;

  const resolvedSubject = useMemo(
    () => resolveMergeFields(subject, recipient.fields),
    [subject, recipient.fields],
  );

  const resolvedBody = useMemo(
    () => resolveMergeFields(body, recipient.fields),
    [body, recipient.fields],
  );

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
        <div className="rounded border border-gray-200 bg-white p-2 text-xs text-gray-700 whitespace-pre-wrap dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300">
          {resolvedBody}
        </div>
      </div>
    </div>
  );
}
