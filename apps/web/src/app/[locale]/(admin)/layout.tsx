"use client";

import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "cn";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/audit", label: "Audit log" },
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

  useEffect(() => {
    if (status === "anonymous") router.replace("/login?next=/admin");
    else if (status === "authenticated" && (!user?.isSiteAdmin || user.actorUserId)) router.replace("/dashboard");
  }, [status, user, router]);

  if (status !== "authenticated" || !user?.isSiteAdmin || user.actorUserId) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <>
      <header className="border-b bg-muted/30">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="font-semibold">
              Reserivo <span className="text-muted-foreground">admin</span>
            </Link>
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "transition-colors",
                  pathname === t.href ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              Back to app
            </Link>
            <span className="text-muted-foreground">{user.email}</span>
            <Button variant="outline" size="sm" onClick={() => void logout().then(() => router.replace("/login"))}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4">{children}</main>
    </>
  );
}
