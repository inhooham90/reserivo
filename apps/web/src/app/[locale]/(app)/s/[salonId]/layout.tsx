"use client";

import type { Member, MySalon, Salon } from "@reserivo/shared";
import { useQuery } from "@tanstack/react-query";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { writeCurrentSalon } from "@/lib/current-salon";
import { SalonContext, salonKeys } from "@/lib/salon-context";
import { cn } from "cn";

/** Day-to-day work first; anything you set up once lives under Settings. */
const TABS = [
  { href: "/calendar", label: "schedule" },
  { href: "/customers", label: "customers" },
  { href: "/messages", label: "messages" },
  { href: "/settings", label: "settings" },
] as const;

export default function SalonLayout({ children }: { children: ReactNode }) {
  const { salonId } = useParams<{ salonId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const t = useTranslations("nav.salon");
  const common = useTranslations("common");

  const salon = useQuery({ queryKey: salonKeys.salon(salonId), queryFn: () => api<Salon>(`/salons/${salonId}`) });
  const members = useQuery({
    queryKey: salonKeys.members(salonId),
    queryFn: () => api<Member[]>(`/salons/${salonId}/members`),
  });
  const mine = useQuery({ queryKey: ["salons", "mine"], queryFn: () => api<MySalon[]>("/salons/mine") });

  // Remember where they were, so the next sign-in opens this schedule.
  const loaded = salon.isSuccess;
  useEffect(() => {
    if (loaded) writeCurrentSalon(salonId);
  }, [loaded, salonId]);

  if (salon.isPending || members.isPending) return <p className="text-muted-foreground">{common("loading")}</p>;
  if (salon.isError || members.isError) {
    return <p className="text-destructive">{t("noAccess")}</p>;
  }

  const me = members.data.find((m) => m.userId === user?.id) ?? null;
  const isManager = me ? me.roles.includes("MANAGER") : Boolean(user?.isSiteAdmin);
  const base = `/s/${salonId}`;
  const others = (mine.data ?? []).filter((s) => s.id !== salonId);

  return (
    <SalonContext.Provider value={{ salon: salon.data, members: members.data, me, isManager }}>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl">{salon.data.name}</h1>
            <p className="text-sm text-muted-foreground">
              {t.rich("bookingPage", {
                slug: salon.data.slug,
                timezone: salon.data.timezone,
                link: (chunks) => (
                  <Link href={`/${salon.data.slug}`} className="underline" target="_blank">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Only worth showing to someone who actually has somewhere to switch to. */}
            {others.length > 0 && (
              <select
                aria-label={t("switch")}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={salonId}
                onChange={(e) => router.push(`/s/${e.target.value}/calendar`)}
              >
                {(mine.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            <nav aria-label={t("tabsLabel")} className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
              {TABS.map((tab) => {
                const href = base + tab.href;
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={tab.href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-md px-3 py-1.5 transition-colors",
                      active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t(tab.label)}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
        {children}
      </div>
    </SalonContext.Provider>
  );
}
