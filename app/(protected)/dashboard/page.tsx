"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import DashboardView from "../../components/DashboardView";

/**
 * The signed-in user's dashboard.
 *
 * Everything this page used to render inline now lives in
 * app/components/DashboardView.tsx, so that the admin view of another user's
 * dashboard (/admin/users/[userId]) renders the same component from the same
 * data shape. This page is only the wiring: three queries scoped to the caller,
 * handed straight to the view.
 */
export default function DashboardPage() {
  const domains = useQuery(api.domains.listForCurrentUser);
  const emailStats = useQuery(api.emailStats.getForCurrentUser);
  // Old: the contact allowance banner ran this query itself. It is lifted here
  // so the same banner can be fed another user's usage in the admin view.
  const usage = useQuery(api.quotas.getUsageAndLimits);

  return <DashboardView domains={domains} emailStats={emailStats} usage={usage} />;
}
