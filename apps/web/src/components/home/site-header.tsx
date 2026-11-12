"use client";

import { Wordmark } from "@/components/brand/wordmark";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "cn";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";

const SECTIONS = [
  { id: "how", key: "howItWorks" },
  { id: "reminders", key: "remindersNav" },
] as const;

const ITEM =
  "inline-flex h-full items-center rounded-full px-5 text-sm font-semibold whitespace-nowrap transition-[background-color,color,transform] outline-none focus-visible:ring-3 focus-visible:ring-ring";
const PRESS = "hover:scale-[1.04] active:scale-[0.98] motion-reduce:hover:scale-100 motion-reduce:active:scale-100";

/**
 * Sticky landing header (website board): section links in a white capsule,
 * then "Sign in" and "Get started" pills. The capsule follows the section in
 * view, its item turning ink. On a phone the capsule goes and "Get started"
 * goes under `sm`, so the row never wraps; the hero repeats both links.
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
    // Transparent over the hero's gradient until the page moves, then a frosted canvas bar.
    <header
      className={cn(
        "sticky top-0 z-20 py-4 transition-[background-color,box-shadow] md:py-6",
        scrolled ? "bg-canvas/85 shadow-[0_1px_0_var(--border)] backdrop-blur-md" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex w-full max-w-[calc(1200px+5rem)] items-center justify-between gap-4 px-6 md:px-10">
        <Link href="/" className="shrink-0 rounded-sm leading-none text-mona-ink outline-none focus-visible:ring-3 focus-visible:ring-ring">
          <Wordmark className="w-[88px] md:w-[112px]" />
        </Link>
        <div className="flex h-12 items-center gap-2 md:h-14 md:gap-3">
          <nav
            aria-label={t("navLabel")}
            className="hidden h-full gap-1 rounded-full bg-white p-1 shadow-[0_1px_3px_rgb(0_0_0/0.06)] md:inline-flex"
          >
            {SECTIONS.map(({ id, key }) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={() => setActive(id)}
                aria-current={active === id ? "true" : undefined}
                className={cn(
                  ITEM,
                  active === id
                    ? "bg-mona-ink text-white"
                    : "text-mona-ink shadow-[inset_0_0_0_1px_var(--border)] hover:bg-surface-muted",
                )}
              >
                {t(key)}
              </a>
            ))}
          </nav>
          {/* Either way it ends on the dashboard: /login forwards anyone already signed in. */}
          <Link href={signedIn ? "/dashboard" : "/login"} className={cn(ITEM, PRESS, "bg-lisa-soft text-mona-ink")}>
            {signedIn ? t("dashboard") : t("signIn")}
          </Link>
          {signedIn ? null : (
            <Link href="/register" className={cn(ITEM, PRESS, "hidden gap-2 bg-mona-ink pr-4 text-white sm:inline-flex")}>
              {t("hero.cta")}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
