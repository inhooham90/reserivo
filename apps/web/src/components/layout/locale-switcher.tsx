"use client";

import { Menu } from "@base-ui/react/menu";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/routing";

const ITEM_CLASS =
  "flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-muted data-[highlighted]:text-foreground";

/**
 * Switches language while staying on the same page.
 *
 * `usePathname` here is the locale-aware one, so it gives the path *without*
 * the prefix — handing it back to `router.replace` with a different locale is
 * what keeps a customer on the salon they were looking at instead of dumping
 * them on the home page.
 *
 * Each language is written in itself and never translated: someone who cannot
 * read the current language still has to find their own in the list.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("common");
  // Switching re-renders on the server, so the trigger stays disabled for the
  // moment that takes rather than looking like the click did nothing.
  const [pending, startTransition] = useTransition();

  return (
    <Menu.Root>
      <Menu.Trigger
        render={<Button variant="ghost" size="sm" className={className} disabled={pending} aria-label={t("language")} />}
      >
        {LOCALE_NAMES[locale]}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-50">
          <Menu.Popup className="min-w-40 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none">
            <Menu.RadioGroup
              value={locale}
              onValueChange={(next) => {
                startTransition(() => {
                  router.replace(pathname, { locale: next as Locale });
                });
              }}
            >
              {LOCALES.map((option) => (
                <Menu.RadioItem key={option} value={option} closeOnClick className={ITEM_CLASS}>
                  {LOCALE_NAMES[option]}
                  <Menu.RadioItemIndicator aria-hidden className="text-primary">
                    ✓
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
