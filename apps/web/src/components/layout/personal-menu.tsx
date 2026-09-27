"use client";

import { Menu } from "@base-ui/react/menu";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

const ITEM_CLASS =
  "flex cursor-pointer items-center rounded-md px-2 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-muted data-[highlighted]:text-foreground";

/**
 * A business account's own bookings and inbox, kept out of its way. The header
 * of a business account points at the business (Schedule, Messages); what the
 * person booked or wrote as a client elsewhere lives here instead.
 *
 * The popup renders in a portal outside .theme-morrri, so it carries the class itself.
 */
export function PersonalMenu({ className }: { className?: string }) {
  const t = useTranslations("nav");
  return (
    <Menu.Root>
      <Menu.Trigger render={<Button variant="ghost" size="sm" className={className} />}>
        {t("personal")}
        <ChevronDown aria-hidden className="size-3.5" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-50">
          <Menu.Popup className="theme-morrri min-w-48 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none">
            <Menu.LinkItem render={<Link href="/appointments" />} className={ITEM_CLASS}>
              {t("myAppointments")}
            </Menu.LinkItem>
            <Menu.LinkItem render={<Link href="/messages" />} className={ITEM_CLASS}>
              {t("myMessages")}
            </Menu.LinkItem>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
