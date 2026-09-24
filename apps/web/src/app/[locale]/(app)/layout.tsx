"use client";

import { useMutation } from "@tanstack/react-query";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { SettingsMenu } from "@/components/layout/settings-menu";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "cn";

/** Everything under (app) requires a session. Anonymous visitors go to /login. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { status, user, logout, stopImpersonating } = useAuth();
  const router = useRouter();
  const t = useTranslations("nav");
  const common = useTranslations("common");
  // Inside a salon the schedule wants every pixel of width; personal pages
  // (appointments, messages, account settings) read better in a column.
  const wide = usePathname().startsWith("/s/");

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated" || !user) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">{common("loading")}</div>;
  }

  return (
    <>
      {user.actorUserId && (
        <div className="flex flex-wrap items-center justify-center gap-3 bg-destructive px-4 py-1.5 text-center text-sm font-medium text-white">
          <span>{t("actingAs", { name: user.name })}</span>
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => void stopImpersonating().then(() => router.replace("/admin"))}
          >
            {t("stop")}
          </button>
        </div>
      )}
      {!user.emailVerified && !user.actorUserId && <VerifyEmailNotice />}
      <header className="border-b">
        <div className={cn("mx-auto flex h-14 w-full items-center justify-between px-4", wide ? "lg:px-6" : "max-w-5xl")}>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="font-semibold">
              Reserivo
            </Link>
            <Link href="/appointments" className="text-muted-foreground hover:text-foreground">
              {t("myAppointments")}
            </Link>
            <Link href="/messages" className="text-muted-foreground hover:text-foreground">
              {t("messages")}
            </Link>
            {user.isSiteAdmin && (
              <Link href="/admin" className="text-muted-foreground hover:text-foreground">
                {t("admin")}
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{user.name}</span>
            <LocaleSwitcher />
            <SettingsMenu />
            <Button variant="outline" size="sm" onClick={() => void logout().then(() => router.replace("/login"))}>
              {t("signOut")}
            </Button>
          </div>
        </div>
      </header>
      <main className={cn("mx-auto w-full flex-1 p-4", wide ? "lg:px-6" : "max-w-5xl")}>{children}</main>
    </>
  );
}

/**
 * Until the address is confirmed nothing is matched to it, so bookings made
 * as a guest stay hidden. Say that plainly rather than letting it look broken.
 */
function VerifyEmailNotice() {
  const t = useTranslations("nav.verify");
  const resend = useMutation({ mutationFn: () => api<void>("/auth/verify-email/resend", { method: "POST" }) });

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-b bg-accent px-4 py-1.5 text-center text-sm text-accent-foreground">
      <span>{t("text")}</span>
      <button type="button" className="underline underline-offset-2" disabled={resend.isPending} onClick={() => resend.mutate()}>
        {resend.isPending ? t("sending") : resend.isSuccess ? t("sent") : t("resend")}
      </button>
    </div>
  );
}
