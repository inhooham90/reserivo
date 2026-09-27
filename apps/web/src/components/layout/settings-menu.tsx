"use client";

import type { MySalon } from "@reserivo/shared";
import { useQuery } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";

/**
 * Setting a salon up is a once-a-year job, so it lives behind one button in
 * the header rather than on the screen staff look at all day. The button opens
 * the settings dialog for the salon being viewed; the dialog's rail has every
 * section, and "Your salons" for switching or starting one.
 *
 * With no salon at all it goes to /settings instead, which is the only way a
 * new account can create its first one.
 */
export function SettingsMenu({ className }: { className?: string }) {
  const params = useParams<{ salonId?: string }>();
  const t = useTranslations("nav");
  const salons = useQuery({ queryKey: ["salons", "mine"], queryFn: () => api<MySalon[]>("/salons/mine") });
  const list = salons.data ?? [];

  // The salon being viewed, else the first. Deliberately not the remembered
  // one: reading localStorage during render differs between server and client
  // and would trip hydration.
  const current = list.find((s) => s.id === params.salonId) ?? list[0] ?? null;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      nativeButton={false}
      render={<Link href={current ? `/s/${current.id}/settings` : "/settings"} />}
    >
      <Settings aria-hidden />
      {t("settings")}
    </Button>
  );
}
