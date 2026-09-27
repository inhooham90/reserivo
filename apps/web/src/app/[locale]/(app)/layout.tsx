"use client";

import { useMutation } from "@tanstack/react-query";
import Image from "next/image";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { PersonalMenu } from "@/components/layout/personal-menu";
import { SettingsMenu } from "@/components/layout/settings-menu";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { LEGAL } from "@/lib/legal";
import { ghostPillSm, navGroup, navItem, outlinePillSm, textLink } from "@/lib/v3";
import { cn } from "cn";

/** Everything under (app) requires a session. Anonymous visitors go to /login. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { status, user, logout, stopImpersonating } = useAuth();
  const router = useRouter();
  const t = useTranslations("nav");
  const common = useTranslations("common");
  const pathname = usePathname();
  // Read from the URL, never from localStorage during render (hydration; see CLAUDE.md).
  const { salonId } = useParams<{ salonId?: string }>();
  // Inside a salon the schedule wants every pixel of width; personal pages
  // (appointments, messages, account settings) sit in DESIGN.md's 1200px
  // column. The 24px/40px gutters apply either way.
  const wide = pathname.startsWith("/s/");
  const column = cn("mx-auto w-full px-6 md:px-10", !wide && "max-w-[calc(1200px+5rem)]");

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated" || !user) {
    return (
      <div className="theme-morrri flex flex-1 items-center justify-center text-muted-foreground">{common("loading")}</div>
    );
  }

  // A business account's header is the business: Schedule and Messages go to
  // the business in the URL, or through /dashboard to the one they used last.
  // Their personal bookings and inbox sit behind PersonalMenu instead.
  const inSalon = (tab: string) => new RegExp(`^/s/[^/]+/${tab}(/|$)`).test(pathname);
  const links = [
    ...(user.isBusinessAccount
      ? [
          { href: salonId ? `/s/${salonId}/calendar` : "/dashboard", label: t("schedule"), active: inSalon("calendar") },
          { href: salonId ? `/s/${salonId}/messages` : "/dashboard?to=messages", label: t("messages"), active: inSalon("messages") },
        ]
      : [
          { href: "/appointments", label: t("myAppointments"), active: pathname.startsWith("/appointments") },
          { href: "/messages", label: t("messages"), active: pathname.startsWith("/messages") },
        ]),
    ...(user.isSiteAdmin ? [{ href: "/admin", label: t("admin"), active: pathname.startsWith("/admin") }] : []),
  ];

  return (
    // Morrri v3 (DESIGN.md) covers the whole signed-in app: every salon tab
    // shares this header, so converting only the schedule would switch
    // palettes on each click. The scope is light-only for now.
    // From lg up, a page carrying data-fill-viewport (the chat) gets exactly the
    // screen (dvh follows collapsing browser bars) and main hands the height left
    // under the header to the page. Every other page, and the chat below lg, grows
    // and scrolls as usual.
    <div className="theme-morrri flex flex-1 flex-col lg:has-[[data-fill-viewport]]:h-dvh lg:has-[[data-fill-viewport]]:flex-none">

      {/* The banners sit inside <header> so nothing on the page is outside a
          landmark; a screen reader moving by region would otherwise skip them. */}
      <header>
        {user.actorUserId && (
          <div className="flex flex-wrap items-center justify-center gap-3 bg-destructive px-4 py-1.5 text-center text-sm font-medium text-destructive-foreground">
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
        <div className="border-b border-border py-4">
          <div className={cn(column, "flex flex-wrap items-center gap-x-6 gap-y-3")}>
            <Link
              href="/dashboard"
              className="shrink-0 rounded-sm leading-none outline-none focus-visible:ring-3 focus-visible:ring-ring"
            >
              <Image src="/images/morrri-wordmark.png" alt={LEGAL.product} width={74} height={18} priority />
            </Link>
            {/* Drops to its own row on a phone rather than crowding the account cluster. */}
            <nav aria-label={t("primaryLabel")} className={cn(navGroup, "order-last w-full md:order-none md:w-auto")}>
              {links.map((link) => (
                <Link key={link.href} href={link.href} aria-current={link.active ? "page" : undefined} className={navItem(link.active)}>
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-1">
              <span className="flex items-center gap-2 pr-2 text-sm font-medium">
                <span
                  aria-hidden
                  className="grid size-8 place-items-center rounded-full bg-lavender text-xs font-semibold shadow-[inset_0_0_0_1px_var(--border)]"
                >
                  {initials(user.name)}
                </span>
                <span className="hidden lg:inline">{user.name}</span>
              </span>
              {user.isBusinessAccount && <PersonalMenu className={ghostPillSm} />}
              <LocaleSwitcher className={cn(ghostPillSm, "hidden sm:inline-flex")} />
              <SettingsMenu className={ghostPillSm} />
              <Button
                variant="outline"
                size="sm"
                className={outlinePillSm}
                onClick={() => void logout().then(() => router.replace("/login"))}
              >
                {t("signOut")}
              </Button>
            </div>
          </div>
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className={cn(column, "flex-1 py-6 outline-none lg:has-[[data-fill-viewport]]:flex lg:has-[[data-fill-viewport]]:min-h-0 lg:has-[[data-fill-viewport]]:flex-col")}
      >
        {children}
      </main>
    </div>
  );
}

/** Up to two letters for the avatar: the first and last word of the name. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return picked.map((w) => Array.from(w)[0] ?? "").join("").toUpperCase();
}

/**
 * Until the address is confirmed nothing is matched to it, so bookings made
 * as a guest stay hidden. Say that plainly rather than letting it look broken.
 */
function VerifyEmailNotice() {
  const t = useTranslations("nav.verify");
  const resend = useMutation({ mutationFn: () => api<void>("/auth/verify-email/resend", { method: "POST" }) });

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 border-b border-border bg-butter px-4 py-2 text-center text-sm">
      <span>{t("text")}</span>
      <button type="button" className={cn(textLink, "disabled:opacity-60")} disabled={resend.isPending} onClick={() => resend.mutate()}>
        {resend.isPending ? t("sending") : resend.isSuccess ? t("sent") : t("resend")}
      </button>
    </div>
  );
}
