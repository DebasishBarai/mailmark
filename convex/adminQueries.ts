import { v, type Infer } from "convex/values";
import { internalQuery } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

/**
 * Ad hoc reader for the emails table, meant to be run by hand from the Convex
 * dashboard (Functions > adminQueries:queryEmails > Run).
 *
 * Nothing in the app calls this. It exists so a question like "which sent mail
 * never reached delivered" can be answered without shipping a one off query
 * every time the question changes slightly. It is an internalQuery, so it is
 * not reachable from the browser or from an API key: only the dashboard and
 * other Convex functions can run it.
 *
 * Two ways to say what you want, and they can be combined (the `where` object
 * wins on a field both of them mention):
 *
 *   1. `filter`, a compact string:
 *
 *        folder = sent, deliveryStatus != delivered
 *        folder = sent|outbox, deliveryStatus != delivered
 *        folder in sent|outbox, read = false, date >= 2026-08-01
 *        subject ~ invoice, openedAt exists, deliveryStatus = !bounced|failed
 *
 *   2. `where`, the same thing as JSON:
 *
 *        { "folder": "sent", "deliveryStatus": "delivered" }
 *        { "folder": ["sent", "outbox"], "deliveryStatus": { "ne": "delivered" } }
 *        { "date": { "gte": "2026-08-01" }, "subject": { "contains": "invoice" } }
 *
 * A bare value means equals, an array means "any of these", and the object
 * form carries the rest of the operators: eq, ne, in, nin, gt, gte, lt, lte,
 * contains, startsWith, exists.
 *
 * Every operator works on every field of the emails table, so any combination
 * of them is a valid question. The full field list is in schema.ts; the ones
 * asked about most are folder, deliveryStatus, read, starred, from, to,
 * subject, date, openedAt, repliedAt, scheduledAt, batchId and mailboxId.
 *
 * Convenience arguments that save you from pasting document ids:
 *
 *   mailbox: "hi@acme.com"   restrict to one mailbox by its full address
 *   domain:  "acme.com"      restrict to every mailbox on a domain
 *   userEmail: "a@b.com"     restrict to every mailbox owned by that user
 *
 * Output shaping:
 *
 *   limit      how many documents to return (default 50, max 1000)
 *   countOnly  true returns just the count, no documents
 *   groupBy    ["deliveryStatus"] returns counts per distinct value instead
 *   full       true returns whole documents instead of the compact projection
 *   select     ["subject", "date"] returns exactly these fields
 *   sortBy     "date" (default) or "_creationTime"
 *   order      "desc" (default) or "asc"
 *
 * Scan safety: Convex aborts a transaction that reads more than 32,000
 * documents, so the scan stops at `maxScan` (default 20,000) and the reply
 * says `truncated: true` when it did. Narrow the filter, or pass mailbox /
 * domain / a date bound, to get an exact answer on a big table.
 */

// ── Argument validators ──

const scalar = v.union(v.string(), v.number(), v.boolean(), v.null());

const conditionObject = v.object({
  eq: v.optional(scalar),
  ne: v.optional(scalar),
  in: v.optional(v.array(scalar)),
  nin: v.optional(v.array(scalar)),
  gt: v.optional(v.union(v.string(), v.number())),
  gte: v.optional(v.union(v.string(), v.number())),
  lt: v.optional(v.union(v.string(), v.number())),
  lte: v.optional(v.union(v.string(), v.number())),
  contains: v.optional(v.string()),
  startsWith: v.optional(v.string()),
  // true means the field is present and not null, false means absent or null.
  exists: v.optional(v.boolean()),
});

const condition = v.union(scalar, v.array(scalar), conditionObject);

type Scalar = Infer<typeof scalar>;
type ConditionObject = Infer<typeof conditionObject>;
type Condition = Infer<typeof condition>;
type Where = Record<string, Condition>;

// ── Value handling ──

// Fields holding epoch milliseconds. A human typing a filter writes a date,
// not 1756684800000, so strings on these fields are parsed as dates before
// they are compared. Anything unparseable is left alone and compares as text.
const TIME_FIELDS = new Set([
  "date",
  "deliveredAt",
  "openedAt",
  "repliedAt",
  "scheduledAt",
  "_creationTime",
]);

function coerce(field: string, value: Scalar | undefined): Scalar | undefined {
  if (value === undefined || value === null) return value;
  if (TIME_FIELDS.has(field) && typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return value;
}

function isConditionObject(cond: Condition): cond is ConditionObject {
  return typeof cond === "object" && cond !== null && !Array.isArray(cond);
}

// A document value equals a filter value when they are the same scalar, or,
// for the array fields (to, cc, bcc), when the array contains it. That is what
// makes `to = someone@example.com` behave the way it reads.
function valueEquals(docValue: unknown, target: Scalar): boolean {
  if (Array.isArray(docValue)) return docValue.some((entry) => entry === target);
  if (target === null) return docValue === undefined || docValue === null;
  return docValue === target;
}

function asText(docValue: unknown): string | null {
  if (typeof docValue === "string") return docValue;
  if (typeof docValue === "number" || typeof docValue === "boolean") return String(docValue);
  if (Array.isArray(docValue)) return docValue.join(" ");
  return null;
}

function compare(docValue: unknown, bound: string | number, op: "gt" | "gte" | "lt" | "lte"): boolean {
  if (docValue === undefined || docValue === null) return false;
  if (typeof docValue !== typeof bound) return false;
  const left = docValue as string | number;
  if (op === "gt") return left > bound;
  if (op === "gte") return left >= bound;
  if (op === "lt") return left < bound;
  return left <= bound;
}

function matches(docValue: unknown, cond: Condition, field: string): boolean {
  // Bare scalar: equality.
  if (!isConditionObject(cond)) {
    if (Array.isArray(cond)) {
      return cond.some((entry) => valueEquals(docValue, coerce(field, entry) as Scalar));
    }
    return valueEquals(docValue, coerce(field, cond) as Scalar);
  }

  if (cond.eq !== undefined && !valueEquals(docValue, coerce(field, cond.eq) as Scalar)) return false;
  if (cond.ne !== undefined && valueEquals(docValue, coerce(field, cond.ne) as Scalar)) return false;
  if (cond.in !== undefined) {
    const hit = cond.in.some((entry) => valueEquals(docValue, coerce(field, entry) as Scalar));
    if (!hit) return false;
  }
  if (cond.nin !== undefined) {
    const hit = cond.nin.some((entry) => valueEquals(docValue, coerce(field, entry) as Scalar));
    if (hit) return false;
  }
  for (const op of ["gt", "gte", "lt", "lte"] as const) {
    const bound = cond[op];
    if (bound === undefined) continue;
    if (!compare(docValue, coerce(field, bound) as string | number, op)) return false;
  }
  if (cond.contains !== undefined) {
    const text = asText(docValue);
    if (text === null) return false;
    if (!text.toLowerCase().includes(cond.contains.toLowerCase())) return false;
  }
  if (cond.startsWith !== undefined) {
    const text = asText(docValue);
    if (text === null) return false;
    if (!text.toLowerCase().startsWith(cond.startsWith.toLowerCase())) return false;
  }
  if (cond.exists !== undefined) {
    const present = docValue !== undefined && docValue !== null;
    if (present !== cond.exists) return false;
  }
  return true;
}

function matchesWhere(doc: Doc<"emails">, where: Where): boolean {
  for (const [field, cond] of Object.entries(where)) {
    const docValue = (doc as unknown as Record<string, unknown>)[field];
    if (!matches(docValue, cond, field)) return false;
  }
  return true;
}

// ── The `filter` string ──

// Splits on a separator that is not inside quotes, so a comma inside a subject
// filter does not end the clause.
function splitOutsideQuotes(input: string, separators: string[]): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: string | null = null;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (separators.includes(ch)) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

function parseLiteral(raw: string): Scalar {
  const text = raw.trim();
  if (text === "null" || text === "undefined") return null;
  if (text === "true") return true;
  if (text === "false") return false;
  if (text !== "" && !Number.isNaN(Number(text))) return Number(text);
  return text;
}

function parseClause(clause: string): [string, Condition] | null {
  // `field exists` / `field missing` / `field is null`.
  const presence = clause.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+(exists|missing|is\s+null|not\s+null)$/i);
  if (presence) {
    const kind = presence[2].toLowerCase().replace(/\s+/g, " ");
    const exists = kind === "exists" || kind === "not null";
    return [presence[1], { exists }];
  }

  const match = clause.match(
    /^([A-Za-z_][A-Za-z0-9_]*)\s*(!=|>=|<=|==|=|>|<|~|\bnot\s+in\b|\bin\b)\s*(.+)$/i
  );
  if (!match) return null;

  const field = match[1];
  const op = match[2].toLowerCase().replace(/\s+/g, " ");
  let rawValue = match[3].trim();

  // A leading ! on the value negates, so `deliveryStatus = !delivered` reads
  // the way it was written.
  let negated = op === "!=" || op === "not in";
  if (rawValue.startsWith("!")) {
    negated = !negated;
    rawValue = rawValue.slice(1).trim();
  }

  // `a|b|c` is a list, and so is anything on the `in` operators.
  const values = splitOutsideQuotes(rawValue, ["|"]).map(parseLiteral);
  if (values.length === 0) return null;

  if (op === "~") return [field, { contains: String(values[0]) }];
  if (op === ">") return [field, { gt: values[0] as string | number }];
  if (op === ">=") return [field, { gte: values[0] as string | number }];
  if (op === "<") return [field, { lt: values[0] as string | number }];
  if (op === "<=") return [field, { lte: values[0] as string | number }];

  if (values.length > 1 || op === "in" || op === "not in") {
    return [field, negated ? { nin: values } : { in: values }];
  }
  if (values[0] === null) return [field, { exists: negated }];
  return [field, negated ? { ne: values[0] } : { eq: values[0] }];
}

function parseFilter(filter: string): { where: Where; ignored: string[] } {
  const where: Where = {};
  const ignored: string[] = [];
  // ` and ` is accepted as a synonym for the comma so the string can be read
  // out loud without sounding like a list.
  const clauses = splitOutsideQuotes(filter.replace(/\s+and\s+/gi, ","), [",", "\n"]);
  for (const clause of clauses) {
    const parsed = parseClause(clause);
    if (!parsed) {
      ignored.push(clause);
      continue;
    }
    where[parsed[0]] = parsed[1];
  }
  return { where, ignored };
}

// ── Index selection ──

// Pulls a single equality value out of a condition, when there is one. Used to
// decide whether an index can carry the filter instead of a table scan.
function singleEq(cond: Condition | undefined): Scalar | undefined {
  if (cond === undefined) return undefined;
  if (Array.isArray(cond)) return cond.length === 1 ? cond[0] : undefined;
  if (!isConditionObject(cond)) return cond;
  if (cond.eq !== undefined) return cond.eq;
  if (cond.in !== undefined && cond.in.length === 1) return cond.in[0];
  return undefined;
}

// Pulls the full set of allowed equality values, when the condition is a plain
// "any of these" (a bare array or `in`). One indexed read is issued per value.
function eqList(cond: Condition | undefined): Scalar[] | undefined {
  if (cond === undefined) return undefined;
  if (Array.isArray(cond)) return cond.length > 0 ? cond : undefined;
  if (!isConditionObject(cond)) return [cond];
  if (cond.eq !== undefined) return [cond.eq];
  if (cond.in !== undefined && cond.in.length > 0) return cond.in;
  return undefined;
}

function dateBounds(cond: Condition | undefined): { lower?: number; upper?: number } {
  if (cond === undefined || !isConditionObject(cond)) return {};
  const lowerRaw = cond.gte !== undefined ? cond.gte : cond.gt;
  const upperRaw = cond.lte !== undefined ? cond.lte : cond.lt;
  const lower = coerce("date", lowerRaw as Scalar | undefined);
  const upper = coerce("date", upperRaw as Scalar | undefined);
  return {
    // gt/lt are widened to gte/lte here on purpose: the index only narrows the
    // scan, and matchesWhere still applies the exact comparison afterwards.
    lower: typeof lower === "number" ? lower : undefined,
    upper: typeof upper === "number" ? upper : undefined,
  };
}

// Turns the mailbox / domain / userEmail conveniences, plus a mailboxId in the
// where clause, into the set of mailboxes worth reading. Returns null when the
// query is not restricted to any mailbox.
async function resolveMailboxIds(
  ctx: QueryCtx,
  args: { mailbox?: string; domain?: string; userEmail?: string },
  where: Where
): Promise<Id<"mailboxes">[] | null> {
  const ids = new Set<Id<"mailboxes">>();
  let restricted = false;

  if (args.mailbox) {
    restricted = true;
    const mailbox = await ctx.db
      .query("mailboxes")
      .withIndex("by_full_address", (q) => q.eq("fullAddress", args.mailbox!))
      .unique();
    if (mailbox) ids.add(mailbox._id);
  }

  if (args.domain) {
    restricted = true;
    const domain = await ctx.db
      .query("domains")
      .withIndex("by_domain", (q) => q.eq("domain", args.domain!))
      .first();
    if (domain) {
      const mailboxes = await ctx.db
        .query("mailboxes")
        .withIndex("by_domain_id", (q) => q.eq("domainId", domain._id))
        .collect();
      for (const mailbox of mailboxes) ids.add(mailbox._id);
    }
  }

  if (args.userEmail) {
    restricted = true;
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail!))
      .first();
    if (user) {
      const mailboxes = await ctx.db
        .query("mailboxes")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .collect();
      for (const mailbox of mailboxes) ids.add(mailbox._id);
    }
  }

  const fromWhere = eqList(where.mailboxId);
  if (fromWhere) {
    const listed = fromWhere.filter((entry): entry is string => typeof entry === "string");
    if (restricted) {
      // Both a convenience argument and a mailboxId filter: keep the overlap.
      for (const id of Array.from(ids)) {
        if (!listed.includes(id)) ids.delete(id);
      }
    } else {
      for (const id of listed) ids.add(id as Id<"mailboxes">);
    }
    restricted = true;
  }

  return restricted ? Array.from(ids) : null;
}

// ── Output shaping ──

const COMPACT_FIELDS = [
  "_id",
  "_creationTime",
  "mailboxId",
  "folder",
  "from",
  "to",
  "subject",
  "date",
  "read",
  "starred",
  "hasAttachments",
  "deliveryStatus",
  "deliveredAt",
  "openedAt",
  "repliedAt",
  "scheduledAt",
  "batchId",
  "messageId",
];

function project(
  doc: Doc<"emails">,
  select: string[] | undefined,
  full: boolean,
  mailboxAddress: string | undefined
): Record<string, unknown> {
  const source = doc as unknown as Record<string, unknown>;
  if (full) return { ...source, mailbox: mailboxAddress };
  const fields = select && select.length > 0 ? select : COMPACT_FIELDS;
  const out: Record<string, unknown> = {};
  for (const field of fields) out[field] = source[field];
  if (mailboxAddress) out.mailbox = mailboxAddress;
  // The raw epoch is unreadable in the dashboard table, so the sent/received
  // time is echoed in a form a human can check against a support ticket.
  if (typeof doc.date === "number") out.dateReadable = new Date(doc.date).toISOString();
  return out;
}

// ── The query ──

export const queryEmails = internalQuery({
  args: {
    filter: v.optional(v.string()),
    where: v.optional(v.record(v.string(), condition)),
    mailbox: v.optional(v.string()),
    domain: v.optional(v.string()),
    userEmail: v.optional(v.string()),
    limit: v.optional(v.number()),
    countOnly: v.optional(v.boolean()),
    groupBy: v.optional(v.array(v.string())),
    full: v.optional(v.boolean()),
    select: v.optional(v.array(v.string())),
    sortBy: v.optional(v.union(v.literal("date"), v.literal("_creationTime"))),
    order: v.optional(v.union(v.literal("desc"), v.literal("asc"))),
    maxScan: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 1000);
    const maxScan = Math.min(Math.max(args.maxScan ?? 20000, 1), 30000);
    const sortBy = args.sortBy ?? "date";
    const order = args.order ?? "desc";
    const collecting = !args.countOnly && !(args.groupBy && args.groupBy.length > 0);

    const parsed = args.filter ? parseFilter(args.filter) : { where: {}, ignored: [] };
    // The JSON `where` is applied last so it overrides the string on any field
    // the two disagree about.
    const where: Where = { ...parsed.where, ...(args.where ?? {}) };

    const mailboxIds = await resolveMailboxIds(ctx, args, where);
    if (mailboxIds !== null && mailboxIds.length === 0) {
      return {
        source: "no matching mailbox",
        where,
        unparsedFilterClauses: parsed.ignored,
        count: 0,
        scanned: 0,
        truncated: false,
        emails: [],
      };
    }

    const folders = eqList(where.folder)?.filter((f): f is string => typeof f === "string");
    const { lower, upper } = dateBounds(where.date);
    const messageId = singleEq(where.messageId);
    const sesMessageId = singleEq(where.sesMessageId);

    // One entry per indexed read to run. Several mailboxes, or several
    // folders, mean several reads whose results are merged and re-sorted.
    const sources: Array<() => AsyncIterable<Doc<"emails">>> = [];
    let sourceLabel: string;

    if (mailboxIds !== null && folders && folders.length > 0) {
      sourceLabel = "index by_mailbox_folder_date";
      for (const mailboxId of mailboxIds) {
        for (const folder of folders) {
          sources.push(() =>
            ctx.db
              .query("emails")
              .withIndex("by_mailbox_folder_date", (q) => {
                const base = q.eq("mailboxId", mailboxId).eq("folder", folder);
                if (lower !== undefined && upper !== undefined) {
                  return base.gte("date", lower).lte("date", upper);
                }
                if (lower !== undefined) return base.gte("date", lower);
                if (upper !== undefined) return base.lte("date", upper);
                return base;
              })
              .order(order)
          );
        }
      }
    } else if (mailboxIds !== null) {
      sourceLabel = "index by_mailbox_folder";
      for (const mailboxId of mailboxIds) {
        sources.push(() =>
          ctx.db
            .query("emails")
            .withIndex("by_mailbox_folder", (q) => q.eq("mailboxId", mailboxId))
            .order(order)
        );
      }
    } else if (typeof messageId === "string") {
      sourceLabel = "index by_message_id";
      sources.push(() =>
        ctx.db
          .query("emails")
          .withIndex("by_message_id", (q) => q.eq("messageId", messageId))
          .order(order)
      );
    } else if (typeof sesMessageId === "string") {
      sourceLabel = "index by_ses_message_id";
      sources.push(() =>
        ctx.db
          .query("emails")
          .withIndex("by_ses_message_id", (q) => q.eq("sesMessageId", sesMessageId))
          .order(order)
      );
    } else {
      // Nothing indexable in the filter, so walk the table newest first and
      // stop at maxScan. Pass mailbox / domain / a folder to avoid this.
      sourceLabel = "full table scan";
      sources.push(() => ctx.db.query("emails").order(order));
    }

    const collected: Doc<"emails">[] = [];
    const groups = new Map<string, { key: Record<string, unknown>; count: number }>();
    let scanned = 0;
    let count = 0;
    let truncated = false;

    for (const makeSource of sources) {
      // Per source cap: with several mailboxes or folders in play, each read
      // needs room to return its own newest `limit` documents so the merged
      // ordering below is right.
      let takenFromSource = 0;
      for await (const doc of makeSource()) {
        if (scanned >= maxScan) {
          truncated = true;
          break;
        }
        scanned++;
        if (!matchesWhere(doc, where)) continue;
        count++;

        if (args.groupBy && args.groupBy.length > 0) {
          const key: Record<string, unknown> = {};
          for (const field of args.groupBy) {
            key[field] = (doc as unknown as Record<string, unknown>)[field] ?? null;
          }
          const serialized = JSON.stringify(key);
          const existing = groups.get(serialized);
          if (existing) existing.count++;
          else groups.set(serialized, { key, count: 1 });
          continue;
        }

        if (collecting) {
          collected.push(doc);
          takenFromSource++;
          if (takenFromSource >= limit) break;
        }
      }
      if (truncated) break;
    }

    // Merge the per source results into one ordering. Single source queries
    // are already ordered by the index, so this only ever re-sorts a merge or
    // a request that sorts by `date` while reading a non date index.
    if (collecting && (sources.length > 1 || sortBy === "date")) {
      collected.sort((a, b) => {
        const left = sortBy === "date" ? a.date : a._creationTime;
        const right = sortBy === "date" ? b.date : b._creationTime;
        return order === "desc" ? right - left : left - right;
      });
    }
    const page = collecting ? collected.slice(0, limit) : [];

    // Mailbox addresses for the returned rows only, so a result is readable
    // without pasting ids back into the dashboard.
    const addresses = new Map<string, string>();
    for (const doc of page) {
      if (addresses.has(doc.mailboxId)) continue;
      const mailbox = await ctx.db.get(doc.mailboxId);
      addresses.set(doc.mailboxId, mailbox?.fullAddress ?? "(deleted mailbox)");
    }

    return {
      source: sourceLabel,
      where,
      // Anything in `filter` that did not parse is reported rather than
      // silently dropped, because a typo that removes a condition would
      // otherwise look like a real answer.
      unparsedFilterClauses: parsed.ignored,
      count,
      returned: page.length,
      scanned,
      truncated,
      ...(args.groupBy && args.groupBy.length > 0
        ? {
            groups: Array.from(groups.values()).sort((a, b) => b.count - a.count),
          }
        : {}),
      emails: page.map((doc) =>
        project(doc, args.select, args.full ?? false, addresses.get(doc.mailboxId))
      ),
    };
  },
});
