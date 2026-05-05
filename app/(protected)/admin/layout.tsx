"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect, ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const currentUser = useQuery(api.users.current);
  const router = useRouter();

  useEffect(() => {
    // currentUser === undefined means still loading; null means not signed in
    if (currentUser === undefined || currentUser === null) return;
    if (currentUser.category !== "admin") {
      router.replace("/dashboard");
    }
  }, [currentUser, router]);

  // Loading state
  if (currentUser === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
      </div>
    );
  }

  // Not admin -- redirect is in flight, render nothing
  if (!currentUser || currentUser.category !== "admin") {
    return null;
  }

  return <>{children}</>;
}
