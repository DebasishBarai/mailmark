"use client";

import { useState, useCallback } from "react";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

const BASE_URL = "https://harmless-armadillo-386.convex.site";

// ─── Types ────────────────────────────────────────────────────────────────────

type Method = "GET" | "POST" | "PATCH" | "DELETE";

interface Field {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "datetime" | "csv";
  required?: boolean;
  description: string;
  placeholder?: string;
  options?: string[];
  inPath?: boolean; // true = part of the URL path, not the body
}

interface Endpoint {
  id: string;
  method: Method;
  path: string;
  title: string;
  description: string;
  fields?: Field[];
  returns: string;
  notes?: string[];
  curlTemplate: (apiKey: string, values: Record<string, string>) => string;
  npmTemplate: (apiKey: string, values: Record<string, string>) => string;
  buildRequest: (values: Record<string, string>) => { path: string; body?: unknown };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function methodColor(m: Method) {
  return {
    GET: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    POST: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    PATCH: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    DELETE: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  }[m];
}

function csvToArray(s: string): string[] {
  return s.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
}

// ─── Endpoint Definitions ────────────────────────────────────────────────────

const ENDPOINTS: Endpoint[] = [
  // ── Mailboxes ──────────────────────────────────────────────────────────────
  {
    id: "list-mailboxes",
    method: "GET",
    path: "/v1/mailboxes",
    title: "List Mailboxes",
    description:
      "Returns all mailboxes that belong to the domain scoped to your API key. Each mailbox includes its local address, full address, and optional display name.",
    returns: "Array of Mailbox objects.",
    curlTemplate: (key) =>
      `curl -X GET ${BASE_URL}/v1/mailboxes \\\n  -H "Authorization: Bearer ${key || "dm_live_..."}"`,
    npmTemplate: (key) =>
      `import { Mailmark } from 'mailmark';\n\nconst client = new Mailmark('${key || "dm_live_..."}');\n\nconst mailboxes = await client.listMailboxes();\nconsole.log(mailboxes);`,
    buildRequest: () => ({ path: "/v1/mailboxes" }),
  },
  {
    id: "create-mailbox",
    method: "POST",
    path: "/v1/mailboxes",
    title: "Create Mailbox",
    description:
      "Creates a new mailbox on the domain associated with your API key. Only the local part of the address is needed (e.g. 'hello' — the domain suffix is appended automatically).",
    fields: [
      {
        name: "address",
        label: "Address (local part)",
        type: "text",
        required: true,
        description: "The local part of the email address, e.g. hello (not hello@domain.com).",
        placeholder: "hello",
      },
      {
        name: "displayName",
        label: "Display Name",
        type: "text",
        required: false,
        description: "Optional sender display name, e.g. 'Support Team'.",
        placeholder: "Support Team",
      },
    ],
    returns: "The created Mailbox object.",
    notes: ["Returns 409 if the mailbox already exists."],
    curlTemplate: (key, v) =>
      `curl -X POST ${BASE_URL}/v1/mailboxes \\\n  -H "Authorization: Bearer ${key || "dm_live_..."}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"address":"${v.address || "hello"}","displayName":"${v.displayName || "Hello Team"}"}'`,
    npmTemplate: (key, v) =>
      `import { Mailmark } from 'mailmark';\n\nconst client = new Mailmark('${key || "dm_live_..."}');\n\nconst mailbox = await client.createMailbox({\n  address: '${v.address || "hello"}',\n  displayName: '${v.displayName || "Hello Team"}',\n});\nconsole.log(mailbox);`,
    buildRequest: (v) => ({
      path: "/v1/mailboxes",
      body: { address: v.address, displayName: v.displayName || undefined },
    }),
  },
  {
    id: "delete-mailbox",
    method: "DELETE",
    path: "/v1/mailboxes/:address",
    title: "Delete Mailbox",
    description:
      "Permanently deletes a mailbox and all its emails. Also removes it from any sender groups it belongs to. Pass the local part ('hello') or the full address ('hello@domain.com').",
    fields: [
      {
        name: "address",
        label: "Address",
        type: "text",
        required: true,
        inPath: true,
        description: "Local part or full address of the mailbox to delete.",
        placeholder: "hello",
      },
    ],
    returns: '{ deleted: true }',
    notes: ["This action is irreversible. All emails in the mailbox are permanently deleted."],
    curlTemplate: (key, v) =>
      `curl -X DELETE ${BASE_URL}/v1/mailboxes/${v.address || "hello"} \\\n  -H "Authorization: Bearer ${key || "dm_live_..."}"`,
    npmTemplate: (key, v) =>
      `import { Mailmark } from 'mailmark';\n\nconst client = new Mailmark('${key || "dm_live_..."}');\n\nawait client.deleteMailbox('${v.address || "hello"}');`,
    buildRequest: (v) => ({ path: `/v1/mailboxes/${encodeURIComponent(v.address || "")}` }),
  },

  // ── Sender Groups ──────────────────────────────────────────────────────────
  {
    id: "list-sender-groups",
    method: "GET",
    path: "/v1/sender-groups",
    title: "List Sender Groups",
    description:
      "Returns all sender groups for the API key's domain. A sender group defines which mailboxes act as senders and which recipient emails are targeted.",
    returns: "Array of SenderGroup objects.",
    curlTemplate: (key) =>
      `curl -X GET ${BASE_URL}/v1/sender-groups \\\n  -H "Authorization: Bearer ${key || "dm_live_..."}"`,
    npmTemplate: (key) =>
      `import { Mailmark } from 'mailmark';\n\nconst client = new Mailmark('${key || "dm_live_..."}');\n\nconst groups = await client.listSenderGroups();\nconsole.log(groups);`,
    buildRequest: () => ({ path: "/v1/sender-groups" }),
  },
  {
    id: "create-sender-group",
    method: "POST",
    path: "/v1/sender-groups",
    title: "Create Sender Group",
    description:
      "Creates a sender group. Specify which sender mailboxes to include and an optional list of recipient emails. Pass 'all' for mailboxes to include every mailbox on the domain.",
    fields: [
      {
        name: "name",
        label: "Group Name",
        type: "text",
        required: true,
        description: "A descriptive name for the group.",
        placeholder: "Marketing Team",
      },
      {
        name: "mailboxes",
        label: "Sender Mailboxes",
        type: "text",
        required: false,
        description: 'Comma-separated mailbox addresses to include as senders, or "all" to include every mailbox on the domain. Defaults to "all".',
        placeholder: "all",
      },
      {
        name: "emails",
        label: "Recipient Emails",
        type: "csv",
        required: false,
        description: "Comma or newline separated list of recipient email addresses.",
        placeholder: "user1@example.com\nuser2@example.com",
      },
    ],
    returns: "The created SenderGroup object.",
    curlTemplate: (key, v) => {
      const mailboxes = v.mailboxes?.trim() === "all" || !v.mailboxes ? "all" : v.mailboxes.split(",").map((s: string) => s.trim());
      const emails = csvToArray(v.emails || "");
      return `curl -X POST ${BASE_URL}/v1/sender-groups \\\n  -H "Authorization: Bearer ${key || "dm_live_..."}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify({ name: v.name || "My Group", mailboxes, emails })}'`;
    },
    npmTemplate: (key, v) => {
      const mailboxes = v.mailboxes?.trim() === "all" || !v.mailboxes ? '"all"' : JSON.stringify(v.mailboxes.split(",").map((s: string) => s.trim()));
      const emails = JSON.stringify(csvToArray(v.emails || ""));
      return `import { Mailmark } from 'mailmark';\n\nconst client = new Mailmark('${key || "dm_live_..."}');\n\nconst group = await client.createSenderGroup({\n  name: '${v.name || "My Group"}',\n  mailboxes: ${mailboxes},\n  emails: ${emails},\n});\nconsole.log(group);`;
    },
    buildRequest: (v) => {
      const mailboxes = v.mailboxes?.trim() === "all" || !v.mailboxes ? "all" : v.mailboxes.split(",").map((s: string) => s.trim());
      return {
        path: "/v1/sender-groups",
        body: { name: v.name, mailboxes, emails: csvToArray(v.emails || "") },
      };
    },
  },
  {
    id: "update-sender-group",
    method: "PATCH",
    path: "/v1/sender-groups/:id",
    title: "Update Sender Group",
    description:
      "Updates a sender group. All fields are optional — only the fields you provide will be changed. Use addEmails / removeEmails for incremental recipient list changes, or emails to replace the entire list at once.",
    fields: [
      {
        name: "id",
        label: "Group ID",
        type: "text",
        required: true,
        inPath: true,
        description: "The ID of the sender group to update (from listSenderGroups).",
        placeholder: "jd7abc123...",
      },
      {
        name: "name",
        label: "Name",
        type: "text",
        required: false,
        description: "New name for the group.",
        placeholder: "Updated Group Name",
      },
      {
        name: "addEmails",
        label: "Add Emails",
        type: "csv",
        required: false,
        description: "Emails to add to the recipient list.",
        placeholder: "new@example.com",
      },
      {
        name: "removeEmails",
        label: "Remove Emails",
        type: "csv",
        required: false,
        description: "Emails to remove from the recipient list.",
        placeholder: "old@example.com",
      },
      {
        name: "emails",
        label: "Replace All Emails",
        type: "csv",
        required: false,
        description: "Replace the entire recipient list with this set. Overrides addEmails/removeEmails.",
        placeholder: "user1@example.com\nuser2@example.com",
      },
      {
        name: "mailboxes",
        label: "Sender Mailboxes",
        type: "text",
        required: false,
        description: 'Replace the sender mailbox list. Comma-separated addresses or "all".',
        placeholder: "all",
      },
    ],
    returns: "The updated SenderGroup object.",
    curlTemplate: (key, v) => {
      const body: Record<string, unknown> = {};
      if (v.name) body.name = v.name;
      if (v.addEmails) body.addEmails = csvToArray(v.addEmails);
      if (v.removeEmails) body.removeEmails = csvToArray(v.removeEmails);
      if (v.emails) body.emails = csvToArray(v.emails);
      if (v.mailboxes) body.mailboxes = v.mailboxes.trim() === "all" ? "all" : v.mailboxes.split(",").map((s: string) => s.trim());
      return `curl -X PATCH ${BASE_URL}/v1/sender-groups/${v.id || "GROUP_ID"} \\\n  -H "Authorization: Bearer ${key || "dm_live_..."}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(body)}'`;
    },
    npmTemplate: (key, v) => {
      const opts: string[] = [];
      if (v.name) opts.push(`  name: '${v.name}'`);
      if (v.addEmails) opts.push(`  addEmails: ${JSON.stringify(csvToArray(v.addEmails))}`);
      if (v.removeEmails) opts.push(`  removeEmails: ${JSON.stringify(csvToArray(v.removeEmails))}`);
      return `import { Mailmark } from 'mailmark';\n\nconst client = new Mailmark('${key || "dm_live_..."}');\n\nconst group = await client.updateSenderGroup('${v.id || "GROUP_ID"}', {\n${opts.join(",\n")}\n});\nconsole.log(group);`;
    },
    buildRequest: (v) => {
      const body: Record<string, unknown> = {};
      if (v.name) body.name = v.name;
      if (v.addEmails) body.addEmails = csvToArray(v.addEmails);
      if (v.removeEmails) body.removeEmails = csvToArray(v.removeEmails);
      if (v.emails) body.emails = csvToArray(v.emails);
      if (v.mailboxes) body.mailboxes = v.mailboxes.trim() === "all" ? "all" : v.mailboxes.split(",").map((s: string) => s.trim());
      return { path: `/v1/sender-groups/${encodeURIComponent(v.id || "")}`, body };
    },
  },
  {
    id: "delete-sender-group",
    method: "DELETE",
    path: "/v1/sender-groups/:id",
    title: "Delete Sender Group",
    description: "Permanently deletes a sender group. The mailboxes themselves are not affected.",
    fields: [
      {
        name: "id",
        label: "Group ID",
        type: "text",
        required: true,
        inPath: true,
        description: "The ID of the sender group to delete.",
        placeholder: "jd7abc123...",
      },
    ],
    returns: '{ deleted: true }',
    curlTemplate: (key, v) =>
      `curl -X DELETE ${BASE_URL}/v1/sender-groups/${v.id || "GROUP_ID"} \\\n  -H "Authorization: Bearer ${key || "dm_live_..."}"`,
    npmTemplate: (key, v) =>
      `import { Mailmark } from 'mailmark';\n\nconst client = new Mailmark('${key || "dm_live_..."}');\n\nawait client.deleteSenderGroup('${v.id || "GROUP_ID"}');`,
    buildRequest: (v) => ({ path: `/v1/sender-groups/${encodeURIComponent(v.id || "")}` }),
  },

  // ── Send Email ─────────────────────────────────────────────────────────────
  {
    id: "send-email",
    method: "POST",
    path: "/v1/send",
    title: "Send Email",
    description:
      "Sends an email from a mailbox on the API key's domain. Supports transactional sends (one email to all recipients), campaign sends (individual email per recipient with a shared batchId), and scheduled sends (delivered at a future time).",
    fields: [
      {
        name: "from",
        label: "From",
        type: "text",
        required: true,
        description: "Full address of the sender mailbox. Must be an existing mailbox on your domain.",
        placeholder: "hello@yourdomain.com",
      },
      {
        name: "to",
        label: "To",
        type: "csv",
        required: true,
        description: "One or more recipient email addresses (comma or newline separated).",
        placeholder: "user@example.com",
      },
      {
        name: "subject",
        label: "Subject",
        type: "text",
        required: true,
        description: "Email subject line.",
        placeholder: "Hello from Mailmark!",
      },
      {
        name: "html",
        label: "HTML Body",
        type: "textarea",
        required: false,
        description: "HTML content of the email. Either html or text is required.",
        placeholder: "<h1>Hello!</h1><p>This was sent via the Mailmark API.</p>",
      },
      {
        name: "text",
        label: "Plain Text Body",
        type: "textarea",
        required: false,
        description: "Plain text fallback. Used if html is not provided.",
        placeholder: "Hello! This was sent via the Mailmark API.",
      },
      {
        name: "type",
        label: "Send Type",
        type: "select",
        required: false,
        description:
          '"transactional" sends one email to all recipients together. "campaign" sends individual emails to each recipient, all tracked under a shared batchId.',
        options: ["transactional", "campaign"],
      },
      {
        name: "scheduledAt",
        label: "Schedule At",
        type: "datetime",
        required: false,
        description: "Schedule the email for a future time. Leave blank to send immediately.",
      },
    ],
    returns: "For transactional: { messageId, status }. For campaign: { messageIds, batchId, status }. status is 'queued' or 'scheduled'.",
    notes: [
      "The from address must be an existing mailbox created under this API key's domain.",
      "For campaign sends, each recipient receives a separate individually tracked email.",
      "scheduledAt must be a future unix millisecond timestamp.",
    ],
    curlTemplate: (key, v) => {
      const body: Record<string, unknown> = {
        from: v.from || "hello@yourdomain.com",
        to: csvToArray(v.to || "user@example.com"),
        subject: v.subject || "Hello!",
      };
      if (v.html) body.html = v.html;
      if (v.text) body.text = v.text;
      if (v.type) body.type = v.type;
      if (v.scheduledAt) body.scheduledAt = new Date(v.scheduledAt).getTime();
      return `curl -X POST ${BASE_URL}/v1/send \\\n  -H "Authorization: Bearer ${key || "dm_live_..."}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(body, null, 2).replace(/'/g, "\\'")}'`;
    },
    npmTemplate: (key, v) => {
      const opts: string[] = [
        `  from: '${v.from || "hello@yourdomain.com"}',`,
        `  to: ${JSON.stringify(csvToArray(v.to || "user@example.com"))},`,
        `  subject: '${v.subject || "Hello!"}',`,
      ];
      if (v.html) opts.push(`  html: \`${v.html}\`,`);
      if (v.type) opts.push(`  type: '${v.type}',`);
      if (v.scheduledAt) opts.push(`  scheduledAt: ${new Date(v.scheduledAt).getTime()},`);
      return `import { Mailmark } from 'mailmark';\n\nconst client = new Mailmark('${key || "dm_live_..."}');\n\nconst result = await client.send({\n${opts.join("\n")}\n});\nconsole.log(result);`;
    },
    buildRequest: (v) => {
      const body: Record<string, unknown> = {
        from: v.from,
        to: csvToArray(v.to || ""),
        subject: v.subject,
      };
      if (v.html) body.html = v.html;
      if (v.text) body.text = v.text;
      if (v.type) body.type = v.type;
      if (v.scheduledAt) body.scheduledAt = new Date(v.scheduledAt).getTime();
      return { path: "/v1/send", body };
    },
  },
];

const NAV = [
  { label: "Overview", id: "overview" },
  { label: "Authentication", id: "authentication" },
  {
    label: "Mailboxes",
    children: [
      { label: "List Mailboxes", id: "list-mailboxes" },
      { label: "Create Mailbox", id: "create-mailbox" },
      { label: "Delete Mailbox", id: "delete-mailbox" },
    ],
  },
  {
    label: "Sender Groups",
    children: [
      { label: "List Groups", id: "list-sender-groups" },
      { label: "Create Group", id: "create-sender-group" },
      { label: "Update Group", id: "update-sender-group" },
      { label: "Delete Group", id: "delete-sender-group" },
    ],
  },
  {
    label: "Send Email",
    children: [{ label: "Send / Schedule", id: "send-email" }],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${className}`}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  return (
    <div className="relative group">
      <pre className={`overflow-x-auto rounded-lg bg-gray-950 p-4 text-xs leading-relaxed text-gray-100`}>
        <code>{code}</code>
      </pre>
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={code} className="bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white" />
      </div>
    </div>
  );
}

function ParamRow({ field }: { field: Field }) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      <td className="py-3 pr-4 align-top">
        <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-gray-800 dark:text-violet-400">
          {field.name}
        </code>
      </td>
      <td className="py-3 pr-4 align-top">
        <span className="text-xs text-gray-500 dark:text-gray-400">{field.type}</span>
        {field.required && (
          <span className="ml-1 text-xs font-medium text-red-500">*</span>
        )}
      </td>
      <td className="py-3 text-xs text-gray-600 dark:text-gray-300">{field.description}</td>
    </tr>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
}) {
  const base =
    "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-violet-500 dark:focus:ring-violet-900/30";

  if (field.type === "select") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
        <option value="">— optional —</option>
        {field.options!.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  if (field.type === "textarea" || field.type === "csv") {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={field.type === "textarea" ? 4 : 3}
        placeholder={field.placeholder}
        className={base + " resize-y font-mono"}
      />
    );
  }

  if (field.type === "datetime") {
    return (
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={base}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      className={base}
    />
  );
}

function EndpointPlayground({ endpoint, apiKey }: { endpoint: Endpoint; apiKey: string }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ status: number; body: unknown } | null>(null);
  const [codeTab, setCodeTab] = useState<"curl" | "npm">("curl");

  const setValue = useCallback((name: string, val: string) => {
    setValues((prev) => ({ ...prev, [name]: val }));
  }, []);

  const run = async () => {
    if (!apiKey) { alert("Enter your API key at the top of the page first."); return; }
    setLoading(true);
    setResponse(null);
    try {
      const { path, body } = endpoint.buildRequest(values);
      const res = await fetch(`${BASE_URL}${path}`, {
        method: endpoint.method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const data = await res.json().catch(() => null);
      setResponse({ status: res.status, body: data });
    } catch (err) {
      setResponse({ status: 0, body: { error: err instanceof Error ? err.message : "Network error" } });
    } finally {
      setLoading(false);
    }
  };

  const curlCode = endpoint.curlTemplate(apiKey, values);
  const npmCode = endpoint.npmTemplate(apiKey, values);

  const bodyFields = endpoint.fields?.filter((f) => !f.inPath) ?? [];
  const pathFields = endpoint.fields?.filter((f) => f.inPath) ?? [];

  return (
    <div className="mt-8 space-y-6">
      {/* Code examples */}
      <div>
        <div className="mb-3 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit dark:bg-gray-800">
          {(["curl", "npm"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setCodeTab(tab)}
              className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
                codeTab === tab
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {tab === "curl" ? "cURL" : "npm (mailmark)"}
            </button>
          ))}
        </div>
        <CodeBlock code={codeTab === "curl" ? curlCode : npmCode} />
      </div>

      {/* Try it */}
      <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-5 dark:border-violet-900/40 dark:bg-violet-950/20">
        <h4 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Try it</h4>

        <div className="space-y-4">
          {/* Path params */}
          {pathFields.map((field) => (
            <div key={field.name}>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                {field.label}{" "}
                {field.required && <span className="text-red-500">*</span>}
                <span className="ml-1 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-normal text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  path param
                </span>
              </label>
              <FieldInput field={field} value={values[field.name] ?? ""} onChange={(v) => setValue(field.name, v)} />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{field.description}</p>
            </div>
          ))}

          {/* Body params */}
          {bodyFields.map((field) => (
            <div key={field.name}>
              <label className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-300">
                {field.label}{" "}
                {field.required && <span className="text-red-500">*</span>}
              </label>
              <FieldInput field={field} value={values[field.name] ?? ""} onChange={(v) => setValue(field.name, v)} />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{field.description}</p>
            </div>
          ))}
        </div>

        <button
          onClick={run}
          disabled={loading}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
        >
          {loading && (
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {loading ? "Sending…" : `Send ${endpoint.method} request`}
        </button>

        {response && (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 text-xs font-bold ${
                  response.status >= 200 && response.status < 300
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                }`}
              >
                {response.status || "Network Error"}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Response</span>
              <CopyButton
                text={JSON.stringify(response.body, null, 2)}
                className="ml-auto text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              />
            </div>
            <pre className="overflow-x-auto rounded-lg bg-gray-950 p-4 text-xs leading-relaxed text-gray-100">
              {JSON.stringify(response.body, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function EndpointSection({ endpoint, apiKey }: { endpoint: Endpoint; apiKey: string }) {
  return (
    <section id={endpoint.id} className="scroll-mt-24 border-b border-gray-100 py-12 dark:border-gray-800">
      {/* Title + badge */}
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-md px-2.5 py-1 font-mono text-xs font-bold ${methodColor(endpoint.method)}`}>
          {endpoint.method}
        </span>
        <code className="font-mono text-sm font-semibold text-gray-800 dark:text-gray-200">
          {endpoint.path}
        </code>
      </div>
      <h2 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">{endpoint.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{endpoint.description}</p>

      {/* Notes */}
      {endpoint.notes && endpoint.notes.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/40 dark:bg-amber-900/10">
          <ul className="space-y-1">
            {endpoint.notes.map((n) => (
              <li key={n} className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Parameters table */}
      {endpoint.fields && endpoint.fields.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Parameters</h3>
          <div className="overflow-hidden rounded-lg border border-gray-100 dark:border-gray-800">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60">
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Name</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Type</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white dark:divide-gray-800 dark:bg-transparent">
                {endpoint.fields.map((f) => (
                  <tr key={f.name} className="px-4">
                    <td className="px-4 py-3 align-top">
                      <code className="text-xs font-semibold text-violet-700 dark:text-violet-400">{f.name}</code>
                      {f.inPath && (
                        <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">path</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{f.type}</span>
                      {f.required && <span className="ml-1 text-xs font-bold text-red-500">*</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-xs text-gray-400">* required</p>
        </div>
      )}

      {/* Returns */}
      <div className="mt-4">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Returns: </span>
        <span className="text-xs text-gray-600 dark:text-gray-300">{endpoint.returns}</span>
      </div>

      <EndpointPlayground endpoint={endpoint} apiKey={apiKey} />
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApiDocsPage() {
  const [apiKey, setApiKey] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-900">
      <Header />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex gap-10">
          {/* ── Sidebar ── */}
          <aside className="hidden w-56 shrink-0 lg:block">
            <div className="sticky top-24 space-y-1">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                API Reference
              </p>
              {NAV.map((item) =>
                "children" in item ? (
                  <div key={item.label}>
                    <p className="mt-4 mb-1 text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                      {item.label}
                    </p>
                    {item.children.map((child) => (
                      <a
                        key={child.id}
                        href={`#${child.id}`}
                        className="block rounded-md px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-violet-50 hover:text-violet-700 dark:text-gray-400 dark:hover:bg-violet-900/20 dark:hover:text-violet-400"
                      >
                        {child.label}
                      </a>
                    ))}
                  </div>
                ) : (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="block rounded-md px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-violet-50 hover:text-violet-700 dark:text-gray-400 dark:hover:bg-violet-900/20 dark:hover:text-violet-400"
                  >
                    {item.label}
                  </a>
                )
              )}
            </div>
          </aside>

          {/* ── Main content ── */}
          <main className="min-w-0 flex-1">
            {/* Page header */}
            <div className="mb-8 border-b border-gray-100 pb-8 dark:border-gray-800">
              <span className="inline-block rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                REST API
              </span>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                API Reference
              </h1>
              <p className="mt-2 text-base text-gray-600 dark:text-gray-300">
                Send transactional and campaign emails, manage mailboxes, and configure sender groups — all from your application.
              </p>

              {/* API Key input */}
              <div className="mt-6 rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
                <label className="mb-2 block text-xs font-semibold text-violet-800 dark:text-violet-300">
                  Your API Key — paste it here to auto-fill all examples and try requests live
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={keyVisible ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="dm_live_..."
                      className="w-full rounded-lg border border-violet-200 bg-white px-3 py-2.5 pr-10 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-violet-800/50 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                    />
                    <button
                      onClick={() => setKeyVisible(!keyVisible)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      {keyVisible ? (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {apiKey && (
                    <button
                      onClick={() => setApiKey("")}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-violet-700/70 dark:text-violet-400/70">
                  Your key is never sent to our servers from this page — requests go directly to the API.{" "}
                  <a href="/developer" className="underline">Get your API key →</a>
                </p>
              </div>
            </div>

            {/* Overview */}
            <section id="overview" className="scroll-mt-24 border-b border-gray-100 pb-12 dark:border-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Overview</h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                The Mailmark API is a simple HTTP REST API. All endpoints are hosted at:
              </p>
              <CodeBlock code={BASE_URL} />

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {[
                  { label: "Format", value: "JSON request and response bodies." },
                  { label: "Auth", value: "Bearer token via the Authorization header." },
                  { label: "Errors", value: "Standard HTTP status codes with an error field in the body." },
                  { label: "SDK", value: "Use the mailmark npm package for a typed client." },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{item.label}</p>
                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{item.value}</p>
                  </div>
                ))}
              </div>

              <h3 className="mt-8 text-base font-semibold text-gray-900 dark:text-white">Error responses</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">All errors return a JSON body with an <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">error</code> field:</p>
              <CodeBlock code={`HTTP 401\n{\n  "error": "Invalid or revoked API key"\n}`} />
            </section>

            {/* Authentication */}
            <section id="authentication" className="scroll-mt-24 border-b border-gray-100 py-12 dark:border-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Authentication</h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                All API requests require an API key passed as a Bearer token in the{" "}
                <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs dark:bg-gray-800">Authorization</code> header.
              </p>
              <CodeBlock code={`Authorization: Bearer dm_live_your_api_key_here`} />

              <div className="mt-6 space-y-4 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-400">1</span>
                  <p>Go to the <a href="/developer" className="font-medium text-violet-600 hover:underline dark:text-violet-400">Developer</a> section in your dashboard.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-400">2</span>
                  <p>Click <strong>Create API Key</strong>, give it a name, and select the domain it should be scoped to.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-400">3</span>
                  <p>Copy the key immediately — it is shown only once and stored as a hash.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-400">4</span>
                  <p>Each API key is scoped to a single verified domain. The key can only access mailboxes and sender groups on that domain.</p>
                </div>
              </div>

              <h3 className="mt-8 mb-3 text-base font-semibold text-gray-900 dark:text-white">Quick start</h3>
              <CodeBlock code={`curl -X GET ${BASE_URL}/v1/mailboxes \\\n  -H "Authorization: Bearer dm_live_your_key"`} />
            </section>

            {/* All endpoints */}
            {ENDPOINTS.map((endpoint) => (
              <EndpointSection key={endpoint.id} endpoint={endpoint} apiKey={apiKey} />
            ))}

            {/* SDK section */}
            <section className="py-12">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Node.js SDK</h2>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Install the official typed SDK to avoid writing raw fetch calls:
              </p>
              <CodeBlock code="npm install mailmark\n# or\nbun add mailmark" />
              <CodeBlock
                lang="ts"
                code={`import { Mailmark } from 'mailmark';\n\nconst client = new Mailmark('dm_live_your_key');\n\n// List mailboxes\nconst mailboxes = await client.listMailboxes();\n\n// Send an email\nconst result = await client.send({\n  from: 'hello@yourdomain.com',\n  to: ['user@example.com'],\n  subject: 'Hello!',\n  html: '<p>Sent via Mailmark.</p>',\n});\n\n// Campaign send\nconst campaign = await client.send({\n  from: 'hello@yourdomain.com',\n  to: ['a@example.com', 'b@example.com'],\n  subject: 'Big announcement',\n  html: '<h1>Hello!</h1>',\n  type: 'campaign',\n});\n\n// Scheduled send\nconst scheduled = await client.send({\n  from: 'hello@yourdomain.com',\n  to: ['user@example.com'],\n  subject: 'Reminder',\n  html: '<p>This is scheduled.</p>',\n  scheduledAt: Date.now() + 60 * 60 * 1000, // 1 hour from now\n});`}
              />
            </section>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
