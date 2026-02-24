"use client";

import { useState } from "react";
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
  const toggleStar = useMutation(api.emails.toggleStar);
  const moveToFolder = useMutation(api.emails.moveToFolder);
  const sendEmail = useAction(api.ses.sendEmail);
  const fetchEmailBody = useAction(api.ses.fetchEmailBody);

  const [selectedEmailId, setSelectedEmailId] = useState<Id<"emails"> | null>(null);
  const [emailBody, setEmailBody] = useState<string | null>(null);
  const [loadingBody, setLoadingBody] = useState(false);

  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const isLoading = mailbox === undefined || emails === undefined;

  const selectedEmail = emails?.find((e: Doc<"emails">) => e._id === selectedEmailId);

  const handleSelectEmail = async (emailId: Id<"emails">) => {
    setSelectedEmailId(emailId);
    setEmailBody(null);

    const email = emails?.find((e: Doc<"emails">) => e._id === emailId);
    if (email && !email.read) {
      await markAsRead({ emailId });
    }

    // Fetch full body from S3
    if (email) {
      setLoadingBody(true);
      try {
        const body = await fetchEmailBody({ s3Key: email.s3Key });
        setEmailBody(body);
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
      await sendEmail({
        mailboxId: mbId,
        to: recipients,
        subject: composeSubject,
        body: composeBody,
      });
      setShowCompose(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
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
            onClick={() => { setShowCompose(true); setSendError(null); }}
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
              <div className="flex gap-2">
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
            <h3 className="text-sm font-semibold text-gray-900">New Message</h3>
            <button
              onClick={() => { setShowCompose(false); setSendError(null); }}
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
                rows={8}
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                className="w-full resize-none text-sm text-gray-700 outline-none placeholder-gray-400"
                placeholder="Write your message..."
              />
            </div>
            {sendError && (
              <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                {sendError}
              </div>
            )}
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={handleSend}
                disabled={!composeTo.trim() || !composeSubject.trim() || isSending}
                className="rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
              >
                {isSending ? "Sending..." : "Send"}
              </button>
              <button
                onClick={() => setShowCompose(false)}
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
