"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Doc, Id } from "../../../../convex/_generated/dataModel";

const folderConfig = [
  { key: "inbox", label: "Inbox" },
  { key: "sent", label: "Sent" },
  { key: "outbox", label: "Outbox" },
  { key: "drafts", label: "Drafts" },
  { key: "campaigns", label: "Campaigns" },
];

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

export default function MailboxPage() {
  const { mailboxId } = useParams<{ mailboxId: string }>();
  const mbId = mailboxId as Id<"mailboxes">;

  const mailbox = useQuery(api.mailboxes.getById, { mailboxId: mbId });
  const domainMailboxes = useQuery(
    api.mailboxes.listByDomain,
    mailbox?.domainId ? { domainId: mailbox.domainId } : "skip"
  );
  const [activeFolder, setActiveFolder] = useState("inbox");
  const emails = useQuery(api.emails.listByFolder, {
    mailboxId: mbId,
    folder: activeFolder,
  });
  const inboxEmails = useQuery(api.emails.listByFolder, {
    mailboxId: mbId,
    folder: "inbox",
  });
  const unreadCount = inboxEmails?.filter((e: Doc<"emails">) => !e.read).length ?? 0;
  const markAsRead = useMutation(api.emails.markAsRead);
  const markAsUnread = useMutation(api.emails.markAsUnread);
  const toggleStar = useMutation(api.emails.toggleStar);
  const moveToFolder = useMutation(api.emails.moveToFolder);
  const sendEmail = useAction(api.ses.sendEmail);
  const fetchEmailBody = useAction(api.ses.fetchEmailBody);
  const getAttachment = useAction(api.ses.getAttachment);

  const [selectedEmailId, setSelectedEmailId] = useState<Id<"emails"> | null>(null);
  const [emailBody, setEmailBody] = useState<string | null>(null);
  const [loadingBody, setLoadingBody] = useState(false);
  const [emailAttachments, setEmailAttachments] = useState<
    Array<{ filename: string; contentType: string; size: number }>
  >([]);
  const [downloadingAttachment, setDownloadingAttachment] = useState<number | null>(null);

  type ComposeMode = "compose" | "reply" | "replyAll" | "forward";
  const [showCompose, setShowCompose] = useState(false);
  const [composeMode, setComposeMode] = useState<ComposeMode>("compose");
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeQuote, setComposeQuote] = useState("");
  const [composeAttachments, setComposeAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const isLoading = mailbox === undefined || emails === undefined;

  const selectedEmail = emails?.find((e: Doc<"emails">) => e._id === selectedEmailId);

  const handleSelectEmail = async (emailId: Id<"emails">) => {
    setSelectedEmailId(emailId);
    setEmailBody(null);
    setEmailAttachments([]);

    const email = emails?.find((e: Doc<"emails">) => e._id === emailId);
    if (email && !email.read) {
      await markAsRead({ emailId });
    }

    // Fetch full body from S3
    if (email) {
      setLoadingBody(true);
      try {
        const result = await fetchEmailBody({ s3Key: email.s3Key });
        setEmailBody(result.body);
        setEmailAttachments(result.attachments);
      } catch {
        setEmailBody("Failed to load email body.");
      } finally {
        setLoadingBody(false);
      }
    }
  };

  const handleSend = async () => {
    if (!composeTo.trim() || !composeSubject.trim()) return;
    setIsSending(true);
    setSendError(null);
    try {
      const recipients = composeTo.split(",").map((e) => e.trim()).filter(Boolean);
      const fullBody = composeBody.replace(/\n/g, "<br>") + (composeQuote ? `<br><br>${composeQuote}` : "");
      const attachmentData = await Promise.all(
        composeAttachments.map(async (file) => {
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = "";
          bytes.forEach((b) => (binary += String.fromCharCode(b)));
          return {
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            data: btoa(binary),
          };
        })
      );
      await sendEmail({
        mailboxId: mbId,
        to: recipients,
        subject: composeSubject,
        body: fullBody,
        attachments: attachmentData.length > 0 ? attachmentData : undefined,
      });
      setShowCompose(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      setComposeQuote("");
      setComposeAttachments([]);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send email. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleMoveToTrash = async (emailId: Id<"emails">) => {
    await moveToFolder({ emailId, folder: "trash" });
    if (selectedEmailId === emailId) {
      setSelectedEmailId(null);
      setEmailBody(null);
    }
  };

  const handleOpenCompose = () => {
    setComposeMode("compose");
    setComposeTo("");
    setComposeSubject("");
    setComposeBody("");
    setComposeQuote("");
    setComposeAttachments([]);
    setSendError(null);
    setShowCompose(true);
  };

  const handleReply = () => {
    if (!selectedEmail || !emailBody) return;
    setComposeMode("reply");
    setComposeTo(selectedEmail.from);
    setComposeSubject(
      selectedEmail.subject.startsWith("Re:")
        ? selectedEmail.subject
        : `Re: ${selectedEmail.subject}`
    );
    setComposeBody("");
    setComposeQuote(
      `<blockquote style="margin:0 0 0 .8ex;border-left:2px solid #ccc;padding-left:1ex;"><p><strong>On ${new Date(selectedEmail.date).toLocaleString()}, ${selectedEmail.from} wrote:</strong></p>${emailBody}</blockquote>`
    );
    setComposeAttachments([]);
    setSendError(null);
    setShowCompose(true);
  };

  const handleReplyAll = () => {
    if (!selectedEmail || !emailBody || !mailbox) return;
    const myAddress = mailbox.fullAddress;
    const recipients = [
      selectedEmail.from,
      ...selectedEmail.to.filter((addr) => addr !== myAddress),
    ];
    setComposeMode("replyAll");
    setComposeTo(recipients.join(", "));
    setComposeSubject(
      selectedEmail.subject.startsWith("Re:")
        ? selectedEmail.subject
        : `Re: ${selectedEmail.subject}`
    );
    setComposeBody("");
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
    setComposeTo("");
    setComposeSubject(
      selectedEmail.subject.startsWith("Fwd:")
        ? selectedEmail.subject
        : `Fwd: ${selectedEmail.subject}`
    );
    setComposeBody("");
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
      <div className="flex h-[calc(100vh)] flex-col">
        <div className="flex items-center border-b border-gray-200 bg-white px-6 py-3">
          <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="flex flex-1">
          <div className="w-48 border-r border-gray-100 bg-gray-50 p-3">
            <div className="mb-4 h-10 animate-pulse rounded-lg bg-gray-200" />
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          </div>
          <div className="flex-1 p-4">
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
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
    <div className="flex h-[calc(100vh)] flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-900">{mailbox.fullAddress}</h1>
          {mailbox.displayName && (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">
              {mailbox.displayName}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Folder sidebar */}
        <div className="flex w-48 shrink-0 flex-col border-r border-gray-100 bg-gray-50 p-3">
          <button
            onClick={handleOpenCompose}
            className="mb-3 w-full rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700"
          >
            Compose
          </button>
          <nav className="space-y-1">
            {folderConfig.map((folder) => (
              <button
                key={folder.key}
                onClick={() => {
                  setActiveFolder(folder.key);
                  setSelectedEmailId(null);
                  setEmailBody(null);
                }}
                className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs transition-colors ${activeFolder === folder.key
                  ? "bg-violet-50 font-semibold text-violet-700"
                  : "text-gray-600 hover:bg-gray-100"
                  }`}
              >
                <span>{folder.label}</span>
                {folder.key === "inbox" && unreadCount > 0 && (
                  <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
          {domainMailboxes && domainMailboxes.length > 1 && (
            <div className="mt-auto border-t border-gray-200 pt-3">
              <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Mailboxes
              </p>
              <div className="space-y-1">
                {domainMailboxes.map((mb: Doc<"mailboxes">) => (
                  <Link
                    key={mb._id}
                    href={`/mailbox/${mb._id}`}
                    className={`block truncate rounded-md px-2 py-1 text-[10px] transition-colors ${mb._id === mbId
                      ? "bg-violet-50 font-medium text-violet-700"
                      : "text-gray-500 hover:bg-gray-100"
                      }`}
                  >
                    {mb.fullAddress}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Email list */}
        <div className={`shrink-0 overflow-y-auto border-r border-gray-200 bg-white ${selectedEmailId ? "w-80" : "flex-1"}`}>
          {emails.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <p className="mt-2 text-sm text-gray-500">No emails in {activeFolder}</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {emails.map((email: Doc<"emails">) => (
                <button
                  key={email._id}
                  onClick={() => handleSelectEmail(email._id)}
                  className={`w-full px-4 py-3 text-left transition-colors ${selectedEmailId === email._id
                    ? "bg-violet-50"
                    : !email.read
                      ? "bg-blue-50/30 hover:bg-gray-50"
                      : "hover:bg-gray-50"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${!email.read ? "font-semibold text-gray-900" : "text-gray-700"}`}>
                      {email.from}
                    </span>
                    <div className="flex items-center gap-1">
                      {email.starred && (
                        <svg className="h-3.5 w-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" />
                        </svg>
                      )}
                      <span className="text-xs text-gray-400">{timeAgo(email.date)}</span>
                    </div>
                  </div>
                  <p className={`mt-0.5 text-sm ${!email.read ? "font-medium text-gray-800" : "text-gray-600"}`}>
                    {email.subject}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-400">
                    {email.snippet}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Email detail */}
        {selectedEmailId && selectedEmail && (
          <div className="flex-1 overflow-y-auto bg-white p-8">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedEmail.subject}
                </h2>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600">
                    {selectedEmail.from[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedEmail.from}</p>
                    <p className="text-xs text-gray-500">To: {selectedEmail.to.join(", ")}</p>
                  </div>
                  <span className="text-xs text-gray-400">{timeAgo(selectedEmail.date)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {emailBody && (
                  <>
                    <button
                      onClick={handleReply}
                      title="Reply"
                      className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                      </svg>
                      Reply
                    </button>
                    <button
                      onClick={handleReplyAll}
                      title="Reply All"
                      className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.25L9 3m0 0l6 5.25M9 3v13.5m6-10.5L21 9m0 0l-6 5.25M21 9v7.5" />
                      </svg>
                      Reply All
                    </button>
                    <button
                      onClick={handleForward}
                      title="Forward"
                      className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
                      </svg>
                      Forward
                    </button>
                    <div className="mx-1 h-4 w-px bg-gray-200" />
                  </>
                )}
                <button
                  onClick={handleMarkAsUnread}
                  title="Mark as unread"
                  className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-blue-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => toggleStar({ emailId: selectedEmail._id })}
                  className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-yellow-500"
                >
                  <svg className={`h-4 w-4 ${selectedEmail.starred ? "text-yellow-400" : ""}`} fill={selectedEmail.starred ? "currentColor" : "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleMoveToTrash(selectedEmail._id)}
                  className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700">
              {loadingBody ? (
                <div className="space-y-2">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-full animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
                </div>
              ) : emailBody ? (
                <div dangerouslySetInnerHTML={{ __html: emailBody }} />
              ) : (
                <p>{selectedEmail.snippet}</p>
              )}
            </div>
            {emailAttachments.length > 0 && (
              <div className="mt-6 border-t border-gray-100 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Attachments ({emailAttachments.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {emailAttachments.map((att, i) => (
                    <button
                      key={i}
                      onClick={() => handleDownloadAttachment(i)}
                      disabled={downloadingAttachment === i}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                      </svg>
                      <span className="max-w-[160px] truncate">{att.filename}</span>
                      <span className="text-gray-400">
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
        )}

        {/* No email selected */}
        {!selectedEmailId && (
          <div className="hidden flex-1 items-center justify-center bg-gray-50 md:flex">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              <p className="mt-2 text-sm text-gray-500">Select an email to read</p>
            </div>
          </div>
        )}
      </div>

      {/* Compose modal */}
      {showCompose && (
        <div className="fixed bottom-0 right-8 z-50 w-full max-w-lg rounded-t-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-3">
            <h3 className="text-sm font-semibold text-gray-900">
              {{ compose: "New Message", reply: "Reply", replyAll: "Reply All", forward: "Forward" }[composeMode]}
            </h3>
            <button
              onClick={() => { setShowCompose(false); setSendError(null); setComposeQuote(""); setComposeAttachments([]); }}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-2">
                <span className="text-sm text-gray-500">From:</span>
                <span className="text-sm text-gray-900">{mailbox.fullAddress}</span>
              </div>
              <div className="flex items-center gap-3 border-b border-gray-100 pb-2">
                <span className="text-sm text-gray-500">To:</span>
                <input
                  type="text"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  className="flex-1 text-sm text-gray-900 outline-none placeholder-gray-400"
                  placeholder="recipient@example.com"
                />
              </div>
              <div className="flex items-center gap-3 border-b border-gray-100 pb-2">
                <span className="text-sm text-gray-500">Subject:</span>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className="flex-1 text-sm text-gray-900 outline-none placeholder-gray-400"
                  placeholder="Email subject"
                />
              </div>
              <textarea
                rows={composeQuote ? 4 : 8}
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                className="w-full resize-none text-sm text-gray-700 outline-none placeholder-gray-400"
                placeholder="Write your message..."
              />
              {composeQuote && (
                <div
                  className="mt-2 max-h-40 overflow-y-auto border-t border-gray-100 pt-2 text-sm text-gray-400"
                  dangerouslySetInnerHTML={{ __html: composeQuote }}
                />
              )}
              {/* Selected attachments */}
              {composeAttachments.length > 0 && (
                <div className="border-t border-gray-100 pt-2">
                  <p className="mb-1.5 text-xs font-medium text-gray-500">
                    {composeAttachments.length} attachment{composeAttachments.length > 1 ? "s" : ""}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {composeAttachments.map((file, i) => (
                      <div key={i} className="flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-xs text-violet-700">
                        <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                        </svg>
                        <span className="max-w-[140px] truncate font-medium">{file.name}</span>
                        <span className="text-violet-400">({file.size < 1024 ? "< 1" : Math.round(file.size / 1024)}kb)</span>
                        <button
                          type="button"
                          onClick={() => setComposeAttachments((prev) => prev.filter((_, j) => j !== i))}
                          className="ml-0.5 text-violet-400 hover:text-red-500"
                          title="Remove attachment"
                        >×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {sendError && (
              <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                {sendError}
              </div>
            )}
            {/* File input — not display:none so onChange fires reliably in all browsers */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="absolute w-0 h-0 overflow-hidden opacity-0"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length > 0) {
                  setComposeAttachments((prev) => [...prev, ...files]);
                }
              }}
            />
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSend}
                  disabled={!composeTo.trim() || !composeSubject.trim() || isSending}
                  className="rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
                >
                  {isSending
                    ? composeAttachments.length > 0
                      ? `Sending with ${composeAttachments.length} attachment${composeAttachments.length > 1 ? "s" : ""}...`
                      : "Sending..."
                    : "Send"}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-violet-500"
                  title="Attach files"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => { setShowCompose(false); setComposeQuote(""); setComposeAttachments([]); }}
                className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-red-500"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
