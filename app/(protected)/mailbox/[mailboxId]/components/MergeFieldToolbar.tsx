"use client";

interface MergeFieldToolbarProps {
  columns: string[];
  emailColumn: string;
  onInsertField: (fieldName: string) => void;
}

export default function MergeFieldToolbar({
  columns,
  emailColumn,
  onInsertField,
}: MergeFieldToolbarProps) {
  const insertableFields = columns.filter((c) => c !== emailColumn);

  if (insertableFields.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
      <span className="mr-1 text-xs text-gray-500 dark:text-gray-400">
        Insert:
      </span>
      {insertableFields.map((field) => (
        <button
          key={field}
          type="button"
          onClick={() => onInsertField(field)}
          className="rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/50"
          title={`Insert {${field}}`}
        >
          {`{${field}}`}
        </button>
      ))}
    </div>
  );
}
