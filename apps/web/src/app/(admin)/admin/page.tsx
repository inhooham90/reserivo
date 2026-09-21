"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

/**
 * Site admin console. Phase 4 adds user/salon search, act-as, and the audit
 * log viewer. Gated client-side here; every API route re-checks isSiteAdmin.
 */
export default function AdminPage() {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
    else if (status === "authenticated" && !user?.isSiteAdmin) router.replace("/dashboard");
  }, [status, user, router]);

  if (status !== "authenticated" || !user?.isSiteAdmin) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-4">
      <h1 className="text-xl font-semibold">Admin</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Signed in as site admin {user.email}. Tools land here in Phase 4.
      </p>
    </main>
  );
}
