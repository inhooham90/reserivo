"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { LEGAL } from "@/lib/legal";

const SECTIONS = [
  { id: "how", key: "howItWorks" },
  { id: "reminders", key: "remindersNav" },
] as const;

const ITEM =
  "inline-flex items-center rounded-full px-5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring";

/**
 * Sticky landing header. The nav pill follows the section in view
 * (DESIGN.md "User journey"): its item turns navy, the selected-pill pair.
 * On a phone only "Sign in" stays, so the pill never wraps.
 */
export function SiteHeader() {
  const t = useTranslations("home");
  // "loading" on the server and on first paint alike, so the label only
  // changes once the session is known and hydration stays consistent.
  const { status } = useAuth();
  const signedIn = status === "authenticated";
  const [active, setActive] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) ratios.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        const [best] = [...ratios.entries()].sort((a, b) => b[1] - a[1]);
        setActive(best && best[1] > 0 ? best[0] : null);
      },
      { threshold: [0, 0.2, 0.4, 0.6], rootMargin: "-80px 0px -35% 0px" },
    );
    for (const { id } of SECTIONS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <header className={cn("sticky top-0 z-20 bg-background py-6 transition-shadow", scrolled && "shadow-[0_1px_0_var(--border)]")}>
      <div className="mx-auto flex w-full max-w-[calc(1200px+5rem)] items-center justify-between gap-4 px-6 md:px-10">
        <Link href="/" className="shrink-0 rounded-sm leading-none outline-none focus-visible:ring-3 focus-visible:ring-ring">
          <Image src="/images/morrri-wordmark.png" alt={LEGAL.product} width={74} height={18} priority />
        </Link>
        <nav
          aria-label={t("navLabel")}
          className="inline-flex h-12 gap-1 rounded-full bg-muted p-1 shadow-[inset_0_0_0_1px_var(--border)]"
        >
          {SECTIONS.map(({ id, key }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={() => setActive(id)}
              aria-current={active === id ? "true" : undefined}
              className={cn(
                ITEM,
                "hidden md:inline-flex",
                active === id ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-surface-muted",
              )}
            >
              {t(key)}
            </a>
          ))}
          {/* Either way it ends on the dashboard: /login forwards anyone already signed in. */}
          <Link href={signedIn ? "/dashboard" : "/login"} className={cn(ITEM, "text-foreground hover:bg-surface-muted")}>
            {signedIn ? t("dashboard") : t("signIn")}
          </Link>
        </nav>
      </div>
    </header>
  );
}
