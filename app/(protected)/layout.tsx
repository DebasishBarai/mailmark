"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useClerk } from "@clerk/nextjs";
import { Authenticated, Unauthenticated, AuthLoading, useAction, useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import ThemeToggle from "../components/ThemeToggle";
import Logo from "../components/Logo";
import { SidebarProvider, useSidebar } from "../components/SidebarContext";
import UpgradeModal from "../components/UpgradeModal";
import ReferralTracker from "../components/ReferralTracker";
import SignupConversionTracker from "../components/SignupConversionTracker";

const sidebarLinks = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    label: "Domains",
    href: "/domains",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
  },
  {
    label: "Warming",
    href: "/warming",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
      </svg>
    ),
  },
  {
    label: "Domain Health",
    href: "/domain-health",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    label: "Unsubscribes",
    href: "/unsubscribes",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
  },
  {
    label: "Developer",
    href: "/developer",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
  },
  {
    label: "Docs",
    href: "/docs",
    external: true,
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    label: "Billing",
    href: "/billing",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
  },
  {
    label: "Affiliate",
    href: "/affiliate",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/settings",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function LoadingSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

function SignInRedirect() {
  const { openSignIn } = useClerk();
  const pathname = usePathname();

  useEffect(() => {
    openSignIn({ redirectUrl: pathname });
  }, [openSignIn, pathname]);

  return null;
}

function SyncUser() {
  const { isAuthenticated } = useConvexAuth();
  const addUser = useAction(api.users.addUser);
  const hasSynced = useRef(false);
  // Old: the isNew answer was held here and passed to the tracker.
  // const [isNewUser, setIsNewUser] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAuthenticated || hasSynced.current) return;
    hasSynced.current = true;
    // Old: addUser().then((result) => setIsNewUser(result?.isNew ?? false))
    addUser().catch(() => {
      // Sync failed (for example the Polar customer call). The row is not
      // created, so nothing is owed yet and the next visit retries.
    });
  }, [isAuthenticated, addUser]);

  // Old: return <SignupConversionTracker isNewUser={isNewUser} />;
  // The tracker now reads the persisted flag off the user row itself, so it no
  // longer depends on catching addUser's one-shot reply.
  return <SignupConversionTracker />;
}

function TrialGate({ children }: { children: ReactNode }) {
  const status = useQuery(api.subscriptions.currentStatus);

  // Still loading or user not yet synced - show children normally
  if (status === undefined || status === null) return <>{children}</>;

  if (status.needsUpgrade) {
    return (
      <>
        {/* Render page content behind the modal so layout doesn't jump */}
        <div className="pointer-events-none select-none opacity-40">
          {children}
        </div>
        {/* Old: <UpgradeModal /> always claimed the trial had ended. */}
        <UpgradeModal reason={status.upgradeReason} />
      </>
    );
  }

  return <>{children}</>;
}

const MB_COLORS = ["#7c3aed", "#0891b2", "#059669", "#d97706", "#db2777", "#4f46e5"];

function MailboxUnreadBadge({ mailboxId }: { mailboxId: Id<"mailboxes"> }) {
  const count = useQuery(api.emails.countUnreadByMailbox, { mailboxId });
  if (!count) return null;
  return (
    <span className="ml-auto rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
      {count}
    </span>
  );
}

function DomainSubNav({ domainId, collapsed, onNavigate }: { domainId: Id<"domains">; collapsed: boolean; onNavigate?: () => void }) {
  const domain = useQuery(api.domains.getById, { domainId });
  const mailboxes = useQuery(api.mailboxes.listByDomain, domain ? { domainId: domain._id } : "skip");

  if (!domain || collapsed) return null;

  return (
    <div className="px-3 pb-1">
      <div className="ml-3 border-l border-gray-200 pl-2 dark:border-gray-700">
        {/* Domain name row */}
        <div className="flex items-center gap-1.5 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
          <svg className="h-3 w-3 shrink-0" viewBox="0 0 8 8" fill="currentColor">
            <path d="M0 2l4 4 4-4H0z" />
          </svg>
          <span className="truncate">{domain.domain}</span>
        </div>
        {/* Mailbox sub-items */}
        {mailboxes?.map((mb, i) => (
          <Link
            key={mb._id}
            href={`/mailbox/${mb._id}`}
            onClick={onNavigate}
            className="flex items-center gap-2 rounded-md px-1 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700/60 dark:hover:text-gray-200"
          >
            <div
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: MB_COLORS[i % MB_COLORS.length] }}
            >
              {mb.address[0].toUpperCase()}
            </div>
            <span className="truncate">{mb.address}</span>
            <MailboxUnreadBadge mailboxId={mb._id} />
          </Link>
        ))}
      </div>
    </div>
  );
}

const adminLink = {
  label: "Admin",
  href: "/admin",
  icon: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
};

const sidebarToggleClass =
  "rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300";

const sidebarToggleIcon = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
);

function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { folderSection, setCloseMobile } = useSidebar();
  const currentUser = useQuery(api.users.current);

  // Extract domainId when browsing a domain page: /domains/[domainId]/...
  const domainPageMatch = pathname.match(/^\/domains\/([^/]+)/);
  const activeDomainId = domainPageMatch ? (domainPageMatch[1] as Id<"domains">) : null;

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  useEffect(() => {
    setCloseMobile(closeMobile);
  }, [closeMobile, setCloseMobile]);

  // Lock the document to the viewport for the whole protected app.
  //
  // The shell's chrome is fixed, so the content area is what should scroll. The
  // document staying scrollable meant any long page dragged the whole document
  // on mobile: the URL bar hid and the fixed sidebar and top bar moved against
  // the content. Giving <html> `overflow: hidden` removes the document's
  // scrollport outright, so no browser can scroll the page whatever a page
  // renders, and the class also sizes the shell chain in plain percentages and
  // makes <main> the scroll container (see `.app-locked` in globals.css), which
  // matches the visible viewport even where `dvh` is unsupported.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("app-locked");
    return () => root.classList.remove("app-locked");
  }, []);

  // The collapsed icon rail is a desktop affordance and mobile no longer has a
  // control to undo it, so make sure a collapse from a wider layout cannot
  // follow the user down into the mobile drawer and strand it half-width.
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 48rem)");
    const syncCollapsed = () => {
      if (!wide.matches) setSidebarCollapsed(false);
    };
    syncCollapsed();
    wide.addEventListener("change", syncCollapsed);
    return () => wide.removeEventListener("change", syncCollapsed);
  }, []);

  return (
    <div className="app-shell flex min-h-dvh bg-gray-50 dark:bg-gray-900">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 flex h-full flex-col border-r border-gray-200 bg-white transition-all dark:border-gray-700 dark:bg-gray-800 ${sidebarCollapsed ? "w-16" : "w-60"
          } ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-gray-100 px-4 dark:border-gray-700/50">
          <Link href="/dashboard" onClick={closeMobile} className="flex items-center gap-2 min-w-0">
            <Logo size={32} />
            {!sidebarCollapsed && (
              <span className="font-wordmark text-xl text-violet-600 truncate">Mailmark</span>
            )}
          </Link>
          {/* One toggle per layout. On mobile the sidebar is a slide-in drawer,
              so this button dismisses it the same way tapping the overlay does.
              Collapsing to an icon rail is a desktop affordance: on mobile it
              only narrowed the drawer, leaving a strip of it on screen instead
              of closing the menu. */}
          {/* <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            aria-label="Toggle sidebar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button> */}
          <button
            onClick={() => setMobileOpen(false)}
            className={`${sidebarToggleClass} md:hidden`}
            aria-label="Close menu"
          >
            {sidebarToggleIcon}
          </button>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`hidden ${sidebarToggleClass} md:block`}
            aria-label="Toggle sidebar"
          >
            {sidebarToggleIcon}
          </button>
        </div>

        {/* Scrollable nav area */}
        <div className="flex-1 overflow-y-auto">
          {/* Nav links */}
          <nav className="space-y-1 p-3">
            {sidebarLinks.map((link) => {
              const isActive =
                pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  {...("external" in link && link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className={`flex items-center gap-3 rounded-r-lg border-l-2 py-2.5 pl-[10px] pr-3 text-sm font-medium transition-colors ${isActive
                    ? "border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-400 dark:bg-violet-900/30 dark:text-violet-300"
                    : "border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                    }`}
                  title={sidebarCollapsed ? link.label : undefined}
                >
                  <span className={isActive ? "text-violet-600 dark:text-violet-400" : "text-gray-400 dark:text-gray-500"}>
                    {link.icon}
                  </span>
                  {!sidebarCollapsed && (
                    <span className="flex items-center gap-1.5">
                      {link.label}
                      {"external" in link && link.external && (
                        <svg className="h-3 w-3 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      )}
                    </span>
                  )}
                </Link>
              );
            })}
            {currentUser?.category === "admin" && (() => {
              const isActive = pathname.startsWith(adminLink.href);
              return (
                <>
                  <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
                  <Link
                    href={adminLink.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-r-lg border-l-2 py-2.5 pl-[10px] pr-3 text-sm font-medium transition-colors ${isActive
                      ? "border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-400 dark:bg-violet-900/30 dark:text-violet-300"
                      : "border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                      }`}
                    title={sidebarCollapsed ? adminLink.label : undefined}
                  >
                    <span className={isActive ? "text-violet-600 dark:text-violet-400" : "text-gray-400 dark:text-gray-500"}>
                      {adminLink.icon}
                    </span>
                    {!sidebarCollapsed && <span>{adminLink.label}</span>}
                  </Link>
                </>
              );
            })()}
          </nav>

          {/* Domain sub-nav: shows active domain + its mailboxes */}
          {activeDomainId && (
            <DomainSubNav domainId={activeDomainId} collapsed={sidebarCollapsed} onNavigate={closeMobile} />
          )}

          {/* Injected folder section (e.g. from mailbox page) */}
          {folderSection && folderSection.render(sidebarCollapsed)}
        </div>

        {/* User section */}
        <div className="border-t border-gray-100 p-3 dark:border-gray-700/50">
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? "flex-col" : ""}`}>
            <ThemeToggle />
            <UserButton />
            {!sidebarCollapsed && (
              <span className="text-xs text-gray-500 dark:text-gray-400">Account</span>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed left-0 right-0 top-0 z-20 flex h-14 items-center border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-800 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          aria-label="Open menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <Link href="/dashboard" className="ml-3 flex items-center gap-2">
          <Logo size={28} />
          <span className="font-wordmark text-lg text-violet-600">Mailmark</span>
        </Link>
      </div>

      {/* Main content */}
      <main
        className={`app-main min-w-0 flex-1 pt-14 transition-all md:pt-0 ${sidebarCollapsed ? "md:ml-16" : "md:ml-60"
          }`}
      >
        <TrialGate>{children}</TrialGate>
      </main>
    </div>
  );
}

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AuthLoading>
        <LoadingSpinner />
      </AuthLoading>
      <Unauthenticated>
        <SignInRedirect />
      </Unauthenticated>
      <Authenticated>
        <SyncUser />
        <ReferralTracker />
        {/* Old: mounted standalone, when the gate was the Clerk account age.
            It now renders inside SyncUser, which owns the isNew flag. */}
        {/* <SignupConversionTracker /> */}
        <AppShell>{children}</AppShell>
      </Authenticated>
    </SidebarProvider>
  );
}
