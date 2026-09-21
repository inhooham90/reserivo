"use client";

import { useSearchParams } from "next/navigation";
/**
 * Where to go after login/register. Only same-origin paths are honoured so a
 * crafted link cannot bounce a fresh session to another site.
 */
export function useNextPath(fallback = "/dashboard"): string {
  const next = useSearchParams().get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
