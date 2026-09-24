"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "cn";

/** Everything you set up once and rarely touch again. */
const SECTIONS = [
  { href: "", key: "salon" },
  { href: "/team", key: "team" },
  { href: "/services", key: "services" },
  { href: "/hours", key: "hours" },
  // Absolute: switching salons cannot be scoped to the one you are leaving,
  // and the page has to open with no salon at all.
  { href: "/settings", key: "yourSalons", absolute: true },
] as const;

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const { salonId } = useParams<{ salonId: string }>();
  const pathname = usePathname();
  const t = useTranslations("settings");
  const base = `/s/${salonId}/settings`;

  return (
    // The shell is full width inside a salon for the schedule's sake; forms
    // stay in a column so their fields do not stretch across a wide monitor.
    <div className="grid w-full max-w-6xl gap-6 md:grid-cols-[220px_1fr]">
      <nav aria-label={t("navLabel")} className="grid content-start gap-1">
        {SECTIONS.map((s) => {
          const href = "absolute" in s ? s.href : base + s.href;
          // The index section would otherwise match every sibling.
          const active = s.href === "" ? pathname === base : pathname.startsWith(href);
          return (
            <Link
              key={s.href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "grid gap-0.5 rounded-lg px-3 py-2 transition-colors",
                active ? "bg-muted" : "hover:bg-accent",
              )}
            >
              <span className="text-sm font-medium">{t(`sections.${s.key}.label`)}</span>
              <span className="text-xs text-muted-foreground">{t(`sections.${s.key}.hint`)}</span>
            </Link>
          );
        })}
      </nav>
      <div>{children}</div>
    </div>
  );
}
