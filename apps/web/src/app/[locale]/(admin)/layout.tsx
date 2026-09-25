"use client";

import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "cn";

const TABS = [
  { href: "/admin", label: "overview" },
  { href: "/admin/audit", label: "audit" },
] as const;

/**
 * The site-admin console. Gated here and re-checked on every API call; while
 * acting as another user the API refuses admin routes outright, so an
 * impersonating admin is bounced back to the app.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { status, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("admin");
  const nav = useTranslations("nav");
  const common = useTranslations("common");

  useEffect(() => {
    if (status === "anonymous") router.replace("/login?next=/admin");
    else if (status === "authenticated" && (!user?.isSiteAdmin || user.actorUserId)) router.replace("/dashboard");
  }, [status, user, router]);

  if (status !== "authenticated" || !user?.isSiteAdmin || user.actorUserId) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">{common("loading")}</div>;
  }

  return (
    <>
      <header className="border-b bg-muted/30">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <nav aria-label={nav("primaryLabel")} className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="font-semibold">
              Morrri <span className="text-muted-foreground">{t("brand")}</span>
            </Link>
            {TABS.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "transition-colors",
                  pathname === tab.href ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(tab.label)}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              {t("backToApp")}
            </Link>
            <span className="text-muted-foreground">{user.email}</span>
            <Button variant="outline" size="sm" onClick={() => void logout().then(() => router.replace("/login"))}>
              {nav("signOut")}
            </Button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 p-4 outline-none">{children}</main>
    </>
  );
}
