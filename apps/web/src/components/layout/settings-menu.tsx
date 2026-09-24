"use client";

import { Menu } from "@base-ui/react/menu";
import type { MySalon } from "@reserivo/shared";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

/** Salon-scoped sections, in the same order as the settings side nav. */
const SALON_SECTIONS = [
  { href: "", key: "salon" },
  { href: "/team", key: "team" },
  { href: "/services", key: "services" },
  { href: "/hours", key: "hours" },
] as const;

const ITEM_CLASS =
  "block cursor-pointer rounded-md px-2 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-muted data-[highlighted]:text-foreground";

/**
 * Setting a salon up is a once-a-year job, so it lives behind a menu in the
 * header rather than on the screen staff look at all day. It is here rather
 * than inside the salon section for one reason: **"Your salons" has to be
 * reachable with no salon at all**, which is the only way a new account can
 * create its first one.
 */
export function SettingsMenu() {
  const params = useParams<{ salonId?: string }>();
  const t = useTranslations("nav");
  const sections = useTranslations("settings.sections");
  const salons = useQuery({ queryKey: ["salons", "mine"], queryFn: () => api<MySalon[]>("/salons/mine") });
  const list = salons.data ?? [];

  // The salon being viewed, else the first. Deliberately not the remembered
  // one: reading localStorage during render differs between server and client
  // and would trip hydration. The links are a shortcut, not navigation state.
  const current = list.find((s) => s.id === params.salonId) ?? list[0] ?? null;

  return (
    <Menu.Root>
      <Menu.Trigger render={<Button variant="ghost" size="sm" />}>{t("settings")}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-50">
          <Menu.Popup className="min-w-52 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none">
            {current && (
              <>
                {/* Base UI throws if a GroupLabel renders outside a Group. */}
                <Menu.Group>
                  <Menu.GroupLabel className="truncate px-2 py-1.5 text-xs text-muted-foreground">
                    {current.name}
                  </Menu.GroupLabel>
                  {SALON_SECTIONS.map((section) => (
                    <Menu.LinkItem
                      key={section.key}
                      closeOnClick
                      className={ITEM_CLASS}
                      render={<Link href={`/s/${current.id}/settings${section.href}`} />}
                    >
                      {sections(`${section.key}.label`)}
                    </Menu.LinkItem>
                  ))}
                </Menu.Group>
                <div role="separator" className="my-1 h-px bg-border" />
              </>
            )}
            <Menu.LinkItem closeOnClick className={ITEM_CLASS} render={<Link href="/settings" />}>
              {list.length > 0 ? t("menu.yourSalons") : t("menu.setUp")}
            </Menu.LinkItem>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
