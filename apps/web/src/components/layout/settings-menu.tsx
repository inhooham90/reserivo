"use client";

import { Menu } from "@base-ui/react/menu";
import type { MySalon } from "@reserivo/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

/** Salon-scoped sections, in the same order as the settings side nav. */
const SALON_SECTIONS = [
  { href: "", label: "Salon" },
  { href: "/team", label: "Team" },
  { href: "/services", label: "Services" },
  { href: "/hours", label: "Hours" },
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
  const salons = useQuery({ queryKey: ["salons", "mine"], queryFn: () => api<MySalon[]>("/salons/mine") });
  const list = salons.data ?? [];

  // The salon being viewed, else the first. Deliberately not the remembered
  // one: reading localStorage during render differs between server and client
  // and would trip hydration. The links are a shortcut, not navigation state.
  const current = list.find((s) => s.id === params.salonId) ?? list[0] ?? null;

  return (
    <Menu.Root>
      <Menu.Trigger render={<Button variant="ghost" size="sm" />}>Settings</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-50">
          <Menu.Popup className="min-w-52 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none">
            {current && (
              <>
                <Menu.GroupLabel className="truncate px-2 py-1.5 text-xs text-muted-foreground">
                  {current.name}
                </Menu.GroupLabel>
                {SALON_SECTIONS.map((section) => (
                  <Menu.LinkItem
                    key={section.label}
                    closeOnClick
                    className={ITEM_CLASS}
                    render={<Link href={`/s/${current.id}/settings${section.href}`} />}
                  >
                    {section.label}
                  </Menu.LinkItem>
                ))}
                <div role="separator" className="my-1 h-px bg-border" />
              </>
            )}
            <Menu.LinkItem closeOnClick className={ITEM_CLASS} render={<Link href="/settings" />}>
              {list.length > 0 ? "Your salons" : "Set up a salon"}
            </Menu.LinkItem>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
