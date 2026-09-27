"use client";

import { useSearchParams } from "next/navigation";
/**
 * Where to go after login/register. Only same-origin paths are honoured so a
 * crafted link cannot bounce a fresh session to another site. "//host" and
 * "/\host" are both read by browsers as another origin, so neither counts.
 * This matters more now that signed-in visitors to /login are forwarded to it
 * without clicking anything.
 */
export function useNextPath(fallback = "/dashboard"): string {
  const next = useSearchParams().get("next");
  return next && next.startsWith("/") && !/^\/[/\\]/.test(next) ? next : fallback;
}
