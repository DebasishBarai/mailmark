"use client";

import { useEffect } from "react";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; max-age=0; path=/`;
}

export default function ReferralTracker() {
  const { isAuthenticated } = useConvexAuth();
  const attributeReferral = useMutation(api.affiliates.attributeReferral);

  useEffect(() => {
    if (!isAuthenticated) return;
    const code = getCookie("mailmark_ref");
    if (!code) return;

    attributeReferral({ code })
      .then(() => deleteCookie("mailmark_ref"))
      .catch(() => {});
  }, [isAuthenticated, attributeReferral]);

  return null;
}
