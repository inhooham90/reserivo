"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Clock, LayoutGrid, Scissors, Search, Store, UsersRound, X, type LucideIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useSalon } from "@/lib/salon-context";
import { pillInputSm } from "@/lib/v3";
import { cn } from "cn";

type SectionKey = "salon" | "team" | "services" | "hours";

/** The salon's own sections, in rail order. "Your salons" is an account page and sits apart. */
const SECTIONS: { key: SectionKey; href: string; icon: LucideIcon }[] = [
  { key: "salon", href: "", icon: Store },
  { key: "team", href: "/team", icon: UsersRound },
  { key: "services", href: "/services", icon: Scissors },
  { key: "hours", href: "/hours", icon: Clock },
];

interface SettingsDialogContextValue {
  close: () => void;
  /** Where a section renders its pinned Save bar, below the scrolling body. */
  footer: HTMLElement | null;
}

const SettingsDialogContext = createContext<SettingsDialogContextValue | null>(null);

export function useSettingsDialog(): SettingsDialogContextValue {
  const ctx = useContext(SettingsDialogContext);
  if (!ctx) throw new Error("useSettingsDialog must be used inside SettingsDialog");
  return ctx;
}

const railItem =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium whitespace-nowrap text-foreground transition-shadow outline-none hover:shadow-[inset_0_0_0_1px_var(--border)] focus-visible:ring-3 focus-visible:ring-ring";

/**
 * Salon settings as a dialog over whatever the manager was looking at
 * (DESIGN.md "App surfaces": left rail with search, the active item a
 * lavender block, white rows on the right).
 *
 * Every section keeps its own URL (/s/{id}/settings/hours), so links and
 * reloads still work. Opened from inside the salon, the route is intercepted
 * (`@modal/(.)settings`) and the page underneath stays mounted; closing goes
 * back to it. Loaded directly, the same dialog renders over the salon header
 * and closing goes to the schedule. `intercepted` says which case this is.
 * Moving between sections replaces the history entry, so one Back closes.
 */
export function SettingsDialog({ intercepted = false, children }: { intercepted?: boolean; children: ReactNode }) {
  const { salonId } = useParams<{ salonId: string }>();
  const { salon } = useSalon();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("settings");
  const [query, setQuery] = useState("");
  const [footer, setFooter] = useState<HTMLElement | null>(null);

  const base = `/s/${salonId}/settings`;
  const active = SECTIONS.find((s) => (s.href ? pathname.startsWith(base + s.href) : pathname === base)) ?? SECTIONS[0];

  const close = useCallback(() => {
    if (intercepted) router.back();
    else router.push(`/s/${salonId}/calendar`);
  }, [intercepted, router, salonId]);

  // Filters on what the rail shows in the current language: the label and its hint.
  const q = query.trim().toLowerCase();
  const matches = (key: string) =>
    !q || `${t(`sections.${key}.label`)} ${t(`sections.${key}.hint`)}`.toLowerCase().includes(q);
  const visible = SECTIONS.filter((s) => matches(s.key));
  const showSalons = matches("yourSalons");

  return (
    <Dialog.Root open onOpenChange={(open) => !open && close()}>
      <Dialog.Portal>
        {/* Portalled out of the app shell, so the v3 scope is set here again. */}
        <Dialog.Backdrop className="theme-morrri fixed inset-0 z-50 bg-scrim transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Popup className="theme-morrri fixed inset-0 z-50 flex flex-col overflow-hidden bg-card text-foreground outline-none transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none md:inset-auto md:top-1/2 md:left-1/2 md:grid md:h-[min(720px,calc(100dvh-3rem))] md:w-[min(1040px,calc(100vw-3rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:grid-cols-[260px_minmax(0,1fr)] md:rounded-2xl">
          <SettingsDialogContext.Provider value={{ close, footer }}>
            <aside className="flex min-w-0 shrink-0 gap-6 overflow-x-auto border-b border-border bg-muted p-3 md:flex-col md:overflow-y-auto md:border-r md:border-b-0 md:px-4 md:py-6">
              <div className="relative hidden md:block">
                <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <label htmlFor="settings-search" className="sr-only">
                  {t("dialog.search")}
                </label>
                <input
                  id="settings-search"
                  type="search"
                  autoComplete="off"
                  placeholder={t("dialog.search")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={cn(pillInputSm, "w-full border border-input pl-10 text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-foreground")}
                />
              </div>

              <nav aria-label={t("navLabel")} className="flex gap-1 md:grid md:gap-6">
                {visible.length > 0 && (
                  <div className="md:grid md:gap-1">
                    <p className="mb-1 hidden truncate px-3 text-xs font-medium text-muted-foreground md:block">{salon.name}</p>
                    <ul className="flex gap-1 md:grid md:gap-0.5">
                      {visible.map(({ key, href, icon: Icon }) => (
                        <li key={key}>
                          <Link
                            href={base + href}
                            replace
                            aria-current={active.key === key ? "page" : undefined}
                            className={cn(railItem, active.key === key && "bg-lavender")}
                          >
                            <Icon aria-hidden className="size-[18px] shrink-0" />
                            {t(`sections.${key}.label`)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {showSalons && (
                  <div className="md:grid md:gap-1">
                    <p className="mb-1 hidden px-3 text-xs font-medium text-muted-foreground md:block">{t("dialog.account")}</p>
                    {/* An account page, not a salon one: it opens for someone with no salon at all. */}
                    <Link href="/settings" className={railItem}>
                      <LayoutGrid aria-hidden className="size-[18px] shrink-0" />
                      {t("sections.yourSalons.label")}
                    </Link>
                  </div>
                )}
                {visible.length === 0 && !showSalons && (
                  <p className="px-3 text-sm text-muted-foreground">{t("dialog.noMatch")}</p>
                )}
              </nav>
            </aside>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="flex items-start gap-4 px-4 pt-5 pb-4 md:px-8 md:pt-6">
                <div className="min-w-0">
                  <Dialog.Title className="text-[28px] leading-[1.3]">{t(`sections.${active.key}.label`)}</Dialog.Title>
                  <Dialog.Description className="mt-1 text-sm text-body">{t(`sections.${active.key}.hint`)}</Dialog.Description>
                </div>
                <Dialog.Close
                  aria-label={t("dialog.close")}
                  className="ml-auto grid size-10 shrink-0 place-items-center rounded-full outline-none transition-colors hover:bg-surface-muted focus-visible:ring-3 focus-visible:ring-ring"
                >
                  <X aria-hidden className="size-5" />
                </Dialog.Close>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-8 md:px-8">{children}</div>
              <div ref={setFooter} className="empty:hidden" />
            </div>
          </SettingsDialogContext.Provider>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
