"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { usePaginatedQuery, useQuery, useMutation, useAction } from "convex/react";
import { sendErrorMessage } from "@/lib/sendErrors";
import { api } from "../../../../convex/_generated/api";
import { Doc, Id } from "../../../../convex/_generated/dataModel";
import { useSidebar } from "../../../components/SidebarContext";
import { Users } from "lucide-react";
import { marked } from "marked";
import { resolveMergeFields, extractMergeFields } from "@/lib/mergeFields";
import { parseCSV, detectEmailColumn } from "@/lib/csvParser";
import LoadMoreSentinel from "../../../components/LoadMoreSentinel";

const ENROLLMENTS_PAGE_SIZE = 50;
import MergeFieldToolbar from "./components/MergeFieldToolbar";
import MergePreview from "./components/MergePreview";
import EmailBodyFrame from "./components/EmailBodyFrame";
import type { MergeRecipient } from "./components/MergeImport";

const folderConfig: { key: string; label: string; navHidden?: boolean }[] = [
  { key: "inbox", label: "Inbox" },
  { key: "sent", label: "Sent" },
  { key: "outbox", label: "Outbox" },
  { key: "drafts", label: "Drafts" },
  { key: "follow-ups", label: "Follow-ups" },
];

const folderIcons: Record<string, string> = {
  inbox: "M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.1 13.177a2.25 2.25 0 00-.1.661z",
  sent: "M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5",
  outbox: "M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15m0-3l-3-3m0 0l-3 3m3-3V15",
  drafts: "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10",
  "follow-ups": "M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3",
  campaigns: "M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46",
};

function timeAgo(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function getDisplayName(emailStr: string, contactMap?: Map<string, string>): string {
  // Extract name from "Name <email>" format
  const match = emailStr.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  // Look up in contacts by raw email address
  if (contactMap) {
    const name = contactMap.get(emailStr.toLowerCase());
    if (name) return name;
  }
  // Fallback: local part of email
  const atIndex = emailStr.indexOf("@");
  if (atIndex > 0) return emailStr.substring(0, atIndex);
  return emailStr;
}

function DeliveryStatusIcon({
  deliveryStatus,
  openedAt,
  pendingCount,
  deliveredCount,
  openedCount,
  isBatch = false,
}: {
  deliveryStatus?: string;
  openedAt?: number;
  pendingCount?: number;
  deliveredCount?: number;
  openedCount?: number;
  isBatch?: boolean;
}) {
  // Batch mode: show aggregate counts with badges
  if (isBatch) {
    const pending = pendingCount ?? 0;
    const delivered = deliveredCount ?? 0;
    const opened = openedCount ?? 0;
    if (pending === 0 && delivered === 0 && opened === 0) return null;
    return (
      <div className="flex items-center gap-2">
        {pending > 0 && (
          <span title={`${pending} pending`} className="relative inline-flex items-center text-gray-400 dark:text-gray-500">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
            </svg>
            <span className="absolute -top-1.5 -right-1.5 flex min-w-[14px] h-3.5 items-center justify-center rounded-full bg-gray-400 dark:bg-gray-500 px-0.5 text-[8px] font-bold leading-none text-white">
              {pending > 99 ? "99+" : pending}
            </span>
          </span>
        )}
        {delivered > 0 && (
          <span title={`${delivered} delivered`} className="relative inline-flex items-center text-green-500">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span className="absolute -top-1.5 -right-1.5 flex min-w-[14px] h-3.5 items-center justify-center rounded-full bg-green-500 px-0.5 text-[8px] font-bold leading-none text-white">
              {delivered > 99 ? "99+" : delivered}
            </span>
          </span>
        )}
        {opened > 0 && (
          <span title={`${opened} opened`} className="relative inline-flex items-center text-green-600">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <svg className="h-3.5 w-3.5 -ml-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            <span className="absolute -top-1.5 -right-1.5 flex min-w-[14px] h-3.5 items-center justify-center rounded-full bg-green-600 px-0.5 text-[8px] font-bold leading-none text-white">
              {opened > 99 ? "99+" : opened}
            </span>
          </span>
        )}
      </div>
    );
  }

  // Single email mode (original behaviour)
  // Double tick (blue) = email was opened by recipient
  if (openedAt) {
    return (
      <span title={`Opened ${timeAgo(openedAt)}`} className="inline-flex items-center text-green-600">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        <svg className="h-3.5 w-3.5 -ml-1.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </span>
    );
  }
  // Single tick (gray) = delivered to mailbox
  if (deliveryStatus === "delivered") {
    return (
      <span title="Delivered" className="inline-flex items-center text-green-500">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </span>
    );
  }
  // Failed delivery
  if (deliveryStatus === "failed" || deliveryStatus === "bounced") {
    return (
      <span title={deliveryStatus === "failed" ? "Delivery failed" : "Bounced"} className="inline-flex items-center text-red-400">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
    );
  }
  // Pending / sending (clock icon)
  if (deliveryStatus === "pending") {
    return (
      <span title="Sending…" className="inline-flex items-center text-gray-300 dark:text-gray-600">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
        </svg>
      </span>
    );
  }
  return null;
}

function getRawEmail(emailStr: string): string {
  const match = emailStr.match(/<([^>]+)>/);
  if (match) return match[1];
  return emailStr;
}

function MailboxSidebarItem({ mb, currentMailboxId, onNavigate }: { mb: Doc<"mailboxes">; currentMailboxId: Id<"mailboxes">; onNavigate?: () => void }) {
  const unread = useQuery(api.emails.countUnreadByMailbox, { mailboxId: mb._id });
  return (
    <Link
      href={`/mailbox/${mb._id}`}
      // Switching mailboxes is navigation like any other sidebar entry, so it
      // has to dismiss the mobile drawer too.
      onClick={onNavigate}
      className={`flex items-center justify-between truncate rounded-md px-2 py-1 text-[10px] transition-colors ${mb._id === currentMailboxId
        ? "bg-violet-50 dark:bg-violet-900/20 font-medium text-violet-700 dark:text-violet-300"
        : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        }`}
    >
      <span className="truncate">{mb.fullAddress}</span>
      {unread && unread > 0 && mb._id !== currentMailboxId && (
        <span className="ml-1 shrink-0 rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {unread}
        </span>
      )}
    </Link>
  );
}

export default function MailboxPage() {
  const { mailboxId } = useParams<{ mailboxId: string }>();
  const mbId = mailboxId as Id<"mailboxes">;

  const mailbox = useQuery(api.mailboxes.getById, { mailboxId: mbId });
  const domainMailboxes = useQuery(
    api.mailboxes.listByDomain,
    mailbox?.domainId ? { domainId: mailbox.domainId } : "skip"
  );
  const [activeFolder, setActiveFolder] = useState("inbox");
  const [currentPage, setCurrentPage] = useState(0);
  const [pageCursors, setPageCursors] = useState<(string | null)[]>([null]);

  const paginatedResult = useQuery(api.emails.listByFolderPaginated, {
    mailboxId: mbId,
    folder: activeFolder,
    paginationOpts: { numItems: 50, cursor: pageCursors[currentPage] ?? null },
  });
  const emails = useMemo(() => paginatedResult?.page ?? [], [paginatedResult]);
  const totalCount = useQuery(api.emails.countByFolder, {
    mailboxId: mbId,
    folder: activeFolder,
  });
  // Old: pull the entire inbox down just to count the unread ones.
  // const inboxEmails = useQuery(api.emails.listByFolder, {
  //   mailboxId: mbId,
  //   folder: "inbox",
  // });
  // const unreadCount = inboxEmails?.filter((e: Doc<"emails">) => !e.read).length ?? 0;
  const unreadCount = useQuery(api.emails.countUnreadByMailbox, { mailboxId: mbId }) ?? 0;
  // Old: read the entire address book to resolve the names on one screen. That
  // is a full table scan per mailbox open, and it grows with the account while
  // the page it feeds always shows the same fifty rows.
  // const contacts = useQuery(api.contacts.listForCurrentUser);
  // // Build a lookup map: raw email → display name
  // const contactNameMap = new Map<string, string>();
  // contacts?.forEach((c) => contactNameMap.set(c.email, c.name));

  // Now: ask only for the addresses on this page of mail. Keyed off a sorted
  // string so the query args keep their identity between renders and the
  // lookup only re-runs when the addresses themselves change.
  const visibleAddressKey = useMemo(() => {
    const seen = new Set<string>();
    for (const email of emails) {
      for (const addr of [email.from, ...email.to, ...(email.cc ?? [])]) {
        // A "Name <addr>" string carries its own name and never reaches the
        // map, so only bare addresses are worth asking about.
        if (addr && !addr.includes("<")) seen.add(addr.toLowerCase().trim());
      }
    }
    return [...seen].sort().join(",");
  }, [emails]);

  const nameLookupArgs = useMemo(
    () => (visibleAddressKey ? { emails: visibleAddressKey.split(",") } : ("skip" as const)),
    [visibleAddressKey]
  );
  const contactNames = useQuery(api.contacts.namesByEmails, nameLookupArgs);
  // Build a lookup map: raw email → display name
  const contactNameMap = useMemo(
    () =>
      new Map<string, string>(
        (contactNames ?? []).map((c) => [c.email, c.name] as [string, string])
      ),
    [contactNames]
  );
  const senderGroups = useQuery(api.senderGroups.list, { mailboxId: mbId });
  const createSenderGroup = useMutation(api.senderGroups.create);
  const updateSenderGroup = useMutation(api.senderGroups.update);
  const updateGroupMailboxes = useMutation(api.senderGroups.updateMailboxes);
  const removeSenderGroup = useMutation(api.senderGroups.remove);
  const markAsRead = useMutation(api.emails.markAsRead);
  const markAllAsRead = useMutation(api.emails.markAllAsRead);
  const markAsUnread = useMutation(api.emails.markAsUnread);
  const toggleStar = useMutation(api.emails.toggleStar);
  const moveToFolder = useMutation(api.emails.moveToFolder);
  const sendEmail = useAction(api.ses.sendEmail);
  // The compose box now asks MillionVerifier about the mailbox rather than DNS
  // about the domain. Same shape of answer, but it can actually tell that an
  // address does not exist, which is the case that was bouncing.
  const verifyEmailsAction = useAction(api.verification.verifyForCurrentUser);
  const scheduleEmailAction = useAction(api.ses.scheduleEmail);
  const createAndEnrollSequence = useAction(api.sequenceActions.createAndEnrollWithFirstSent);
  const mailboxSequences = useQuery(api.sequenceActions.getByMailbox, { mailboxId: mbId });
  const pauseSequence = useMutation(api.sequenceActions.pause);
  const resumeSequence = useMutation(api.sequenceActions.resume);
  const cancelSequence = useMutation(api.sequenceActions.cancel);
  const cancelEnrollment = useMutation(api.sequenceActions.cancelEnrollment);
  const [expandedSequenceId, setExpandedSequenceId] = useState<Id<"sequences"> | null>(null);
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<Set<string>>(new Set());
  // Old: read every enrollment on the sequence at once.
  // const sequenceEnrollments = useQuery(
  //   api.sequenceActions.listEnrollments,
  //   expandedSequenceId ? { sequenceId: expandedSequenceId } : "skip"
  // );
  const {
    results: sequenceEnrollments,
    status: enrollmentStatus,
    loadMore: loadMoreEnrollments,
  } = usePaginatedQuery(
    api.sequenceActions.listEnrollmentsPage,
    expandedSequenceId ? { sequenceId: expandedSequenceId } : "skip",
    { initialNumItems: ENROLLMENTS_PAGE_SIZE }
  );
  const onLoadMoreEnrollments = useCallback(
    () => loadMoreEnrollments(ENROLLMENTS_PAGE_SIZE),
    [loadMoreEnrollments]
  );
  const loadedActiveEnrollments = useMemo(
    () => sequenceEnrollments.filter((e) => e.status === "active"),
    [sequenceEnrollments]
  );
  const cancelScheduledEmailMutation = useMutation(api.emails.cancelScheduledEmail);
  const fetchEmailBody = useAction(api.ses.fetchEmailBody);
  const getAttachment = useAction(api.ses.getAttachment);
  const updateSignature = useMutation(api.mailboxes.updateSignature);

  const [selectedEmailId, setSelectedEmailId] = useState<Id<"emails"> | null>(null);
  const [emailBody, setEmailBody] = useState<string | null>(null);
  const [loadingBody, setLoadingBody] = useState(false);
  const [emailAttachments, setEmailAttachments] = useState<
    Array<{ filename: string; contentType: string; size: number }>
  >([]);
  const emailBodyCache = useRef<Map<string, { body: string; attachments: Array<{ filename: string; contentType: string; size: number }> }>>(new Map());
  const [downloadingAttachment, setDownloadingAttachment] = useState<number | null>(null);
  const [showEmailIds, setShowEmailIds] = useState(false);
  const [sendMode, setSendMode] = useState<"send" | "campaign">("send");
  const [showSendDropdown, setShowSendDropdown] = useState(false);
  const sendDropdownRef = useRef<HTMLDivElement>(null);

  // Mail merge state
  const [mergeRecipients, setMergeRecipients] = useState<MergeRecipient[]>([]);
  const [mergeColumns, setMergeColumns] = useState<string[]>([]);
  const [mergeEmailColumn, setMergeEmailColumn] = useState("");
  const [mergePreviewIndex, setMergePreviewIndex] = useState(0);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const lastMergeTarget = useRef<"subject" | "body">("body");

  type ComposeMode = "compose" | "reply" | "replyAll" | "forward";
  const [showCompose, setShowCompose] = useState(false);
  const [composeMode, setComposeMode] = useState<ComposeMode>("compose");
  const [composeTo, setComposeTo] = useState<string[]>([]);
  const [composeGroupIds, setComposeGroupIds] = useState<Id<"senderGroups">[]>([]);
  const [composeToInput, setComposeToInput] = useState("");
  const [composeCc, setComposeCc] = useState<string[]>([]);
  const [composeCcInput, setComposeCcInput] = useState("");
  const [composeBcc, setComposeBcc] = useState<string[]>([]);
  const [composeBccInput, setComposeBccInput] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  type ComposeContentType = "plain" | "markdown" | "html";
  const [composeContentType, setComposeContentType] = useState<ComposeContentType>("plain");
  const [showPreview, setShowPreview] = useState(false);
  const [composeSignature, setComposeSignature] = useState("");
  const [composeQuote, setComposeQuote] = useState("");
  const [signatureText, setSignatureText] = useState("");
  const [showSignatureEditor, setShowSignatureEditor] = useState(false);
  const signatureEditorRef = useRef<HTMLTextAreaElement>(null);
  type AttachmentEntry = {
    id: number;
    filename: string;
    size: number;
    contentType: string;
    status: "uploading" | "uploaded";
    data?: string; // base64
  };
  const [composeAttachments, setComposeAttachments] = useState<AttachmentEntry[]>([]);
  const attachmentIdRef = useRef(0);
  type FollowUpStep = { delayDays: number; subject: string; body: string };
  const [followUpSteps, setFollowUpSteps] = useState<FollowUpStep[]>([]);
  const [showFollowUps, setShowFollowUps] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvImportRef = useRef<HTMLInputElement>(null);
  const importMenuRef = useRef<HTMLDivElement>(null);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [showGSheetsInput, setShowGSheetsInput] = useState(false);
  const [gSheetsUrl, setGSheetsUrl] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Sender group management state
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Id<"senderGroups"> | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupEmails, setGroupEmails] = useState<string[]>([]);
  const [groupEmailInput, setGroupEmailInput] = useState("");
  const [groupMailboxIds, setGroupMailboxIds] = useState<Id<"mailboxes">[]>([]);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const groupPickerRef = useRef<HTMLDivElement>(null);
  const [showGroupImportMenu, setShowGroupImportMenu] = useState(false);
  const [showGroupGSheetsInput, setShowGroupGSheetsInput] = useState(false);
  const [groupGSheetsUrl, setGroupGSheetsUrl] = useState("");
  const [groupImportError, setGroupImportError] = useState<string | null>(null);
  const [isGroupImporting, setIsGroupImporting] = useState(false);
  const groupImportMenuRef = useRef<HTMLDivElement>(null);
  const groupCsvImportRef = useRef<HTMLInputElement>(null);

  const isValidEmail = (email: string) =>
    /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email);

  const parseEmailsFromCSV = (text: string): string[] => {
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    return [...new Set(text.match(emailRegex) ?? [])];
  };

  const handleGroupCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const emails = parseEmailsFromCSV(text);
      if (emails.length === 0) {
        setGroupImportError("No email addresses found in the CSV.");
      } else {
        setGroupEmails((prev) => [...new Set([...prev, ...emails])]);
        setShowGroupImportMenu(false);
        setGroupImportError(null);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleGroupGSheetsImport = async () => {
    if (!groupGSheetsUrl.trim()) return;
    setGroupImportError(null);
    setIsGroupImporting(true);
    try {
      const res = await fetch(`/api/fetch-csv?url=${encodeURIComponent(groupGSheetsUrl.trim())}`);
      if (!res.ok) throw new Error("Failed to fetch sheet");
      const text = await res.text();
      const emails = parseEmailsFromCSV(text);
      if (emails.length === 0) {
        setGroupImportError("No email addresses found in the sheet.");
      } else {
        setGroupEmails((prev) => [...new Set([...prev, ...emails])]);
        setGroupGSheetsUrl("");
        setShowGroupGSheetsInput(false);
        setShowGroupImportMenu(false);
        setGroupImportError(null);
      }
    } catch {
      setGroupImportError("Could not fetch the sheet. Make sure it is publicly accessible.");
    } finally {
      setIsGroupImporting(false);
    }
  };

  const processImportedCSV = (text: string) => {
    const parsed = parseCSV(text);
    // If CSV has headers and multiple columns, use structured mail merge
    if (parsed.headers.length > 1 && parsed.rows.length > 0) {
      const emailCol = detectEmailColumn(parsed.headers, parsed.rows);
      if (!emailCol) {
        setImportError("No email column detected in the CSV.");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const recipients: MergeRecipient[] = parsed.rows
        .filter((row) => emailRegex.test(row[emailCol]?.trim() ?? ""))
        .map((row) => ({ email: row[emailCol].trim(), fields: { ...row } }));
      if (recipients.length === 0) {
        setImportError("No valid email addresses found.");
        return;
      }
      setMergeRecipients(recipients);
      setMergeColumns(parsed.headers);
      setMergeEmailColumn(emailCol);
      setMergePreviewIndex(0);
      setComposeTo([]);
      setComposeToInput("");
      setShowImportMenu(false);
      setImportError(null);
      return;
    }
    // Fallback: single-column or no headers - extract emails
    const emails = parseEmailsFromCSV(text);
    if (emails.length === 0) {
      setImportError("No email addresses found in the CSV.");
    } else {
      setComposeTo((prev) => [...new Set([...prev, ...emails])]);
      setShowImportMenu(false);
      setImportError(null);
    }
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      processImportedCSV(ev.target?.result as string);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleGSheetsImport = async () => {
    if (!gSheetsUrl.trim()) return;
    setImportError(null);
    setIsImporting(true);
    try {
      const res = await fetch(`/api/fetch-csv?url=${encodeURIComponent(gSheetsUrl.trim())}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to fetch sheet");
      }
      const text = await res.text();
      processImportedCSV(text);
      setGSheetsUrl("");
      setShowGSheetsInput(false);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Could not fetch the sheet. Make sure it is publicly accessible.");
    } finally {
      setIsImporting(false);
    }
  };

  const resetGroupImportState = () => {
    setShowGroupImportMenu(false);
    setShowGroupGSheetsInput(false);
    setGroupGSheetsUrl("");
    setGroupImportError(null);
  };

  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupName("");
    setGroupEmails([]);
    setGroupEmailInput("");
    setGroupMailboxIds([mbId]);
    resetGroupImportState();
    setShowGroupModal(true);
  };

  const openEditGroup = (group: Doc<"senderGroups">) => {
    setEditingGroup(group._id);
    setGroupName(group.name);
    setGroupEmails([...group.emails]);
    setGroupEmailInput("");
    setGroupMailboxIds([...group.mailboxIds]);
    resetGroupImportState();
    setShowGroupModal(true);
  };

  const handleSaveGroup = async () => {
    const name = groupName.trim();
    if (!name || groupEmails.length === 0 || groupMailboxIds.length === 0) return;
    if (editingGroup) {
      await updateSenderGroup({ id: editingGroup, name, emails: groupEmails });
      await updateGroupMailboxes({ id: editingGroup, mailboxIds: groupMailboxIds });
    } else {
      await createSenderGroup({ mailboxId: mbId, name, emails: groupEmails });
    }
    setShowGroupModal(false);
  };

  const handleDeleteGroup = async (id: Id<"senderGroups">) => {
    await removeSenderGroup({ id });
    if (editingGroup === id) setShowGroupModal(false);
  };

  const addGroupToRecipients = (group: Doc<"senderGroups">) => {
    setComposeGroupIds((prev) => prev.includes(group._id) ? prev : [...prev, group._id]);
    setShowGroupPicker(false);
  };

  // Resolve all recipients: individual emails + expanded group emails, deduplicated
  const resolveAllRecipients = () => {
    const groupEmails = (senderGroups ?? [])
      .filter((g) => composeGroupIds.includes(g._id))
      .flatMap((g) => g.emails);
    const pendingInput = composeToInput.trim();
    const all = [...composeTo, ...groupEmails];
    if (pendingInput && isValidEmail(pendingInput)) all.push(pendingInput);
    return [...new Set(all)];
  };

  const processFiles = (files: File[]) => {
    const newEntries: AttachmentEntry[] = files.map((file) => ({
      id: ++attachmentIdRef.current,
      filename: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
      status: "uploading" as const,
    }));
    setComposeAttachments((prev) => [...prev, ...newEntries]);

    // Encode each file to base64 in background
    newEntries.forEach((entry, i) => {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1] ?? "";
        setComposeAttachments((prev) =>
          prev.map((att) =>
            att.id === entry.id ? { ...att, status: "uploaded", data: base64 } : att
          )
        );
      };
      reader.onerror = () => {
        // Remove failed entry
        setComposeAttachments((prev) => prev.filter((att) => att.id !== entry.id));
      };
      reader.readAsDataURL(file);
    });
  };

  const isAnyUploading = composeAttachments.some((att) => att.status === "uploading");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [verificationResults, setVerificationResults] = useState<Record<string, { isValid: boolean; reason?: string; result?: string }>>({});
  const [isVerifying, setIsVerifying] = useState(false);
  const verifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showRecipientBreakdown, setShowRecipientBreakdown] = useState(false);
  const [scheduledSendAt, setScheduledSendAt] = useState<number | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduleCustomDate, setScheduleCustomDate] = useState("");
  const [scheduleCustomTime, setScheduleCustomTime] = useState("08:00");
  const schedulePickerRef = useRef<HTMLDivElement>(null);
  const [recipientFilter, setRecipientFilter] = useState<"all" | "pending" | "delivered" | "opened">("all");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [mailSearch, setMailSearch] = useState("");

  const isLoading = mailbox === undefined || paginatedResult === undefined;

  const selectedEmail = emails.find((e: Doc<"emails">) => e._id === selectedEmailId);

  // Store the next page cursor when results arrive
  useEffect(() => {
    if (paginatedResult && !paginatedResult.isDone && paginatedResult.continueCursor) {
      setPageCursors((prev) => {
        if (prev[currentPage + 1]) return prev;
        const next = [...prev];
        next[currentPage + 1] = paginatedResult.continueCursor;
        return next;
      });
    }
  }, [paginatedResult, currentPage]);

  // Reset pagination when the active folder changes
  useEffect(() => {
    setCurrentPage(0);
    setPageCursors([null]);
    setSelectedEmailId(null);
    setMailSearch("");
  }, [activeFolder]);

  // Group sent/outbox emails by batchId so multi-recipient sends appear as one row
  type EmailGroup = {
    key: string;
    representative: Doc<"emails">;
    allEmails: Doc<"emails">[];
    isBatch: boolean;
    pendingCount: number;
    deliveredCount: number;
    openedCount: number;
  };

  const emailGroups: EmailGroup[] = useMemo(() => {
    if (emails.length === 0) return [];
    if (activeFolder !== "sent" && activeFolder !== "outbox") {
      return emails.map((e: Doc<"emails">) => ({
        key: e._id,
        representative: e,
        allEmails: [e],
        isBatch: false,
        pendingCount: 0,
        deliveredCount: 0,
        openedCount: 0,
      }));
    }
    // Group by batchId; ungrouped emails are their own group
    const groupMap = new Map<string, Doc<"emails">[]>();
    for (const email of emails as Doc<"emails">[]) {
      const key = email.batchId ?? `solo-${email._id}`;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(email);
    }
    return [...groupMap.entries()].map(([key, groupEmails]) => {
      const rep = groupEmails[0];
      const isBatch = groupEmails.length > 1;
      const pendingCount = groupEmails.filter((e) => e.deliveryStatus === "pending").length;
      const openedCount = groupEmails.filter((e) => !!e.openedAt).length;
      const deliveredCount = groupEmails.filter((e) => e.deliveryStatus === "delivered" && !e.openedAt).length;
      return { key, representative: rep, allEmails: groupEmails, isBatch, pendingCount, deliveredCount, openedCount };
    });
  }, [emails, activeFolder]);

  const filteredEmailGroups = useMemo(() => {
    const term = mailSearch.toLowerCase().trim();
    if (!term) return emailGroups;
    return emailGroups.filter((group) => {
      return group.allEmails.some((e) => {
        const fromStr = e.from.toLowerCase();
        const toStr = e.to.join(" ").toLowerCase();
        const subject = e.subject.toLowerCase();
        const snippet = e.snippet.toLowerCase();
        return (
          subject.includes(term) ||
          snippet.includes(term) ||
          fromStr.includes(term) ||
          toStr.includes(term)
        );
      });
    });
  }, [emailGroups, mailSearch]);

  const handleSelectEmail = async (emailId: Id<"emails">) => {
    if (showCompose) {
      resetComposeState();
    }
    setSelectedEmailId(emailId);
    setExpandedSequenceId(null);
    setSelectedEnrollmentIds(new Set());
    setEmailBody(null);
    setEmailAttachments([]);

    const email = emails.find((e: Doc<"emails">) => e._id === emailId);
    if (email && !email.read) {
      await markAsRead({ emailId });
    }

    // Fetch full body from S3 (or serve from in-memory cache)
    if (email) {
      const cacheKey = emailId as string;
      const cached = emailBodyCache.current.get(cacheKey);
      if (cached) {
        setEmailBody(cached.body);
        setEmailAttachments(cached.attachments);
      } else {
        setLoadingBody(true);
        try {
          const result = await fetchEmailBody({ s3Key: email.s3Key });
          // Strip tracking pixels only for sent/outbox/drafts so viewing your
          // own sent email doesn't falsely trigger the "opened" event.
          // Inbox emails should keep the pixel so it behaves normally.
          const shouldStripPixel = activeFolder !== "inbox";
          const body = shouldStripPixel
            ? result.body.replace(
                /<img[^>]*src="[^"]*\/track\/open\/[^"]*"[^>]*\/?>/gi,
                ""
              )
            : result.body;
          emailBodyCache.current.set(cacheKey, { body, attachments: result.attachments });
          setEmailBody(body);
          setEmailAttachments(result.attachments);
        } catch {
          setEmailBody("Failed to load email body.");
        } finally {
          setLoadingBody(false);
        }
      }
    }
  };

  const buildFullBody = () => {
    let bodyHtml: string;
    if (composeContentType === "markdown") {
      bodyHtml = marked.parse(composeBody) as string;
    } else if (composeContentType === "html") {
      bodyHtml = composeBody;
    } else {
      bodyHtml = composeBody.replace(/\n/g, "<br>");
    }
    const signaturePart = composeSignature
      ? `<br><br>-- <br>${marked.parse(composeSignature) as string}`
      : "";
    const quotePart = composeQuote ? `<br><br>${composeQuote}` : "";
    return bodyHtml + signaturePart + quotePart;
  };

  const previewHtml = useMemo(() => {
    if (!showPreview || composeContentType === "plain") return "";
    if (composeContentType === "markdown") {
      return marked.parse(composeBody) as string;
    }
    return composeBody;
  }, [composeBody, composeContentType, showPreview]);

  const resetComposeState = () => {
    setShowCompose(false);
    setShowSchedulePicker(false);
    setScheduledSendAt(null);
    setComposeTo([]);
    setComposeGroupIds([]);
    setComposeToInput("");
    setComposeCc([]);
    setComposeCcInput("");
    setComposeBcc([]);
    setComposeBccInput("");
    setShowCc(false);
    setShowBcc(false);
    setComposeSubject("");
    setComposeBody("");
    setComposeSignature("");
    setComposeQuote("");
    setComposeAttachments([]);
    setComposeContentType("plain");
    setShowPreview(false);
    setMergeRecipients([]);
    setMergeColumns([]);
    setMergeEmailColumn("");
    setMergePreviewIndex(0);
    setFollowUpSteps([]);
    setShowFollowUps(false);
    setVerificationResults({});
  };

  // Prefill from a handoff link, e.g. the admin domains panel sending an owner
  // a note about their pending setup. The body is generated server side and
  // fetched by id rather than passed through the URL, so the link stays short
  // and the copy stays in one place. Everything lands in the normal composer:
  // nothing is sent until the person here presses Send.
  const router = useRouter();
  const searchParams = useSearchParams();
  const noticeDomainId =
    searchParams.get("compose") === "domain-notice"
      ? searchParams.get("domainId")
      : null;
  const noticePrefill = useQuery(
    api.domains.pendingNoticePreview,
    noticeDomainId
      ? { domainId: noticeDomainId as Id<"domains"> }
      : "skip"
  );
  const noticePrefillApplied = useRef(false);

  useEffect(() => {
    if (!noticePrefill || noticePrefillApplied.current) return;
    noticePrefillApplied.current = true;

    setComposeMode("compose");
    setComposeTo(noticePrefill.recipient ? [noticePrefill.recipient] : []);
    setComposeSubject(noticePrefill.subject);
    setComposeContentType("html");
    setComposeBody(noticePrefill.html);
    setComposeSignature(mailbox?.signature ?? "");
    setShowCompose(true);

    // Drop the handoff parameters once applied, so refreshing after sending
    // does not reopen the same draft.
    router.replace(`/mailbox/${mbId}`, { scroll: false });
  }, [noticePrefill, mailbox?.signature, router, mbId]);

  const hasMergeData = mergeRecipients.length > 0;

  // Auto-switch to campaign when merge fields are used in subject/body
  const usesMergeFields = useMemo(() => {
    if (!hasMergeData) return false;
    return extractMergeFields(composeSubject + composeBody).length > 0;
  }, [hasMergeData, composeSubject, composeBody]);

  useEffect(() => {
    if (!hasMergeData) return;
    if (usesMergeFields && sendMode === "send") {
      setSendMode("campaign");
    } else if (!usesMergeFields && sendMode === "campaign") {
      setSendMode("send");
    }
  }, [usesMergeFields, hasMergeData]);

  // Auto-verify recipients when they change (debounced)
  useEffect(() => {
    const emailsToVerify = [...composeTo, ...(hasMergeData ? mergeRecipients.map((r) => r.email) : [])];
    // Only verify emails not already in cache
    const unverified = emailsToVerify.filter((e) => !(e.toLowerCase() in verificationResults));
    if (unverified.length === 0) return;

    if (verifyTimeoutRef.current) clearTimeout(verifyTimeoutRef.current);
    verifyTimeoutRef.current = setTimeout(async () => {
      setIsVerifying(true);
      try {
        const result = await verifyEmailsAction({ emails: unverified });
        setVerificationResults((prev) => {
          const next = { ...prev };
          for (const r of result.results) {
            // result as well as reason: reason is MillionVerifier's sub-result and is
            // often absent, and "invalid" beats "Invalid" as a fallback.
            next[r.email.toLowerCase()] = { isValid: r.isValid, reason: r.reason, result: r.result };
          }
          return next;
        });
      } catch {
        // Verification failure shouldn't block compose
      } finally {
        setIsVerifying(false);
      }
    }, 800);

    return () => {
      if (verifyTimeoutRef.current) clearTimeout(verifyTimeoutRef.current);
    };
  }, [composeTo, mergeRecipients, hasMergeData]);

  const handleSend = async () => {
    // Normal send: one email with all recipients in the To field
    const allRecipients = hasMergeData ? mergeRecipients.map((r) => r.email) : resolveAllRecipients();
    if (allRecipients.length === 0 || !composeSubject.trim()) return;
    setIsSending(true);
    setSendError(null);
    try {
      const fullBody = buildFullBody();
      const attachmentData = composeAttachments
        .filter((att) => att.status === "uploaded" && att.data)
        .map((att) => ({
          filename: att.filename,
          contentType: att.contentType,
          data: att.data!,
        }));
      const ccRecipients = [...composeCc, ...(composeCcInput.trim() && isValidEmail(composeCcInput.trim()) ? [composeCcInput.trim()] : [])];
      const bccRecipients = [...composeBcc, ...(composeBccInput.trim() && isValidEmail(composeBccInput.trim()) ? [composeBccInput.trim()] : [])];
      await sendEmail({
        mailboxId: mbId,
        to: allRecipients,
        cc: ccRecipients.length > 0 ? ccRecipients : undefined,
        bcc: bccRecipients.length > 0 ? bccRecipients : undefined,
        subject: composeSubject,
        body: fullBody,
        attachments: attachmentData.length > 0 ? attachmentData : undefined,
      });
      resetComposeState();
    } catch (err) {
      setSendError(sendErrorMessage(err, "Failed to send email. Please try again."));
    } finally {
      setIsSending(false);
    }
  };

  const handleSendCampaign = async () => {
    const recipients = hasMergeData ? mergeRecipients.map((r) => r.email) : resolveAllRecipients();
    if (recipients.length === 0 || !composeSubject.trim()) return;
    setIsSending(true);
    setSendError(null);
    try {
      const fullBody = buildFullBody();
      const attachmentData = composeAttachments
        .filter((att) => att.status === "uploaded" && att.data)
        .map((att) => ({ filename: att.filename, contentType: att.contentType, data: att.data! }));
      const batchId = `campaign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      if (hasMergeData) {
        for (const recipient of mergeRecipients) {
          const personalizedSubject = resolveMergeFields(composeSubject, recipient.fields);
          const personalizedBody = resolveMergeFields(fullBody, recipient.fields);
          await sendEmail({
            mailboxId: mbId,
            to: [recipient.email],
            subject: personalizedSubject,
            body: personalizedBody,
            attachments: attachmentData.length > 0 ? attachmentData : undefined,
            folder: "sent",
            batchId,
          });
        }
      } else {
        for (const recipient of recipients) {
          await sendEmail({
            mailboxId: mbId,
            to: [recipient],
            subject: composeSubject,
            body: fullBody,
            attachments: attachmentData.length > 0 ? attachmentData : undefined,
            folder: "sent",
            batchId,
          });
        }
      }
      if (followUpSteps.length > 0 && mailbox?.domainId) {
        const sequenceSteps: Array<{ type: "send_email"; subject: string; html: string } | { type: "delay"; delayMs: number }> = [
          { type: "send_email" as const, subject: composeSubject, html: fullBody },
        ];
        for (const fu of followUpSteps) {
          sequenceSteps.push({ type: "delay" as const, delayMs: fu.delayDays * 86400000 });
          sequenceSteps.push({ type: "send_email" as const, subject: fu.subject, html: fu.body });
        }
        const contacts = hasMergeData
          ? mergeRecipients.map((r) => ({ email: r.email, mergeFields: r.fields }))
          : recipients.map((email) => ({ email }));
        await createAndEnrollSequence({
          mailboxId: mbId,
          domainId: mailbox.domainId,
          name: `Follow-up: ${composeSubject.slice(0, 50)}`,
          steps: sequenceSteps,
          contacts,
        });
      }
      resetComposeState();
    } catch (err) {
      setSendError(sendErrorMessage(err, "Failed to send campaign. Please try again."));
    } finally {
      setIsSending(false);
    }
  };

  const handleScheduleSend = async (scheduledAt: number) => {
    const allRecipients = hasMergeData ? mergeRecipients.map((r) => r.email) : resolveAllRecipients();
    if (allRecipients.length === 0 || !composeSubject.trim()) return;
    setIsSending(true);
    setSendError(null);
    try {
      const fullBody = buildFullBody();
      const attachmentData = composeAttachments
        .filter((att) => att.status === "uploaded" && att.data)
        .map((att) => ({ filename: att.filename, contentType: att.contentType, data: att.data! }));
      const ccRecipients = [...composeCc, ...(composeCcInput.trim() && isValidEmail(composeCcInput.trim()) ? [composeCcInput.trim()] : [])];
      const bccRecipients = [...composeBcc, ...(composeBccInput.trim() && isValidEmail(composeBccInput.trim()) ? [composeBccInput.trim()] : [])];
      await scheduleEmailAction({
        mailboxId: mbId,
        to: allRecipients,
        cc: ccRecipients.length > 0 ? ccRecipients : undefined,
        bcc: bccRecipients.length > 0 ? bccRecipients : undefined,
        subject: composeSubject,
        body: fullBody,
        attachments: attachmentData.length > 0 ? attachmentData : undefined,
        scheduledAt,
      });
      resetComposeState();
    } catch (err) {
      setSendError(sendErrorMessage(err, "Failed to schedule email. Please try again."));
    } finally {
      setIsSending(false);
    }
  };

  const handleScheduleCampaign = async (scheduledAt: number) => {
    const recipients = hasMergeData ? mergeRecipients.map((r) => r.email) : resolveAllRecipients();
    if (recipients.length === 0 || !composeSubject.trim()) return;
    setIsSending(true);
    setSendError(null);
    try {
      const fullBody = buildFullBody();
      const attachmentData = composeAttachments
        .filter((att) => att.status === "uploaded" && att.data)
        .map((att) => ({ filename: att.filename, contentType: att.contentType, data: att.data! }));
      const batchId = `campaign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      if (hasMergeData) {
        for (const recipient of mergeRecipients) {
          const personalizedSubject = resolveMergeFields(composeSubject, recipient.fields);
          const personalizedBody = resolveMergeFields(fullBody, recipient.fields);
          await scheduleEmailAction({
            mailboxId: mbId,
            to: [recipient.email],
            subject: personalizedSubject,
            body: personalizedBody,
            attachments: attachmentData.length > 0 ? attachmentData : undefined,
            scheduledAt,
            batchId,
          });
        }
      } else {
        for (const recipient of recipients) {
          await scheduleEmailAction({
            mailboxId: mbId,
            to: [recipient],
            subject: composeSubject,
            body: fullBody,
            attachments: attachmentData.length > 0 ? attachmentData : undefined,
            scheduledAt,
            batchId,
          });
        }
      }
      if (followUpSteps.length > 0 && mailbox?.domainId) {
        const sequenceSteps: Array<{ type: "send_email"; subject: string; html: string } | { type: "delay"; delayMs: number }> = [
          { type: "send_email" as const, subject: composeSubject, html: fullBody },
        ];
        for (const fu of followUpSteps) {
          sequenceSteps.push({ type: "delay" as const, delayMs: fu.delayDays * 86400000 });
          sequenceSteps.push({ type: "send_email" as const, subject: fu.subject, html: fu.body });
        }
        const contacts = hasMergeData
          ? mergeRecipients.map((r) => ({ email: r.email, mergeFields: r.fields }))
          : recipients.map((email) => ({ email }));
        await createAndEnrollSequence({
          mailboxId: mbId,
          domainId: mailbox.domainId,
          name: `Follow-up: ${composeSubject.slice(0, 50)}`,
          steps: sequenceSteps,
          contacts,
        });
      }
      resetComposeState();
    } catch (err) {
      setSendError(sendErrorMessage(err, "Failed to schedule campaign. Please try again."));
    } finally {
      setIsSending(false);
    }
  };

  const handleInsertMergeField = (fieldName: string) => {
    const tag = `{${fieldName}}`;
    if (lastMergeTarget.current === "subject") {
      const input = subjectInputRef.current;
      if (input) {
        const start = input.selectionStart ?? composeSubject.length;
        const end = input.selectionEnd ?? composeSubject.length;
        const newSubject = composeSubject.slice(0, start) + tag + composeSubject.slice(end);
        setComposeSubject(newSubject);
        requestAnimationFrame(() => {
          input.focus();
          input.setSelectionRange(start + tag.length, start + tag.length);
        });
      } else {
        setComposeSubject((prev) => prev + tag);
      }
    } else {
      const textarea = bodyTextareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newBody = composeBody.slice(0, start) + tag + composeBody.slice(end);
        setComposeBody(newBody);
        requestAnimationFrame(() => {
          textarea.focus();
          textarea.setSelectionRange(start + tag.length, start + tag.length);
        });
      } else {
        setComposeBody((prev) => prev + tag);
      }
    }
  };

  useEffect(() => {
    if (!showSendDropdown) return;
    const handler = (e: MouseEvent) => {
      if (sendDropdownRef.current && !sendDropdownRef.current.contains(e.target as Node)) {
        setShowSendDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSendDropdown]);

  useEffect(() => {
    if (!showSchedulePicker) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close when interacting with native date/time picker chrome
      if (target.tagName === "INPUT" && (target.getAttribute("type") === "date" || target.getAttribute("type") === "time")) return;
      if (schedulePickerRef.current && !schedulePickerRef.current.contains(target)) {
        setShowSchedulePicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSchedulePicker]);

  useEffect(() => {
    if (!showImportMenu) return;
    const handler = (e: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) {
        setShowImportMenu(false);
        setShowGSheetsInput(false);
        setImportError(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showImportMenu]);

  useEffect(() => {
    if (!showGroupPicker) return;
    const handler = (e: MouseEvent) => {
      if (groupPickerRef.current && !groupPickerRef.current.contains(e.target as Node)) {
        setShowGroupPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showGroupPicker]);

  useEffect(() => {
    if (!showGroupImportMenu) return;
    const handler = (e: MouseEvent) => {
      if (groupImportMenuRef.current && !groupImportMenuRef.current.contains(e.target as Node)) {
        setShowGroupImportMenu(false);
        setShowGroupGSheetsInput(false);
        setGroupImportError(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showGroupImportMenu]);

  const handleMoveToTrash = async (emailId: Id<"emails">) => {
    await moveToFolder({ emailId, folder: "trash" });
    if (selectedEmailId === emailId) {
      setSelectedEmailId(null);
      setEmailBody(null);
    }
  };

  const handleOpenCompose = useCallback(() => {
    setComposeMode("compose");
    setComposeTo([]);
    setComposeGroupIds([]);
    setComposeToInput("");
    setComposeCc([]);
    setComposeCcInput("");
    setComposeBcc([]);
    setComposeBccInput("");
    setShowCc(false);
    setShowBcc(false);
    setComposeSubject("");
    setComposeBody("");
    setComposeSignature(mailbox?.signature ?? "");
    setComposeQuote("");
    setComposeAttachments([]);
    setSendError(null);
    setScheduledSendAt(null);
    setShowSchedulePicker(false);
    setShowCompose(true);
  }, [mailbox?.signature]);

  const { setFolderSection, closeMobile } = useSidebar();

  useEffect(() => {
    setFolderSection({
      render: (collapsed: boolean) => (
        <div className="px-3 pb-3">
          <div className="my-2 border-t border-gray-100 dark:border-gray-700" />
          {!collapsed && (
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Mailbox
            </p>
          )}
          <button
            onClick={() => { handleOpenCompose(); closeMobile(); }}
            title={collapsed ? "New email" : undefined}
            className={`mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700 ${collapsed ? "px-0" : ""}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {!collapsed && "New"}
          </button>
          <nav className="space-y-1">
            {folderConfig.filter((f) => !f.navHidden).map((folder) => (
              <button
                key={folder.key}
                onClick={() => {
                  setActiveFolder(folder.key);
                  setSelectedEmailId(null);
                  setExpandedSequenceId(null);
                  setSelectedEnrollmentIds(new Set());
                  setEmailBody(null);
                  closeMobile();
                }}
                title={collapsed ? folder.label : undefined}
                className={`flex w-full items-center ${collapsed ? "justify-center" : "justify-between"} rounded-md px-3 py-1.5 text-xs transition-colors ${activeFolder === folder.key
                  ? "bg-violet-50 dark:bg-violet-900/20 font-semibold text-violet-700 dark:text-violet-300"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
              >
                <span className={`flex items-center ${collapsed ? "" : "gap-2"}`}>
                  <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d={folderIcons[folder.key]} />
                  </svg>
                  {!collapsed && folder.label}
                </span>
                {!collapsed && folder.key === "inbox" && unreadCount > 0 && (
                  <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
          {!collapsed && (
            <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  <Users className="h-3 w-3" />
                  Groups
                </p>
                <button
                  onClick={openCreateGroup}
                  className="flex h-4 w-4 items-center justify-center rounded text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-violet-600 dark:hover:text-violet-400"
                  title="Create group"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              </div>
              <div className="space-y-0.5">
                {senderGroups?.map((group) => (
                  <button
                    key={group._id}
                    onClick={() => openEditGroup(group)}
                    className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{group.name}</span>
                    </span>
                    <span className="ml-1 shrink-0 text-[10px] text-gray-400 dark:text-gray-500">{group.emails.length}</span>
                  </button>
                ))}
                {senderGroups?.length === 0 && (
                  <p className="px-3 py-1 text-[10px] text-gray-400 dark:text-gray-500">No groups yet</p>
                )}
              </div>
            </div>
          )}
          {!collapsed && (
            <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Signature
                </p>
                <button
                  onClick={() => {
                    setSignatureText(mailbox?.signature ?? "");
                    setShowSignatureEditor(true);
                  }}
                  className="flex h-4 w-4 items-center justify-center rounded text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-violet-600 dark:hover:text-violet-400"
                  title="Edit signature"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  </svg>
                </button>
              </div>
              {mailbox?.signature ? (
                <p className="line-clamp-2 px-1 text-[10px] text-gray-500 dark:text-gray-400 whitespace-pre-wrap">{mailbox.signature}</p>
              ) : (
                <p className="px-1 text-[10px] italic text-gray-400 dark:text-gray-500">No signature set</p>
              )}
            </div>
          )}
          {!collapsed && domainMailboxes && domainMailboxes.length > 1 && (
            <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
              <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Mailboxes
              </p>
              <div className="space-y-1">
                {domainMailboxes.map((mb: Doc<"mailboxes">) => (
                  <MailboxSidebarItem key={mb._id} mb={mb} currentMailboxId={mbId} onNavigate={closeMobile} />
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    });
    return () => setFolderSection(null);
  }, [activeFolder, unreadCount, domainMailboxes, senderGroups, mbId, handleOpenCompose, setFolderSection, closeMobile, mailbox, updateSignature]);

  // Browser Back returns to the email list on mobile.
  //
  // On mobile the detail view (an open email, the compose form, or an expanded
  // sequence) replaces the list in place. It is component state, not a route,
  // so the browser had no entry for it: Back left the mailbox entirely instead
  // of going back to the list. Push a history entry when the detail opens on
  // mobile and close the detail when that entry is popped. Desktop shows the
  // list and the detail side by side, so it gets no extra entry.
  //
  // Pushing a state-only entry (no url) is safe under the App Router: Next
  // patches pushState to copy its own history state onto the new entry and to
  // leave the router alone when no url is passed, so popping this entry
  // dispatches a same-url traverse instead of the full page reload Next falls
  // back to for entries it does not recognise.
  const isDetailOpen = Boolean(selectedEmailId || showCompose || expandedSequenceId);
  const detailHistoryEntry = useRef(false);
  const closeDetailRef = useRef<() => void>(() => {});

  // Kept fresh every render so the popstate listener below can stay mounted
  // once and still close whichever detail is currently open.
  useEffect(() => {
    closeDetailRef.current = () => {
      if (showCompose) resetComposeState();
      setSelectedEmailId(null);
      setExpandedSequenceId(null);
      setSelectedEnrollmentIds(new Set());
    };
  });

  useEffect(() => {
    const handlePopState = () => {
      if (!detailHistoryEntry.current) return;
      detailHistoryEntry.current = false;
      closeDetailRef.current();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (isDetailOpen && !detailHistoryEntry.current) {
      // Only the mobile layout stacks the panes; 48rem is Tailwind's `md`.
      if (window.matchMedia("(min-width: 48rem)").matches) return;
      detailHistoryEntry.current = true;
      window.history.pushState({ mailboxDetail: true }, "");
    } else if (!isDetailOpen && detailHistoryEntry.current) {
      // Closed from the app's own UI (close button, folder switch): drop the
      // entry we added so a later Back does not land on a closed detail view.
      detailHistoryEntry.current = false;
      window.history.back();
    }
  }, [isDetailOpen]);

  const handleReply = () => {
    if (!selectedEmail || !emailBody) return;
    setComposeMode("reply");
    setComposeTo([getRawEmail(selectedEmail.from)]);
    setComposeGroupIds([]);
    setComposeToInput("");
    setComposeCc([]);
    setComposeCcInput("");
    setComposeBcc([]);
    setComposeBccInput("");
    setShowCc(false);
    setShowBcc(false);
    setComposeSubject(
      selectedEmail.subject.startsWith("Re:")
        ? selectedEmail.subject
        : `Re: ${selectedEmail.subject}`
    );
    setComposeBody("");
    setComposeSignature(mailbox?.signature ?? "");
    setComposeQuote(
      `<blockquote style="margin:0 0 0 .8ex;border-left:2px solid #ccc;padding-left:1ex;"><p><strong>On ${new Date(selectedEmail.date).toLocaleString()}, ${selectedEmail.from} wrote:</strong></p>${emailBody}</blockquote>`
    );
    setComposeAttachments([]);
    setSendError(null);
    setShowCompose(true);
  };

  const handleReplyAll = () => {
    if (!selectedEmail || !emailBody || !mailbox) return;
    const myAddress = mailbox.fullAddress.toLowerCase();
    // const recipients = [
    //   getRawEmail(selectedEmail.from),
    //   ...selectedEmail.to.map(getRawEmail).filter((addr) => addr !== myAddress),
    // ];
    // Reply All keeps the original Cc list. Addresses are matched
    // case-insensitively and deduped across To and Cc so nobody is added
    // twice, and this mailbox is never added back as a recipient.
    const seen = new Set<string>([myAddress]);
    const collectRecipients = (addresses: string[]) => {
      const collected: string[] = [];
      for (const addr of addresses) {
        const raw = getRawEmail(addr);
        const key = raw.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push(raw);
      }
      return collected;
    };
    const recipients = collectRecipients([selectedEmail.from, ...selectedEmail.to]);
    const ccRecipients = collectRecipients(selectedEmail.cc ?? []);
    setComposeMode("replyAll");
    setComposeTo(recipients);
    setComposeGroupIds([]);
    setComposeToInput("");
    // setComposeCc([]);
    setComposeCc(ccRecipients);
    setComposeCcInput("");
    setComposeBcc([]);
    setComposeBccInput("");
    // setShowCc(false);
    setShowCc(ccRecipients.length > 0);
    setShowBcc(false);
    setComposeSubject(
      selectedEmail.subject.startsWith("Re:")
        ? selectedEmail.subject
        : `Re: ${selectedEmail.subject}`
    );
    setComposeBody("");
    setComposeSignature(mailbox?.signature ?? "");
    setComposeQuote(
      `<blockquote style="margin:0 0 0 .8ex;border-left:2px solid #ccc;padding-left:1ex;"><p><strong>On ${new Date(selectedEmail.date).toLocaleString()}, ${selectedEmail.from} wrote:</strong></p>${emailBody}</blockquote>`
    );
    setComposeAttachments([]);
    setSendError(null);
    setShowCompose(true);
  };

  const handleForward = () => {
    if (!selectedEmail || !emailBody) return;
    setComposeMode("forward");
    setComposeTo([]);
    setComposeGroupIds([]);
    setComposeToInput("");
    setComposeCc([]);
    setComposeCcInput("");
    setComposeBcc([]);
    setComposeBccInput("");
    setShowCc(false);
    setShowBcc(false);
    setComposeSubject(
      selectedEmail.subject.startsWith("Fwd:")
        ? selectedEmail.subject
        : `Fwd: ${selectedEmail.subject}`
    );
    setComposeBody("");
    setComposeSignature(mailbox?.signature ?? "");
    setComposeQuote(
      `<p>---------- Forwarded message ----------</p><p>From: ${selectedEmail.from}<br>Date: ${new Date(selectedEmail.date).toLocaleString()}<br>Subject: ${selectedEmail.subject}<br>To: ${selectedEmail.to.join(", ")}</p><br>${emailBody}`
    );
    setComposeAttachments([]);
    setSendError(null);
    setShowCompose(true);
  };

  const handleMarkAsUnread = async () => {
    if (!selectedEmail) return;
    await markAsUnread({ emailId: selectedEmail._id });
  };

  const handleDownloadAttachment = async (index: number) => {
    if (!selectedEmail) return;
    setDownloadingAttachment(index);
    try {
      const result = await getAttachment({ s3Key: selectedEmail.s3Key, attachmentIndex: index });
      const bytes = Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: result.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent fail
    } finally {
      setDownloadingAttachment(null);
    }
  };

  if (isLoading) {
    return (
      <div className="mailbox-shell flex flex-col overflow-hidden">
        <div className="flex items-center border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3">
          <div className="h-6 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="flex flex-1">
          <div className="w-48 border-r border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3">
            <div className="mb-4 h-10 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
              ))}
            </div>
          </div>
          <div className="flex-1 p-4">
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!mailbox) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-gray-500">Mailbox not found</p>
      </div>
    );
  }

  return (
    <div className="mailbox-shell flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <h1 className="truncate text-base font-semibold text-gray-900 dark:text-white md:text-lg">{mailbox.fullAddress}</h1>
          {mailbox.displayName && (
            <span className="rounded-full bg-violet-100 dark:bg-violet-900/40 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
              {mailbox.displayName}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Email list */}
        <div className={`flex min-w-0 max-w-[100vw] flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 md:shrink-0 ${selectedEmailId || showCompose || expandedSequenceId ? "hidden md:flex md:w-80" : "flex-1"}`}>
          {/* List header */}
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700/50 px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium capitalize text-gray-500 dark:text-gray-400">{activeFolder}</span>
              {totalCount !== undefined && totalCount > 0 && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {currentPage * 50 + 1}-{Math.min((currentPage + 1) * 50, totalCount)} of {totalCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {activeFolder === "inbox" && unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead({ mailboxId: mbId })}
                  title="Mark all inbox emails as read"
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] transition-colors text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75l7.5 5.25 2.25-1.575M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0a2.25 2.25 0 00-2.25-2.25H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0l-4.5 3.15M13.5 15l2.25 2.25L20.25 12.75" />
                  </svg>
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={currentPage === 0}
                title="Previous page"
                className="rounded p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={paginatedResult?.isDone !== false}
                title="Next page"
                className="rounded p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
              <button
                onClick={() => setShowEmailIds((v) => !v)}
                title={showEmailIds ? "Show names" : "Show email addresses"}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] transition-colors ${showEmailIds ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-medium" : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"}`}
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 10-2.636 6.364M16.5 12V8.25" />
                </svg>
                {showEmailIds ? "Email IDs" : "Names"}
              </button>
            </div>
          </div>
          {/* Search bar */}
          <div className="border-b border-gray-100 dark:border-gray-700/50 px-3 py-2">
            <div className="relative">
              <svg className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={mailSearch}
                onChange={(e) => setMailSearch(e.target.value)}
                placeholder="Search emails..."
                className="w-full rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 py-1.5 pl-8 pr-8 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:border-violet-300 dark:focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-300 dark:focus:ring-violet-500"
              />
              {mailSearch && (
                <button
                  onClick={() => setMailSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
            {activeFolder === "follow-ups" ? (
              <div className="divide-y divide-gray-50 dark:divide-gray-700/30">
                {!mailboxSequences || mailboxSequences.length === 0 ? (
                  <div className="flex h-full items-center justify-center py-16">
                    <div className="text-center">
                      <svg className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                      </svg>
                      <p className="mt-3 text-sm font-medium text-gray-900 dark:text-white">No follow-ups yet</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Add follow-up steps when composing a campaign email</p>
                    </div>
                  </div>
                ) : (
                  mailboxSequences.map((seq) => (
                    <button
                      key={seq._id}
                      onClick={() => {
                        setExpandedSequenceId(seq._id);
                        setSelectedEnrollmentIds(new Set());
                        setSelectedEmailId(null);
                      }}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 ${expandedSequenceId === seq._id ? "bg-violet-50 dark:bg-violet-900/20" : ""}`}
                    >
                      <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        seq.status === "active" ? "bg-green-100 dark:bg-green-900/30" : seq.status === "paused" ? "bg-amber-100 dark:bg-amber-900/30" : "bg-gray-100 dark:bg-gray-700"
                      }`}>
                        <svg className={`h-4 w-4 ${seq.status === "active" ? "text-green-600 dark:text-green-400" : seq.status === "paused" ? "text-amber-600 dark:text-amber-400" : "text-gray-500"}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{seq.name}</p>
                        <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>{seq.stats.total} enrolled</span>
                          {seq.stats.active > 0 && <span className="text-green-600 dark:text-green-400">{seq.stats.active} active</span>}
                          {seq.stats.replied > 0 && <span className="text-blue-600 dark:text-blue-400">{seq.stats.replied} replied</span>}
                        </div>
                      </div>
                      <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        seq.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : seq.status === "paused" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                      }`}>
                        <span className={`h-1 w-1 rounded-full ${seq.status === "active" ? "bg-green-500" : seq.status === "paused" ? "bg-amber-500" : "bg-gray-400"}`} />
                        {seq.status}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : emails.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mb-4 text-5xl">📭</div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">No emails yet</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{activeFolder} is empty</p>
                </div>
              </div>
            ) : filteredEmailGroups.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">No results found</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">No emails match &ldquo;{mailSearch}&rdquo;</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-700/30">
                {filteredEmailGroups.map((group) => {
                  const email = group.representative;
                  // All recipients across the batch (for multi-recipient sends)
                  const allRecipients = group.allEmails.flatMap((e) => e.to);
                  const isSelected = group.allEmails.some((e) => e._id === selectedEmailId);
                  return (
                    <button
                      key={group.key}
                      onClick={() => handleSelectEmail(email._id)}
                      className={`w-full overflow-hidden px-4 py-3 text-left transition-colors ${isSelected
                        ? "bg-violet-50 dark:bg-violet-900/20"
                        : !email.read
                          ? "bg-blue-50/30 dark:bg-blue-900/10 hover:bg-gray-50 dark:hover:bg-gray-700"
                          : "hover:bg-gray-50 dark:hover:bg-gray-700"
                        }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`min-w-0 truncate text-sm ${!email.read ? "font-semibold text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"}`}>
                          {activeFolder === "sent" || activeFolder === "outbox"
                            ? allRecipients.length > 1
                              ? `${showEmailIds ? getRawEmail(allRecipients[0]) : getDisplayName(allRecipients[0], contactNameMap)} +${allRecipients.length - 1}`
                              : showEmailIds ? getRawEmail(allRecipients[0]) : getDisplayName(allRecipients[0], contactNameMap)
                            : showEmailIds ? getRawEmail(email.from) : getDisplayName(email.from, contactNameMap)}
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          {email.starred && (
                            <svg className="h-3.5 w-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" />
                            </svg>
                          )}
                          {(activeFolder === "sent" || activeFolder === "outbox") && (
                            group.isBatch ? (
                              <DeliveryStatusIcon
                                isBatch={true}
                                pendingCount={group.pendingCount}
                                deliveredCount={group.deliveredCount}
                                openedCount={group.openedCount}
                              />
                            ) : (
                              <DeliveryStatusIcon
                                deliveryStatus={email.deliveryStatus}
                                openedAt={email.openedAt}
                              />
                            )
                          )}
                          <span className="whitespace-nowrap text-xs text-gray-400 dark:text-gray-500">{timeAgo(email.date)}</span>
                        </div>
                      </div>
                      <p className={`mt-0.5 truncate text-sm ${!email.read ? "font-medium text-gray-800 dark:text-gray-200" : "text-gray-600 dark:text-gray-400"}`}>
                        {email.subject}
                        {group.isBatch && (
                          <span className="ml-1.5 inline-flex shrink-0 items-center rounded-full bg-violet-100 dark:bg-violet-900/40 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
                            Campaign
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-gray-500">
                        {email.snippet}
                      </p>
                      {activeFolder === "outbox" && email.scheduledAt && (
                        <p className="mt-0.5 truncate text-xs text-amber-600 dark:text-amber-400">
                          <svg className="mr-1 inline h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                          </svg>
                          Scheduled for {new Date(email.scheduledAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Email detail */}
        {!showCompose && selectedEmailId && selectedEmail && (() => {
          // Resolve batch context for the selected email
          const selectedGroup = emailGroups.find((g) => g.allEmails.some((e) => e._id === selectedEmailId));
          const batchEmails = selectedGroup?.allEmails ?? [selectedEmail];
          const isBatchDetail = (selectedGroup?.isBatch) ?? false;
          const batchAllRecipients = batchEmails.flatMap((e) => e.to);
          return (
            <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-white dark:bg-gray-800 p-4 md:p-8">
              <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 md:flex-1">
                  <h2 className="break-words text-lg font-semibold text-gray-900 dark:text-white md:text-xl">
                    {selectedEmail.subject}
                  </h2>
                  <div className="mt-2 flex items-center gap-3 overflow-hidden">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600">
                      {getDisplayName(selectedEmail.from, contactNameMap)[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1 md:flex-initial">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {getDisplayName(selectedEmail.from, contactNameMap)}
                        {showEmailIds && (
                          <span className="ml-1.5 font-normal text-gray-500 dark:text-gray-400">&lt;{getRawEmail(selectedEmail.from)}&gt;</span>
                        )}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        To:{" "}
                        {selectedEmail.to.map((addr) =>
                          showEmailIds
                            ? getRawEmail(addr)
                            : getDisplayName(addr, contactNameMap)
                        ).join(", ")}
                        {isBatchDetail && selectedEmail.to.length === 1 && (
                          <span className="ml-1 text-gray-400 dark:text-gray-500">
                            (and {batchEmails.length - 1} other{batchEmails.length - 1 !== 1 ? "s" : ""} in batch)
                          </span>
                        )}
                      </p>
                      {selectedEmail.cc && selectedEmail.cc.length > 0 && (
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                          Cc:{" "}
                          {selectedEmail.cc.map((addr) =>
                            showEmailIds
                              ? getRawEmail(addr)
                              : getDisplayName(addr, contactNameMap)
                          ).join(", ")}
                        </p>
                      )}
                      {selectedEmail.bcc && selectedEmail.bcc.length > 0 && (
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                          Bcc:{" "}
                          {selectedEmail.bcc.map((addr) =>
                            showEmailIds
                              ? getRawEmail(addr)
                              : getDisplayName(addr, contactNameMap)
                          ).join(", ")}
                        </p>
                      )}
                      {isBatchDetail && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="text-xs text-gray-400 dark:text-gray-500">Delivery:</span>
                          {selectedEmail._id === selectedGroup?.representative._id ? (
                            <DeliveryStatusIcon
                              isBatch={true}
                              pendingCount={selectedGroup!.pendingCount}
                              deliveredCount={selectedGroup!.deliveredCount}
                              openedCount={selectedGroup!.openedCount}
                            />
                          ) : (
                            <>
                              <DeliveryStatusIcon
                                deliveryStatus={selectedEmail.deliveryStatus}
                                openedAt={selectedEmail.openedAt}
                              />
                              {selectedEmail.openedAt ? (
                                <span className="text-[10px] text-gray-400 dark:text-gray-500">Opened {timeAgo(selectedEmail.openedAt)}</span>
                              ) : selectedEmail.deliveredAt ? (
                                <span className="text-[10px] text-gray-400 dark:text-gray-500">Delivered {timeAgo(selectedEmail.deliveredAt)}</span>
                              ) : null}
                            </>
                          )}
                        </div>
                      )}
                      {!isBatchDetail && selectedEmail.deliveryStatus !== undefined && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="text-xs text-gray-400 dark:text-gray-500">Delivery:</span>
                          <DeliveryStatusIcon
                            deliveryStatus={selectedEmail.deliveryStatus}
                            openedAt={selectedEmail.openedAt}
                          />
                          {selectedEmail.openedAt ? (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">Opened {timeAgo(selectedEmail.openedAt)}</span>
                          ) : selectedEmail.deliveredAt ? (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">Delivered {timeAgo(selectedEmail.deliveredAt)}</span>
                          ) : null}
                        </div>
                      )}
                      {selectedEmail.scheduledAt && selectedEmail.folder === "outbox" && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 px-2.5 py-1">
                            <svg className="h-3 w-3 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                            </svg>
                            <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                              Scheduled for {new Date(selectedEmail.scheduledAt).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                            </span>
                          </div>
                          <button
                            onClick={async () => {
                              await cancelScheduledEmailMutation({ emailId: selectedEmail._id });
                              setSelectedEmailId(null);
                            }}
                            className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Cancel send
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 self-start whitespace-nowrap text-xs text-gray-400 dark:text-gray-500 md:self-auto">{timeAgo(selectedEmail.date)}</span>
                  </div>
                </div>
                <div className="order-first flex w-full items-center justify-end gap-1 md:order-none md:w-auto md:shrink-0">
                  {emailBody && (
                    <>
                      <button
                        onClick={handleReply}
                        title="Reply"
                        className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                        </svg>
                        <span className="hidden sm:inline">Reply</span>
                      </button>
                      <button
                        onClick={handleReplyAll}
                        title="Reply All"
                        className="hidden items-center gap-1 rounded-md px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 sm:flex"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.25L9 3m0 0l6 5.25M9 3v13.5m6-10.5L21 9m0 0l-6 5.25M21 9v7.5" />
                        </svg>
                        Reply All
                      </button>
                      <button
                        onClick={handleForward}
                        title="Forward"
                        className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                        </svg>
                        <span className="hidden sm:inline">Forward</span>
                      </button>
                      <div className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />
                    </>
                  )}
                  <button
                    onClick={handleMarkAsUnread}
                    title="Mark as unread"
                    className="rounded-md p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-blue-500"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => toggleStar({ emailId: selectedEmail._id })}
                    className="rounded-md p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-yellow-500"
                  >
                    <svg className={`h-4 w-4 ${selectedEmail.starred ? "text-yellow-400" : ""}`} fill={selectedEmail.starred ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleMoveToTrash(selectedEmail._id)}
                    className="rounded-md p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-red-500"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                  <div className="mx-0.5 h-4 w-px bg-gray-200 dark:bg-gray-700" />
                  <button
                    onClick={() => setSelectedEmailId(null)}
                    className="rounded-md p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
                    title="Close"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              {isBatchDetail && (
                <div className="mb-5 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {/* Toggle header */}
                  <button
                    onClick={() => setShowRecipientBreakdown((v) => !v)}
                    className="flex w-full items-center justify-between bg-gray-50 dark:bg-gray-700/50 px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span>Recipients ({batchEmails.length})</span>
                    <svg className={`h-3.5 w-3.5 transition-transform ${showRecipientBreakdown ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  {showRecipientBreakdown && (() => {
                    const searchTerm = recipientSearch.toLowerCase().trim();
                    const filteredEmails = batchEmails.filter((e) => {
                      const matchesFilter =
                        recipientFilter === "all" ? true
                          : recipientFilter === "pending" ? e.deliveryStatus === "pending"
                            : recipientFilter === "delivered" ? e.deliveryStatus === "delivered" && !e.openedAt
                              : !!e.openedAt;
                      const matchesSearch = !searchTerm || getRawEmail(e.to[0]).toLowerCase().includes(searchTerm);
                      return matchesFilter && matchesSearch;
                    });
                    return (
                      <div>
                        {/* Search + Filter tabs */}
                        <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 md:gap-2">
                          {(["all", "pending", "delivered", "opened"] as const).map((f) => {
                            const count =
                              f === "all" ? batchEmails.length
                                : f === "pending" ? selectedGroup!.pendingCount
                                  : f === "delivered" ? selectedGroup!.deliveredCount
                                    : selectedGroup!.openedCount;
                            return (
                              <button
                                key={f}
                                onClick={() => setRecipientFilter(f)}
                                className={`rounded px-2 py-0.5 text-[10px] font-medium capitalize transition-colors ${recipientFilter === f
                                  ? "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
                                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                  }`}
                              >
                                {f} ({count})
                              </button>
                            );
                          })}
                          <div className="relative ml-auto">
                            <input
                              type="text"
                              value={recipientSearch}
                              onChange={(e) => setRecipientSearch(e.target.value)}
                              placeholder="Search recipients..."
                              className="w-28 rounded-md border border-gray-200 bg-white py-0.5 pl-6 pr-2 text-[10px] text-gray-700 outline-none placeholder-gray-400 focus:border-violet-400 focus:ring-1 focus:ring-violet-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:placeholder-gray-500 md:w-36"
                            />
                            <svg className="absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                            </svg>
                          </div>
                        </div>
                        {/* Recipient rows */}
                        <div className="max-h-48 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700/30 bg-white dark:bg-gray-800">
                          {filteredEmails.length === 0 ? (
                            <p className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500">{searchTerm ? "No matching recipients." : "No recipients in this category."}</p>
                          ) : (
                            filteredEmails.map((e) => (
                              <button
                                key={e._id}
                                onClick={() => handleSelectEmail(e._id)}
                                className={`flex w-full items-center justify-between px-4 py-1.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 ${e._id === selectedEmailId ? "bg-violet-50 dark:bg-violet-900/20" : ""}`}
                              >
                                <div className="flex flex-col truncate">
                                  <span className="truncate text-xs font-mono text-gray-700 dark:text-gray-300">
                                    {getRawEmail(e.to[0])}
                                  </span>
                                  {e.subject !== selectedGroup?.representative.subject && (
                                    <span className="truncate text-[10px] text-gray-400 dark:text-gray-500">{e.subject}</span>
                                  )}
                                </div>
                                <div className="ml-3 flex shrink-0 items-center gap-1.5">
                                  <DeliveryStatusIcon
                                    deliveryStatus={e.deliveryStatus}
                                    openedAt={e.openedAt}
                                  />
                                  {e.openedAt ? (
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500">{timeAgo(e.openedAt)}</span>
                                  ) : e.deliveredAt ? (
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500">{timeAgo(e.deliveredAt)}</span>
                                  ) : null}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              <div className="prose prose-sm max-w-none overflow-x-auto break-words text-gray-700 dark:text-gray-300 [&_*]:max-w-full">
                {loadingBody ? (
                  <div className="space-y-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                ) : emailBody ? (
                  // Render received email HTML in a sandboxed, white-background
                  // iframe so it stays readable in both light and dark themes
                  // instead of clashing with the app theme.
                  // <div dangerouslySetInnerHTML={{ __html: emailBody }} />
                  <EmailBodyFrame html={emailBody} />
                ) : (
                  <p>{selectedEmail.snippet}</p>
                )}
              </div>
              {emailAttachments.length > 0 && (
                <div className="mt-6 border-t border-gray-100 dark:border-gray-700/50 pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Attachments ({emailAttachments.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {emailAttachments.map((att, i) => (
                      <button
                        key={i}
                        onClick={() => handleDownloadAttachment(i)}
                        disabled={downloadingAttachment === i}
                        className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                      >
                        <svg className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                        </svg>
                        <span className="max-w-[160px] truncate">{att.filename}</span>
                        <span className="text-gray-400 dark:text-gray-500">
                          ({att.size < 1024 ? "< 1" : Math.round(att.size / 1024)}kb)
                        </span>
                        {downloadingAttachment === i && (
                          <span className="text-violet-600">Downloading...</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Sequence detail panel */}
        {!showCompose && !selectedEmailId && expandedSequenceId && (() => {
          const selectedSeq = mailboxSequences?.find((s) => s._id === expandedSequenceId);
          if (!selectedSeq) return null;
          return (
            <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain bg-white dark:bg-gray-800 p-4 md:p-8">
              <div className="mb-6 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setExpandedSequenceId(null); setSelectedEnrollmentIds(new Set()); }}
                      className="md:hidden rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                    <h2 className="break-words text-lg font-semibold text-gray-900 dark:text-white md:text-xl">{selectedSeq.name}</h2>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                      selectedSeq.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : selectedSeq.status === "paused" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${selectedSeq.status === "active" ? "bg-green-500" : selectedSeq.status === "paused" ? "bg-amber-500" : "bg-gray-400"}`} />
                      {selectedSeq.status}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{selectedSeq.steps.length} steps</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">via {selectedSeq.mailboxAddress}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedSeq.status === "active" && (
                    <button
                      onClick={() => pauseSequence({ sequenceId: selectedSeq._id })}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                      </svg>
                      Pause
                    </button>
                  )}
                  {selectedSeq.status === "paused" && (
                    <button
                      onClick={() => resumeSequence({ sequenceId: selectedSeq._id })}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 border border-green-200 dark:border-green-800"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                      </svg>
                      Resume
                    </button>
                  )}
                  {selectedSeq.status !== "completed" && (
                    <button
                      onClick={() => { cancelSequence({ sequenceId: selectedSeq._id }); setExpandedSequenceId(null); }}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel Sequence
                    </button>
                  )}
                  <div className="mx-0.5 h-4 w-px bg-gray-200 dark:bg-gray-700" />
                  <button
                    onClick={() => { setExpandedSequenceId(null); setSelectedEnrollmentIds(new Set()); }}
                    className="rounded-md p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
                    title="Close"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Stats summary */}
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{selectedSeq.stats.total}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Total</p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400">{selectedSeq.stats.active}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Active</p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                  <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">{selectedSeq.stats.replied}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Replied</p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                  <p className="text-lg font-semibold text-gray-600 dark:text-gray-300">{selectedSeq.stats.completed}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Completed</p>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
                  <p className="text-lg font-semibold text-red-600 dark:text-red-400">{selectedSeq.stats.bounced}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">Bounced</p>
                </div>
              </div>

              {/* Steps overview */}
              <div className="mb-6">
                <h3 className="mb-3 text-sm font-medium text-gray-900 dark:text-white">Sequence Steps</h3>
                <div className="space-y-2">
                  {selectedSeq.steps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-3 rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/30 text-[10px] font-bold text-violet-600 dark:text-violet-400">{idx + 1}</span>
                      {step.type === "send_email" ? (
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-900 dark:text-white">Send Email</p>
                          <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{step.subject}</p>
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-900 dark:text-white">Wait</p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">{Math.round(step.delayMs / 86400000)} day{Math.round(step.delayMs / 86400000) !== 1 ? "s" : ""}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Enrollments */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Enrollments{" "}
                    {enrollmentStatus === "LoadingFirstPage"
                      ? ""
                      : `(${sequenceEnrollments.length}${enrollmentStatus === "Exhausted" ? "" : "+"})`}
                  </h3>
                  {selectedEnrollmentIds.size > 0 && (
                    <button
                      onClick={async () => {
                        for (const id of selectedEnrollmentIds) {
                          await cancelEnrollment({ enrollmentId: id as Id<"sequenceEnrollments"> });
                        }
                        setSelectedEnrollmentIds(new Set());
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel Selected ({selectedEnrollmentIds.size})
                    </button>
                  )}
                </div>
                {enrollmentStatus === "LoadingFirstPage" ? (
                  <div className="py-8 text-center text-sm text-gray-400">Loading enrollments...</div>
                ) : sequenceEnrollments.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">No contacts enrolled yet</div>
                ) : (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                      <input
                        type="checkbox"
                        checked={selectedEnrollmentIds.size === loadedActiveEnrollments.length && loadedActiveEnrollments.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEnrollmentIds(new Set(loadedActiveEnrollments.map(en => en._id)));
                          } else {
                            setSelectedEnrollmentIds(new Set());
                          }
                        }}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Select all active in loaded rows ({loadedActiveEnrollments.length})
                      </span>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                      {sequenceEnrollments.map((enrollment) => (
                        <div key={enrollment._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          {enrollment.status === "active" ? (
                            <input
                              type="checkbox"
                              checked={selectedEnrollmentIds.has(enrollment._id)}
                              onChange={(e) => {
                                const next = new Set(selectedEnrollmentIds);
                                if (e.target.checked) next.add(enrollment._id);
                                else next.delete(enrollment._id);
                                setSelectedEnrollmentIds(next);
                              }}
                              className="h-3.5 w-3.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                            />
                          ) : (
                            <div className="w-3.5" />
                          )}
                          <span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-300">{enrollment.contactEmail}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">step {enrollment.currentStep}/{selectedSeq.steps.length}</span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            enrollment.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : enrollment.status === "replied" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : enrollment.status === "completed" ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                            : enrollment.status === "bounced" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          }`}>
                            {enrollment.status}
                          </span>
                          {enrollment.status === "active" && (
                            <button
                              onClick={() => cancelEnrollment({ enrollmentId: enrollment._id })}
                              title="Cancel this enrollment"
                              className="rounded p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                      <LoadMoreSentinel
                        onLoadMore={onLoadMoreEnrollments}
                        status={enrollmentStatus}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* No email selected */}
        {!showCompose && !selectedEmailId && !expandedSequenceId && (
          <div className="hidden flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900 md:flex">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Select an email to read</p>
            </div>
          </div>
        )}

        {/* Compose panel - inline in the right pane */}
        {showCompose && (
          <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain bg-white dark:bg-gray-800 p-4 md:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white md:text-xl">
                {{ compose: "New Message", reply: "Reply", replyAll: "Reply All", forward: "Forward" }[composeMode]}
              </h2>
              <button
                onClick={() => { setShowCompose(false); setSendError(null); setComposeTo([]); setComposeGroupIds([]); setComposeToInput(""); setComposeCc([]); setComposeCcInput(""); setComposeBcc([]); setComposeBccInput(""); setShowCc(false); setShowBcc(false); setComposeSignature(""); setComposeQuote(""); setComposeAttachments([]); setComposeContentType("plain"); setShowPreview(false); setScheduledSendAt(null); setShowSchedulePicker(false); }}
                className="rounded-md p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
                title="Discard"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-700/50 pb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">From:</span>
                <span className="text-sm text-gray-900 dark:text-white">{mailbox.fullAddress}</span>
              </div>
              <div className="border-b border-gray-100 dark:border-gray-700/50 pb-2">
                {hasMergeData ? (
                  <div className="flex min-h-[2rem] flex-wrap items-center gap-1.5">
                    <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">To:</span>
                    <span className="rounded-full bg-violet-100 dark:bg-violet-900/40 px-3 py-1 text-xs font-medium text-violet-800 dark:text-violet-200">
                      {mergeRecipients.length} recipient{mergeRecipients.length !== 1 ? "s" : ""} (mail merge)
                    </span>
                    <span className="text-xs text-gray-400">
                      Fields: {mergeColumns.filter((c) => c !== mergeEmailColumn).join(", ")}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setMergeRecipients([]); setMergeColumns([]); setMergeEmailColumn(""); setMergePreviewIndex(0); }}
                      className="ml-auto text-xs text-gray-400 hover:text-red-500"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <div className="flex min-h-[2rem] flex-wrap items-center gap-1.5">
                    <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">To:</span>
                    {composeGroupIds.map((gId) => {
                      const group = senderGroups?.find((g) => g._id === gId);
                      if (!group) return null;
                      return (
                        <span key={gId} className="flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/40 py-0.5 pl-2 pr-1 text-xs font-medium text-blue-800 dark:text-blue-200">
                          <button
                            type="button"
                            onClick={() => {
                              setComposeGroupIds((prev) => prev.filter((id) => id !== gId));
                              setComposeTo((prev) => [...new Set([...prev, ...group.emails])]);
                            }}
                            className="flex items-center gap-1 cursor-pointer hover:text-blue-600 dark:hover:text-blue-100"
                            title="Expand to individual emails"
                          >
                            <Users className="h-3 w-3" />
                            {group.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => setComposeGroupIds((prev) => prev.filter((id) => id !== gId))}
                            className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-blue-500 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800 hover:text-blue-700"
                            title="Remove group"
                          >
                            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      );
                    })}
                    {composeTo.map((email, i) => {
                      const v = verificationResults[email.toLowerCase()];
                      const chipBg = v === undefined
                        ? "bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-200"
                        : v.isValid
                          ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200"
                          : "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200";
                      return (
                      <span key={i} className={`flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs font-medium ${chipBg}`} title={v?.reason ?? (v?.isValid ? "Verified" : undefined)}>
                        {v !== undefined && (
                          v.isValid ? (
                            <svg className="h-3 w-3 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                          ) : (
                            <svg className="h-3 w-3 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                          )
                        )}
                        {email}
                        <button
                          type="button"
                          onClick={() => { setComposeTo((prev) => prev.filter((_, j) => j !== i)); setVerificationResults((prev) => { const next = { ...prev }; delete next[email.toLowerCase()]; return next; }); }}
                          className={`flex h-3.5 w-3.5 items-center justify-center rounded-full ${v?.isValid === false ? "text-red-500 hover:bg-red-200 dark:hover:bg-red-800" : "text-violet-500 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-800"} hover:text-violet-700`}
                          title="Remove"
                        >
                          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                      );
                    })}
                    {isVerifying && (
                      <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                        <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        Verifying...
                      </span>
                    )}
                    <input
                      type="text"
                      value={composeToInput}
                      onChange={(e) => setComposeToInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
                          e.preventDefault();
                          const val = composeToInput.trim().replace(/,+$/, "");
                          if (val && isValidEmail(val)) { setComposeTo((prev) => [...prev, val]); setComposeToInput(""); }
                        } else if (e.key === "Backspace" && !composeToInput && composeTo.length > 0) {
                          setComposeTo((prev) => prev.slice(0, -1));
                        }
                      }}
                      onBlur={() => {
                        const val = composeToInput.trim().replace(/,+$/, "");
                        if (val && isValidEmail(val)) { setComposeTo((prev) => [...prev, val]); setComposeToInput(""); }
                      }}
                      className="min-w-[140px] flex-1 text-sm text-gray-900 dark:text-white outline-none placeholder-gray-400 dark:placeholder-gray-500 bg-transparent"
                      placeholder={composeTo.length === 0 && composeGroupIds.length === 0 ? "recipient@example.com" : "Add recipient..."}
                    />
                    {/* Groups picker */}
                    {senderGroups && senderGroups.length > 0 && (
                      <div ref={groupPickerRef} className="relative shrink-0 ml-auto">
                        <button
                          type="button"
                          onClick={() => setShowGroupPicker((v) => !v)}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-violet-600 dark:hover:text-violet-400"
                          title="Add from group"
                        >
                          <Users className="h-3.5 w-3.5" />
                          Groups
                        </button>
                        {showGroupPicker && (
                          <div className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                            {senderGroups.map((group) => (
                              <button
                                key={group._id}
                                type="button"
                                onClick={() => addGroupToRecipients(group)}
                                className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                              >
                                <span className="flex items-center gap-2 truncate">
                                  <Users className="h-3.5 w-3.5 shrink-0" />
                                  {group.name}
                                </span>
                                <span className="ml-2 shrink-0 text-xs text-gray-400">{group.emails.length} emails</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Import recipients button */}
                    <div ref={importMenuRef} className="relative ml-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => { setShowImportMenu((v) => !v); setShowGSheetsInput(false); setImportError(null); }}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-violet-600 dark:hover:text-violet-400"
                        title="Import recipients"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                        Import
                      </button>
                      {showImportMenu && (
                        <div className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                          {/* CSV upload option */}
                          <button
                            type="button"
                            onClick={() => csvImportRef.current?.click()}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <svg className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            <div>
                              <p className="font-medium">From CSV file</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">Upload a .csv file</p>
                            </div>
                          </button>
                          {/* Google Sheets option */}
                          <button
                            type="button"
                            onClick={() => setShowGSheetsInput((v) => !v)}
                            className="flex w-full items-center gap-3 border-t border-gray-100 dark:border-gray-700/50 px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            <svg className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                            </svg>
                            <div>
                              <p className="font-medium">From Google Sheets</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">Paste a sheet URL</p>
                            </div>
                          </button>
                          {showGSheetsInput && (
                            <div className="border-t border-gray-100 dark:border-gray-700/50 px-4 py-3">
                              <p className="mb-1.5 text-xs text-gray-500 dark:text-gray-400">Paste a public Google Sheets URL:</p>
                              <input
                                type="url"
                                value={gSheetsUrl}
                                onChange={(e) => setGSheetsUrl(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") handleGSheetsImport(); }}
                                className="w-full rounded-md border border-gray-200 dark:border-gray-600 dark:bg-gray-700 px-2.5 py-1.5 text-xs text-gray-800 dark:text-white outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100"
                                placeholder="https://docs.google.com/spreadsheets/..."
                              />
                              <button
                                type="button"
                                onClick={handleGSheetsImport}
                                disabled={isImporting || !gSheetsUrl.trim()}
                                className="mt-2 w-full rounded-md bg-violet-600 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
                              >
                                {isImporting ? "Importing..." : "Import"}
                              </button>
                            </div>
                          )}
                          {importError && (
                            <p className="border-t border-gray-100 dark:border-gray-700/50 px-4 py-2 text-xs text-red-600">{importError}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* CC field */}
              {showCc && (
                <div className="border-b border-gray-100 dark:border-gray-700/50 pb-2">
                  <div className="flex min-h-[2rem] flex-wrap items-center gap-1.5">
                    <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">Cc:</span>
                    {composeCc.map((email, i) => (
                      <span key={i} className="flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-900/40 py-0.5 pl-2.5 pr-1 text-xs font-medium text-violet-800 dark:text-violet-200">
                        {email}
                        <button
                          type="button"
                          onClick={() => setComposeCc((prev) => prev.filter((_, j) => j !== i))}
                          className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-violet-500 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-800 hover:text-violet-700"
                          title="Remove"
                        >
                          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={composeCcInput}
                      onChange={(e) => setComposeCcInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
                          e.preventDefault();
                          const val = composeCcInput.trim().replace(/,+$/, "");
                          if (val && isValidEmail(val)) { setComposeCc((prev) => [...prev, val]); setComposeCcInput(""); }
                        } else if (e.key === "Backspace" && !composeCcInput && composeCc.length > 0) {
                          setComposeCc((prev) => prev.slice(0, -1));
                        }
                      }}
                      onBlur={() => {
                        const val = composeCcInput.trim().replace(/,+$/, "");
                        if (val && isValidEmail(val)) { setComposeCc((prev) => [...prev, val]); setComposeCcInput(""); }
                      }}
                      className="min-w-[140px] flex-1 text-sm text-gray-900 dark:text-white outline-none placeholder-gray-400 dark:placeholder-gray-500 bg-transparent"
                      placeholder={composeCc.length === 0 ? "cc@example.com" : "Add cc..."}
                    />
                    <button
                      type="button"
                      onClick={() => { setShowCc(false); setComposeCc([]); setComposeCcInput(""); }}
                      className="ml-auto shrink-0 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                      title="Remove Cc"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
              {/* BCC field */}
              {showBcc && (
                <div className="border-b border-gray-100 dark:border-gray-700/50 pb-2">
                  <div className="flex min-h-[2rem] flex-wrap items-center gap-1.5">
                    <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">Bcc:</span>
                    {composeBcc.map((email, i) => (
                      <span key={i} className="flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-900/40 py-0.5 pl-2.5 pr-1 text-xs font-medium text-violet-800 dark:text-violet-200">
                        {email}
                        <button
                          type="button"
                          onClick={() => setComposeBcc((prev) => prev.filter((_, j) => j !== i))}
                          className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-violet-500 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-800 hover:text-violet-700"
                          title="Remove"
                        >
                          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={composeBccInput}
                      onChange={(e) => setComposeBccInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
                          e.preventDefault();
                          const val = composeBccInput.trim().replace(/,+$/, "");
                          if (val && isValidEmail(val)) { setComposeBcc((prev) => [...prev, val]); setComposeBccInput(""); }
                        } else if (e.key === "Backspace" && !composeBccInput && composeBcc.length > 0) {
                          setComposeBcc((prev) => prev.slice(0, -1));
                        }
                      }}
                      onBlur={() => {
                        const val = composeBccInput.trim().replace(/,+$/, "");
                        if (val && isValidEmail(val)) { setComposeBcc((prev) => [...prev, val]); setComposeBccInput(""); }
                      }}
                      className="min-w-[140px] flex-1 text-sm text-gray-900 dark:text-white outline-none placeholder-gray-400 dark:placeholder-gray-500 bg-transparent"
                      placeholder={composeBcc.length === 0 ? "bcc@example.com" : "Add bcc..."}
                    />
                    <button
                      type="button"
                      onClick={() => { setShowBcc(false); setComposeBcc([]); setComposeBccInput(""); }}
                      className="ml-auto shrink-0 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                      title="Remove Bcc"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
              {hasMergeData && mergeColumns.length > 0 && (
                <MergeFieldToolbar
                  columns={mergeColumns}
                  emailColumn={mergeEmailColumn}
                  onInsertField={handleInsertMergeField}
                />
              )}
              <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-700/50 pb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Subject:</span>
                <input
                  ref={subjectInputRef}
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  onFocus={() => { lastMergeTarget.current = "subject"; }}
                  className="flex-1 text-sm text-gray-900 dark:text-white outline-none placeholder-gray-400 dark:placeholder-gray-500 bg-transparent"
                  placeholder={hasMergeData ? "Hello {FirstName}, ..." : "Email subject"}
                />
                {/* Cc/Bcc toggle buttons */}
                <div className="flex shrink-0 items-center gap-1">
                  {!showCc && (
                    <button
                      type="button"
                      onClick={() => setShowCc(true)}
                      className="rounded px-1.5 py-0.5 text-xs text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-violet-600 dark:hover:text-violet-400"
                    >
                      Cc
                    </button>
                  )}
                  {!showBcc && (
                    <button
                      type="button"
                      onClick={() => setShowBcc(true)}
                      className="rounded px-1.5 py-0.5 text-xs text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-violet-600 dark:hover:text-violet-400"
                    >
                      Bcc
                    </button>
                  )}
                </div>
              </div>
              {/* Content type selector */}
              <div className="flex items-center gap-3 border-b border-gray-100 dark:border-gray-700/50 pb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Format:</span>
                <div className="flex overflow-hidden rounded-md border border-gray-200 dark:border-gray-700 text-xs font-medium">
                  {(["plain", "markdown", "html"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setComposeContentType(type);
                        setShowPreview(type !== "plain");
                      }}
                      className={`px-3 py-1.5 transition-colors ${composeContentType === type
                        ? "bg-violet-600 text-white"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                        }`}
                    >
                      {type === "plain" ? "Plain Text" : type === "markdown" ? "Markdown" : "HTML"}
                    </button>
                  ))}
                </div>
                {composeContentType !== "plain" && (
                  <button
                    type="button"
                    onClick={() => setShowPreview((v) => !v)}
                    className="ml-auto text-xs text-violet-500 hover:text-violet-700 dark:hover:text-violet-300"
                  >
                    {showPreview ? "Hide preview" : "Show preview"}
                  </button>
                )}
              </div>
              <textarea
                ref={bodyTextareaRef}
                rows={showPreview || hasMergeData ? 8 : composeQuote ? 8 : 14}
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                onFocus={() => { lastMergeTarget.current = "body"; }}
                className={`w-full resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-3 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 placeholder-gray-400 dark:placeholder-gray-500 ${composeContentType !== "plain" ? "font-mono" : ""}`}
                placeholder={
                  hasMergeData
                    ? "Hi {FirstName}, use {FieldName} for personalization..."
                    : composeContentType === "markdown"
                      ? "Write **Markdown** here..."
                      : composeContentType === "html"
                        ? "<p>Write HTML here...</p>"
                        : "Write your message..."
                }
              />
              {/* Merge preview */}
              {hasMergeData && (composeSubject || composeBody) && (
                <MergePreview
                  recipients={mergeRecipients}
                  previewIndex={mergePreviewIndex}
                  onChangeIndex={setMergePreviewIndex}
                  subject={composeSubject}
                  body={composeBody}
                />
              )}
              {/* Markdown/HTML preview panel */}
              {showPreview && composeContentType !== "plain" && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-3 py-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      Preview
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      {composeContentType === "markdown" ? "Rendered from Markdown" : "Raw HTML"}
                    </span>
                  </div>
                  <div
                    className="max-h-80 overflow-y-auto p-3 text-sm text-gray-700 dark:text-gray-300 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-1 [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-violet-600 [&_a]:underline [&_code]:font-mono [&_code]:text-xs [&_code]:bg-gray-200 [&_code]:dark:bg-gray-700 [&_code]:rounded [&_code]:px-1 [&_pre]:bg-gray-200 [&_pre]:dark:bg-gray-700 [&_pre]:rounded [&_pre]:p-2 [&_pre]:overflow-x-auto [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_p]:mb-2"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                </div>
              )}
              {composeQuote && (
                <div
                  className="mt-2 max-h-40 overflow-y-auto border-t border-gray-100 dark:border-gray-700/50 pt-2 text-sm text-gray-400 dark:text-gray-500"
                  dangerouslySetInnerHTML={{ __html: composeQuote }}
                />
              )}
              {/* Signature */}
              {composeSignature ? (
                <div className="border-t border-gray-100 dark:border-gray-700/50 pt-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Signature</span>
                    <button
                      type="button"
                      onClick={() => setComposeSignature("")}
                      className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    <p className="mb-0.5">--</p>
                    <div
                      className="[&_strong]:font-semibold [&_em]:italic [&_a]:text-violet-500 [&_a]:underline [&_hr]:my-1 [&_hr]:border-gray-200 dark:[&_hr]:border-gray-600 [&_p]:mb-0.5"
                      dangerouslySetInnerHTML={{ __html: marked.parse(composeSignature) as string }}
                    />
                  </div>
                </div>
              ) : mailbox?.signature ? (
                <div className="border-t border-gray-100 dark:border-gray-700/50 pt-2">
                  <button
                    type="button"
                    onClick={() => setComposeSignature(mailbox.signature ?? "")}
                    className="text-[10px] text-gray-400 dark:text-gray-500 hover:text-violet-500 transition-colors"
                  >
                    + Add signature
                  </button>
                </div>
              ) : null}
              {/* Selected attachments */}
              {composeAttachments.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-700/50 pt-2">
                  <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {composeAttachments.length} attachment{composeAttachments.length > 1 ? "s" : ""}
                    {isAnyUploading && <span className="ml-1 text-amber-500">(processing...)</span>}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {composeAttachments.map((att) => (
                      <div key={att.id} className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700">
                        <div className="flex items-center gap-2 px-2.5 py-1.5">
                          {att.status === "uploading" ? (
                            <svg className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-500" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="h-3.5 w-3.5 shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                          <span className="max-w-[180px] truncate text-xs font-medium text-gray-700 dark:text-gray-300">{att.filename}</span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">({att.size < 1024 ? "< 1" : Math.round(att.size / 1024)}kb)</span>
                          <span className={`ml-auto text-[10px] font-semibold uppercase tracking-wide ${att.status === "uploading" ? "text-amber-500" : "text-green-500"}`}>
                            {att.status === "uploading" ? "Uploading" : "Uploaded"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setComposeAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                            className="text-gray-400 hover:text-red-500"
                            title="Remove attachment"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        {att.status === "uploading" && (
                          <div className="h-1 w-full bg-gray-100 dark:bg-gray-600">
                            <div className="h-full animate-pulse rounded-full bg-amber-400" style={{ width: "60%" }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Follow-up steps builder */}
            {sendMode === "campaign" && (
            <div className="mt-3 border-t border-gray-100 dark:border-gray-700/50 pt-3">
                <button
                  type="button"
                  onClick={() => setShowFollowUps(!showFollowUps)}
                  className="flex w-full items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                >
                  <svg className={`h-3 w-3 transition-transform ${showFollowUps ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                  </svg>
                  Add Follow-ups {followUpSteps.length > 0 && `(${followUpSteps.length})`}
                </button>
                {showFollowUps && (
                  <div className="mt-3 space-y-3">
                    {followUpSteps.map((step, index) => (
                      <div key={index} className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/50 text-[10px] font-bold text-violet-700 dark:text-violet-300">
                              {index + 1}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">If no reply after</span>
                            <input
                              type="number"
                              min={1}
                              max={30}
                              value={step.delayDays}
                              onChange={(e) => {
                                const newSteps = [...followUpSteps];
                                newSteps[index] = { ...newSteps[index], delayDays: Math.max(1, parseInt(e.target.value) || 1) };
                                setFollowUpSteps(newSteps);
                              }}
                              className="w-14 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-900 dark:text-white text-center focus:border-violet-500 focus:outline-none"
                            />
                            <span className="text-xs text-gray-500 dark:text-gray-400">day{step.delayDays !== 1 ? "s" : ""}, send:</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setFollowUpSteps(followUpSteps.filter((_, i) => i !== index))}
                            className="rounded p-1 text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={step.subject}
                          onChange={(e) => {
                            const newSteps = [...followUpSteps];
                            newSteps[index] = { ...newSteps[index], subject: e.target.value };
                            setFollowUpSteps(newSteps);
                          }}
                          placeholder="Follow-up subject line"
                          className="mb-2 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-violet-500 focus:outline-none"
                        />
                        <textarea
                          value={step.body}
                          onChange={(e) => {
                            const newSteps = [...followUpSteps];
                            newSteps[index] = { ...newSteps[index], body: e.target.value };
                            setFollowUpSteps(newSteps);
                          }}
                          placeholder="Follow-up email body"
                          rows={3}
                          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-violet-500 focus:outline-none resize-none"
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setFollowUpSteps([...followUpSteps, { delayDays: 2, subject: "", body: "" }])}
                      className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors w-full justify-center"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Add follow-up step
                    </button>
                  </div>
                )}
              </div>
            )}
            {(() => {
              const invalidRecipients = composeTo.filter((e) => verificationResults[e.toLowerCase()]?.isValid === false);
              if (invalidRecipients.length > 0) return (
                <div className="mt-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  <span className="font-medium">{invalidRecipients.length} invalid recipient{invalidRecipients.length > 1 ? "s" : ""} detected.</span>{" "}
                  Remove {invalidRecipients.length > 1 ? "them" : "it"} to avoid bounces.
                  {/* One line per address. The reasons used to be joined on their own,
                      so two bad recipients read "Invalid; Invalid" and you could not
                      tell which address either belonged to. */}
                  <ul className="mt-1 space-y-0.5">
                    {invalidRecipients.map((e) => {
                      const v = verificationResults[e.toLowerCase()];
                      const why = (v?.reason ?? v?.result ?? "invalid").replace(/_/g, " ");
                      return (
                        <li key={e} className="break-all">
                          <span className="font-medium">{e}</span>: {why}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
              return null;
            })()}
            {sendError && (
              <div className="mt-3 rounded-md bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                {sendError}
              </div>
            )}
            {/* File input - not display:none so onChange fires reliably in all browsers */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="absolute w-0 h-0 overflow-hidden opacity-0"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length > 0) {
                  processFiles(files);
                }
              }}
            />
            {/* Hidden CSV input for recipient import */}
            <input
              ref={csvImportRef}
              type="file"
              accept=".csv,text/csv"
              className="absolute w-0 h-0 overflow-hidden opacity-0"
              onChange={handleCSVImport}
            />
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Split send button */}
                <div ref={sendDropdownRef} className="relative">
                  <div className="inline-flex overflow-hidden rounded-lg">
                    <button
                      onClick={
                        scheduledSendAt
                          ? sendMode === "campaign"
                            ? () => handleScheduleCampaign(scheduledSendAt)
                            : () => handleScheduleSend(scheduledSendAt)
                          : sendMode === "campaign"
                            ? handleSendCampaign
                            : handleSend
                      }
                      disabled={(hasMergeData ? mergeRecipients.length === 0 : (composeTo.length === 0 && composeGroupIds.length === 0 && !composeToInput.trim())) || !composeSubject.trim() || isSending || isAnyUploading}
                      className="bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
                    >
                      {isAnyUploading
                        ? "Processing attachments..."
                        : isSending
                          ? scheduledSendAt
                            ? sendMode === "campaign" ? "Scheduling campaign..." : "Scheduling..."
                            : sendMode === "campaign"
                              ? "Sending campaign..."
                              : composeAttachments.length > 0
                                ? `Sending with ${composeAttachments.length} attachment${composeAttachments.length > 1 ? "s" : ""}...`
                                : "Sending..."
                          : scheduledSendAt
                            ? sendMode === "campaign" ? "Schedule Campaign" : "Schedule"
                            : sendMode === "campaign"
                              ? "Send as Campaign"
                              : "Send"}
                    </button>
                    <div className="w-px self-stretch bg-violet-500" />
                    <button
                      type="button"
                      onClick={() => setShowSendDropdown((v) => !v)}
                      disabled={isSending || isAnyUploading}
                      className="bg-violet-600 px-2.5 text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
                      title="Choose send mode"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                  </div>
                  {showSendDropdown && (
                    <div className="absolute bottom-full left-0 z-20 mb-1 w-60 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                      <button
                        onClick={() => { if (!usesMergeFields) { setSendMode("send"); setShowSendDropdown(false); setFollowUpSteps([]); setShowFollowUps(false); } }}
                        disabled={usesMergeFields}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors ${usesMergeFields ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50 dark:hover:bg-gray-700"} ${sendMode === "send" ? "bg-violet-50 dark:bg-violet-900/20" : ""}`}
                      >
                        <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${sendMode === "send" ? "border-violet-600 bg-violet-600" : "border-gray-300 dark:border-gray-600"}`} />
                        <div>
                          <p className={`font-medium ${sendMode === "send" ? "text-violet-700 dark:text-violet-300" : "text-gray-800 dark:text-gray-200"}`}>Send</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{usesMergeFields ? "Disabled: merge fields require Campaign" : "One email to all recipients"}</p>
                        </div>
                      </button>
                      <button
                        onClick={() => { setSendMode("campaign"); setShowSendDropdown(false); }}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${sendMode === "campaign" ? "bg-violet-50 dark:bg-violet-900/20" : ""}`}
                      >
                        <div className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${sendMode === "campaign" ? "border-violet-600 bg-violet-600" : "border-gray-300 dark:border-gray-600"}`} />
                        <div>
                          <p className={`font-medium ${sendMode === "campaign" ? "text-violet-700 dark:text-violet-300" : "text-gray-800 dark:text-gray-200"}`}>Send as Campaign</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">Individual email per recipient</p>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
                {/* Schedule tab - shows "Now" or the selected scheduled time */}
                <div ref={schedulePickerRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSchedulePicker((v) => !v)}
                    disabled={isSending || isAnyUploading}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${scheduledSendAt
                      ? "border-violet-400 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 hover:border-violet-500"
                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-violet-300 hover:text-violet-600 dark:hover:text-violet-400"
                      }`}
                    title="Schedule send"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                    </svg>
                    {scheduledSendAt
                      ? new Date(scheduledSendAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                      : "Now"}
                    <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  {showSchedulePicker && (() => {
                    const now = new Date();
                    const tomorrow = new Date(now);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const tomorrowMorning = new Date(tomorrow); tomorrowMorning.setHours(8, 0, 0, 0);
                    const tomorrowAfternoon = new Date(tomorrow); tomorrowAfternoon.setHours(13, 0, 0, 0);
                    const nextMonday = new Date(now);
                    nextMonday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
                    nextMonday.setHours(8, 0, 0, 0);
                    const fmtPreset = (d: Date) =>
                      d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
                    const customTs = scheduleCustomDate && scheduleCustomTime
                      ? new Date(`${scheduleCustomDate}T${scheduleCustomTime}`).getTime()
                      : NaN;
                    const customHasValue = scheduleCustomDate !== "" && !isNaN(customTs);
                    const customIsInPast = customHasValue && customTs <= Date.now();
                    return (
                      <div className="absolute bottom-full left-0 z-20 mb-1 w-72 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                        <div className="border-b border-gray-100 dark:border-gray-700/50 px-3 py-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Schedule send</p>
                        </div>
                        {/* "Send now" option to reset */}
                        <button
                          onClick={() => { setScheduledSendAt(null); setShowSchedulePicker(false); }}
                          className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${!scheduledSendAt ? "bg-violet-50 dark:bg-violet-900/20" : ""}`}
                        >
                          <span className={`font-medium ${!scheduledSendAt ? "text-violet-700 dark:text-violet-300" : "text-gray-800 dark:text-gray-200"}`}>Send now</span>
                          {!scheduledSendAt && <svg className="h-3.5 w-3.5 text-violet-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                        </button>
                        <div className="border-t border-gray-100 dark:border-gray-700/50" />
                        {[
                          { label: "Tomorrow morning", ts: tomorrowMorning },
                          { label: "Tomorrow afternoon", ts: tomorrowAfternoon },
                          { label: "Next Monday morning", ts: nextMonday },
                        ].map(({ label, ts }) => (
                          <button
                            key={label}
                            onClick={() => { setScheduledSendAt(ts.getTime()); setShowSchedulePicker(false); }}
                            className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 ${scheduledSendAt === ts.getTime() ? "bg-violet-50 dark:bg-violet-900/20" : ""}`}
                          >
                            <span className={`font-medium ${scheduledSendAt === ts.getTime() ? "text-violet-700 dark:text-violet-300" : "text-gray-800 dark:text-gray-200"}`}>{label}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">{fmtPreset(ts)}</span>
                          </button>
                        ))}
                        <div className="border-t border-gray-100 dark:border-gray-700/50 px-4 py-3 bg-gray-50/60 dark:bg-gray-900/40">
                          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Custom date &amp; time</p>
                          <div className="space-y-2">
                            {/* Date field */}
                            <div className="group relative flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 ring-0 transition-all focus-within:border-violet-400 dark:focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-400/20">
                              <svg className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500 group-focus-within:text-violet-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                              </svg>
                              <input
                                type="date"
                                value={scheduleCustomDate}
                                min={new Date().toISOString().split("T")[0]}
                                onChange={(e) => setScheduleCustomDate(e.target.value)}
                                className="w-full bg-transparent text-xs text-gray-800 dark:text-gray-100 placeholder-gray-400 outline-none [color-scheme:light] dark:[color-scheme:dark]"
                              />
                            </div>
                            {/* Time field */}
                            <div className="group relative flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 transition-all focus-within:border-violet-400 dark:focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-400/20">
                              <svg className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500 group-focus-within:text-violet-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <input
                                type="time"
                                value={scheduleCustomTime}
                                onChange={(e) => setScheduleCustomTime(e.target.value)}
                                className="w-full bg-transparent text-xs text-gray-800 dark:text-gray-100 outline-none [color-scheme:light] dark:[color-scheme:dark]"
                              />
                            </div>
                          </div>
                          {customIsInPast && (
                            <p className="mt-2 flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
                              <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                              Please choose a future date and time.
                            </p>
                          )}
                          <button
                            onClick={() => { if (customHasValue && !customIsInPast) { setScheduledSendAt(customTs); setShowSchedulePicker(false); } }}
                            disabled={!customHasValue || customIsInPast}
                            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-violet-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                            Set custom time
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-md p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-violet-500"
                  title="Attach files"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => { setShowCompose(false); setComposeTo([]); setComposeGroupIds([]); setComposeToInput(""); setComposeSignature(""); setComposeQuote(""); setComposeAttachments([]); setComposeContentType("plain"); setShowPreview(false); setScheduledSendAt(null); setShowSchedulePicker(false); }}
                className="rounded-md p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-red-500"
                title="Discard"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sender Group modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700/50 px-5 py-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                {editingGroup ? "Edit Group" : "Create Group"}
              </h2>
              <button
                onClick={() => setShowGroupModal(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100"
                  placeholder="e.g. Marketing Team"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  Email Addresses ({groupEmails.length})
                </label>
                <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 p-2">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {groupEmails.map((email, i) => (
                      <span key={i} className="flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/40 py-0.5 pl-2.5 pr-1 text-xs font-medium text-blue-800 dark:text-blue-200">
                        {email}
                        <button
                          type="button"
                          onClick={() => setGroupEmails((prev) => prev.filter((_, j) => j !== i))}
                          className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-blue-500 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800 hover:text-blue-700"
                        >
                          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={groupEmailInput}
                    onChange={(e) => setGroupEmailInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
                        e.preventDefault();
                        const val = groupEmailInput.trim().replace(/,+$/, "");
                        if (val && isValidEmail(val) && !groupEmails.includes(val)) {
                          setGroupEmails((prev) => [...prev, val]);
                          setGroupEmailInput("");
                        }
                      } else if (e.key === "Backspace" && !groupEmailInput && groupEmails.length > 0) {
                        setGroupEmails((prev) => prev.slice(0, -1));
                      }
                    }}
                    onBlur={() => {
                      const val = groupEmailInput.trim().replace(/,+$/, "");
                      if (val && isValidEmail(val) && !groupEmails.includes(val)) {
                        setGroupEmails((prev) => [...prev, val]);
                        setGroupEmailInput("");
                      }
                    }}
                    className="w-full text-sm text-gray-900 dark:text-white outline-none placeholder-gray-400 dark:placeholder-gray-500 bg-transparent"
                    placeholder="Add email and press Enter..."
                  />
                </div>
                {/* Import button for group emails */}
                <div className="mt-2 flex items-center">
                  <input
                    ref={groupCsvImportRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="absolute w-0 h-0 overflow-hidden opacity-0"
                    onChange={handleGroupCSVImport}
                  />
                  <div ref={groupImportMenuRef} className="relative">
                    <button
                      type="button"
                      onClick={() => { setShowGroupImportMenu((v) => !v); setShowGroupGSheetsInput(false); setGroupImportError(null); }}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-violet-600 dark:hover:text-violet-400"
                      title="Import emails"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      Import
                    </button>
                    {showGroupImportMenu && (
                      <div className="absolute left-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                        <button
                          type="button"
                          onClick={() => groupCsvImportRef.current?.click()}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <svg className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                          <div>
                            <p className="font-medium">From CSV file</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">Upload a .csv file</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowGroupGSheetsInput((v) => !v)}
                          className="flex w-full items-center gap-3 border-t border-gray-100 dark:border-gray-700/50 px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          <svg className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                          </svg>
                          <div>
                            <p className="font-medium">From Google Sheets</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">Paste a sheet URL</p>
                          </div>
                        </button>
                        {showGroupGSheetsInput && (
                          <div className="border-t border-gray-100 dark:border-gray-700/50 px-4 py-3">
                            <p className="mb-1.5 text-xs text-gray-500 dark:text-gray-400">Paste a public Google Sheets URL:</p>
                            <input
                              type="url"
                              value={groupGSheetsUrl}
                              onChange={(e) => setGroupGSheetsUrl(e.target.value)}
                              onKeyDown={(e) => { if (e.key === "Enter") handleGroupGSheetsImport(); }}
                              className="w-full rounded-md border border-gray-200 dark:border-gray-600 dark:bg-gray-700 px-2.5 py-1.5 text-xs text-gray-800 dark:text-white outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100"
                              placeholder="https://docs.google.com/spreadsheets/..."
                            />
                            <button
                              type="button"
                              onClick={handleGroupGSheetsImport}
                              disabled={isGroupImporting || !groupGSheetsUrl.trim()}
                              className="mt-2 w-full rounded-md bg-violet-600 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
                            >
                              {isGroupImporting ? "Importing..." : "Import"}
                            </button>
                          </div>
                        )}
                        {groupImportError && (
                          <p className="border-t border-gray-100 dark:border-gray-700/50 px-4 py-2 text-xs text-red-600">{groupImportError}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {domainMailboxes && domainMailboxes.length > 1 && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    Shared with Mailboxes
                  </label>
                  <div className="space-y-1.5">
                    {domainMailboxes.map((mb: Doc<"mailboxes">) => (
                      <label key={mb._id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={groupMailboxIds.includes(mb._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setGroupMailboxIds((prev) => [...prev, mb._id]);
                            } else {
                              setGroupMailboxIds((prev) => prev.filter((id) => id !== mb._id));
                            }
                          }}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{mb.fullAddress}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700/50 px-5 py-3">
              <div>
                {editingGroup && (
                  <button
                    onClick={() => handleDeleteGroup(editingGroup)}
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Delete Group
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowGroupModal(false)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveGroup}
                  disabled={!groupName.trim() || groupEmails.length === 0}
                  className="rounded-md bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {editingGroup ? "Save Changes" : "Create Group"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Signature Editor Modal */}
      {showSignatureEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700/50 px-5 py-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Edit Signature</h2>
              <button
                onClick={() => setShowSignatureEditor(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Templates */}
              <div>
                <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">Start from a template</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSignatureText("Best regards,\n" + (mailbox?.displayName || mailbox?.address || ""))}
                    className="rounded-md border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Minimal
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignatureText((mailbox?.displayName || mailbox?.address || "") + "\n" + (mailbox?.fullAddress || "") + "\n\nSent via Mailmark")}
                    className="rounded-md border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Professional
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignatureText((mailbox?.displayName || mailbox?.address || "") + "\n" + (mailbox?.fullAddress || "") + "\n---\nThis email and any attachments are confidential.")}
                    className="rounded-md border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Corporate
                  </button>
                </div>
              </div>

              {/* Formatting toolbar */}
              <div className="flex items-center gap-1 rounded-t-md border border-b-0 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const ta = signatureEditorRef.current;
                    if (!ta) return;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const sel = signatureText.substring(start, end);
                    const replacement = sel ? `**${sel}**` : "**bold**";
                    setSignatureText(signatureText.substring(0, start) + replacement + signatureText.substring(end));
                  }}
                  className="rounded p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200"
                  title="Bold (**text**)"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6V4zm0 8h9a4 4 0 014 4 4 4 0 01-4 4H6v-8z" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const ta = signatureEditorRef.current;
                    if (!ta) return;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const sel = signatureText.substring(start, end);
                    const replacement = sel ? `_${sel}_` : "_italic_";
                    setSignatureText(signatureText.substring(0, start) + replacement + signatureText.substring(end));
                  }}
                  className="rounded p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200"
                  title="Italic (_text_)"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const ta = signatureEditorRef.current;
                    if (!ta) return;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const sel = signatureText.substring(start, end);
                    const replacement = sel ? `[${sel}](url)` : "[link text](url)";
                    setSignatureText(signatureText.substring(0, start) + replacement + signatureText.substring(end));
                  }}
                  className="rounded p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200"
                  title="Link [text](url)"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.874a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.374" /></svg>
                </button>
                <div className="mx-1 h-4 w-px bg-gray-300 dark:bg-gray-600" />
                <button
                  type="button"
                  onClick={() => {
                    const ta = signatureEditorRef.current;
                    if (!ta) return;
                    const start = ta.selectionStart;
                    setSignatureText(signatureText.substring(0, start) + "\n---\n" + signatureText.substring(start));
                  }}
                  className="rounded p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-200"
                  title="Horizontal rule"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" d="M3 12h18"/></svg>
                </button>
                <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500">Markdown supported</span>
              </div>

              {/* Editor textarea */}
              <textarea
                ref={signatureEditorRef}
                rows={8}
                value={signatureText}
                onChange={(e) => setSignatureText(e.target.value)}
                className="-mt-4 w-full resize-none rounded-b-md border border-gray-200 dark:border-gray-600 dark:bg-gray-700 px-3 py-2.5 text-sm font-mono text-gray-700 dark:text-gray-300 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100 dark:focus:border-violet-500 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="Enter your email signature..."
              />

              {/* Live preview */}
              {signatureText.trim() && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">Preview</p>
                  <div className="rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30 px-3 py-2.5">
                    <p className="mb-1 text-[10px] text-gray-400 dark:text-gray-500">--</p>
                    <div
                      className="text-sm text-gray-600 dark:text-gray-300 [&_strong]:font-semibold [&_em]:italic [&_a]:text-violet-600 [&_a]:underline [&_hr]:my-2 [&_hr]:border-gray-200 dark:[&_hr]:border-gray-600 [&_p]:mb-1"
                      dangerouslySetInnerHTML={{ __html: marked.parse(signatureText) as string }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700/50 px-5 py-3">
              {mailbox?.signature && (
                <button
                  onClick={async () => {
                    await updateSignature({ mailboxId: mbId, signature: "" });
                    setShowSignatureEditor(false);
                  }}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  Remove Signature
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setShowSignatureEditor(false)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await updateSignature({ mailboxId: mbId, signature: signatureText });
                    setShowSignatureEditor(false);
                  }}
                  className="rounded-md bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 transition-colors"
                >
                  Save Signature
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
