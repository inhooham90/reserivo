"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { SettingsMenu } from "@/components/layout/settings-menu";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Everything under (app) requires a session. Anonymous visitors go to /login. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { status, user, logout, stopImpersonating } = useAuth();
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
        <div className="flex flex-wrap items-center justify-center gap-3 bg-destructive px-4 py-1.5 text-center text-sm font-medium text-white">
          <span>Acting as {user.name} — every action is recorded against your admin account.</span>
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => void stopImpersonating().then(() => router.replace("/admin"))}
          >
            Stop
          </button>
        </div>
      )}
      {!user.emailVerified && !user.actorUserId && <VerifyEmailNotice />}
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="font-semibold">
              Reserivo
            </Link>
            <Link href="/appointments" className="text-muted-foreground hover:text-foreground">
              My appointments
            </Link>
            <Link href="/messages" className="text-muted-foreground hover:text-foreground">
              Messages
            </Link>
            {user.isSiteAdmin && (
              <Link href="/admin" className="text-muted-foreground hover:text-foreground">
                Admin
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{user.name}</span>
            <SettingsMenu />
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

/**
 * Until the address is confirmed nothing is matched to it, so bookings made
 * as a guest stay hidden. Say that plainly rather than letting it look broken.
 */
function VerifyEmailNotice() {
  const resend = useMutation({ mutationFn: () => api<void>("/auth/verify-email/resend", { method: "POST" }) });

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-b bg-accent px-4 py-1.5 text-center text-sm text-accent-foreground">
      <span>Confirm your email to see bookings you made as a guest and to get reminders.</span>
      <button type="button" className="underline underline-offset-2" disabled={resend.isPending} onClick={() => resend.mutate()}>
        {resend.isPending ? "Sending…" : resend.isSuccess ? "Sent — check your inbox" : "Resend the link"}
      </button>
    </div>
  );
}
