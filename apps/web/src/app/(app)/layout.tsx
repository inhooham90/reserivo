"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

/** Everything under (app) requires a session. Anonymous visitors go to /login. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { status, user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated" || !user) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <>
      {user.actorUserId && (
        <div className="bg-destructive px-4 py-1.5 text-center text-sm font-medium text-white">
          Acting as {user.name} — every action is being audited under your admin account.
        </div>
      )}
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="font-semibold">
              Reserivo
            </Link>
            {user.isSiteAdmin && (
              <Link href="/admin" className="text-muted-foreground hover:text-foreground">
                Admin
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{user.name}</span>
            <Button variant="outline" size="sm" onClick={() => void logout().then(() => router.replace("/login"))}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">{children}</main>
    </>
  );
}
