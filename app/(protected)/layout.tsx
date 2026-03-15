"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useClerk } from "@clerk/nextjs";
import { Authenticated, Unauthenticated, AuthLoading, useAction, useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import ThemeToggle from "../components/ThemeToggle";
import { SidebarProvider, useSidebar } from "../components/SidebarContext";
import UpgradeModal from "../components/UpgradeModal";
import ReferralTracker from "../components/ReferralTracker";

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
    label: "Developer",
    href: "/developer",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
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
];

function LoadingSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

function SignInRedirect() {
  const { redirectToSignIn } = useClerk();
  const pathname = usePathname();

  useEffect(() => {
    redirectToSignIn({ redirectUrl: pathname });
  }, [redirectToSignIn, pathname]);

  return null;
}

function SyncUser() {
  const { isAuthenticated } = useConvexAuth();
  const addUser = useAction(api.users.addUser);
  const hasSynced = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || hasSynced.current) return;
    hasSynced.current = true;
    addUser();
  }, [isAuthenticated, addUser]);

  return null;
}

function TrialGate({ children }: { children: ReactNode }) {
  const status = useQuery(api.subscriptions.currentStatus);

  // Still loading or user not yet synced — show children normally
  if (status === undefined || status === null) return <>{children}</>;

  if (status.needsUpgrade) {
    return (
      <>
        {/* Render page content behind the modal so layout doesn't jump */}
        <div className="pointer-events-none select-none opacity-40">
          {children}
        </div>
        <UpgradeModal />
      </>
    );
  }

  return <>{children}</>;
}

function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { folderSection, setCloseMobile } = useSidebar();

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  useEffect(() => {
    setCloseMobile(closeMobile);
  }, [closeMobile, setCloseMobile]);

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
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
          {!sidebarCollapsed && (
            <Link href="/dashboard" className="text-xl font-bold text-violet-600">
              Mailmark
            </Link>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            aria-label="Toggle sidebar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
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
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive
                    ? "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                    }`}
                  title={sidebarCollapsed ? link.label : undefined}
                >
                  <span className={isActive ? "text-violet-600 dark:text-violet-400" : "text-gray-400 dark:text-gray-500"}>
                    {link.icon}
                  </span>
                  {!sidebarCollapsed && <span>{link.label}</span>}
                </Link>
              );
            })}
          </nav>

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
        <Link href="/dashboard" className="ml-3 text-lg font-bold text-violet-600">
          Mailmark
        </Link>
      </div>

      {/* Main content */}
      <main
        className={`flex-1 pt-14 transition-all md:pt-0 ${sidebarCollapsed ? "md:ml-16" : "md:ml-60"
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
        <AppShell>{children}</AppShell>
      </Authenticated>
    </SidebarProvider>
  );
}
