"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "cn";

/** Everything you set up once and rarely touch again. */
const SECTIONS = [
  { href: "", label: "Salon", hint: "Name, time zone, booking rules, reminders" },
  { href: "/team", label: "Team", hint: "Designers, roles, invitations" },
  { href: "/services", label: "Services", hint: "What you offer and what it costs" },
  { href: "/hours", label: "Hours", hint: "Opening hours and each designer's week" },
  { href: "/salons", label: "Your salons", hint: "Switch between them, or start another" },
] as const;

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const { salonId } = useParams<{ salonId: string }>();
  const pathname = usePathname();
  const base = `/s/${salonId}/settings`;

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <nav aria-label="Settings sections" className="grid content-start gap-1">
        {SECTIONS.map((s) => {
          const href = base + s.href;
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
              <span className="text-sm font-medium">{s.label}</span>
              <span className="text-xs text-muted-foreground">{s.hint}</span>
            </Link>
          );
        })}
      </nav>
      <div>{children}</div>
    </div>
  );
}
