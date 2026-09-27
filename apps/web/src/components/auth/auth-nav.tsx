"use client";

import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Link, usePathname } from "@/i18n/navigation";

const ITEMS = [
  { href: "/", key: "home" },
  { href: "/login", key: "signIn" },
  { href: "/register", key: "signUp" },
] as const;

/**
 * The white nav pill in the auth header. The current page's item is marked
 * with aria-current but, as in the design's sign-in screen, stays visually
 * plain. On a phone only that item shows (or "Sign in" on the pages that are
 * neither), so the pill never wraps.
 */
export function AuthNav({ className }: { className?: string }) {
  const t = useTranslations("auth.frame");
  const pathname = usePathname();
  const hasCurrent = ITEMS.some((i) => i.href === pathname);

  return (
    <nav aria-label={t("navLabel")} className={cn("inline-flex h-12 gap-1 rounded-full bg-card p-1", className)}>
      {ITEMS.map(({ href, key }) => {
        const current = href === pathname;
        const keepOnPhone = current || (!hasCurrent && href === "/login");
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "items-center rounded-full px-5 text-sm font-medium whitespace-nowrap text-foreground transition-colors outline-none hover:bg-surface-muted focus-visible:ring-3 focus-visible:ring-ring",
              keepOnPhone ? "inline-flex" : "hidden md:inline-flex",
            )}
          >
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
