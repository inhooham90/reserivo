"use client";

import type { AdminSalon, AdminUser, PlatformStats } from "@reserivo/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

/** Console home: how the platform is doing, and a way to find anyone in it. */
export default function AdminOverviewPage() {
  const t = useTranslations("admin");
  const common = useTranslations("common");
  const [q, setQ] = useState("");
  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: () => api<PlatformStats>("/admin/stats") });
  const users = useQuery({
    queryKey: ["admin", "users", q],
    queryFn: () => api<AdminUser[]>(`/admin/users?q=${encodeURIComponent(q)}&limit=25`),
  });
  const salons = useQuery({
    queryKey: ["admin", "salons", q],
    queryFn: () => api<AdminSalon[]>(`/admin/salons?q=${encodeURIComponent(q)}&limit=25`),
  });

  return (
    <div className="grid gap-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label={t("stats.users")} value={stats.data?.users} />
        <Stat label={t("stats.salons")} value={stats.data?.salons} />
        <Stat label={t("stats.designers")} value={stats.data?.bookableMembers} />
        <Stat label={t("stats.customers")} value={stats.data?.customers} />
        <Stat label={t("stats.appointments")} value={stats.data?.appointments} />
        <Stat label={t("stats.upcoming")} value={stats.data?.upcomingAppointments} />
        <Stat label={t("stats.booked7d")} value={stats.data?.bookedLast7Days} />
      </section>

      <Input placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("people")}</CardTitle>
            <CardDescription>{q ? t("matchingUsers") : t("newestSignups")}</CardDescription>
          </CardHeader>
          <CardContent>
            {users.isPending && <p className="text-sm text-muted-foreground">{common("loading")}</p>}
            {users.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("noUsers")}</p>}
            <ul className="divide-y">
              {users.data?.map((u) => (
                <li key={u.id}>
                  <Link href={`/admin/users/${u.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent">
                    <span className="grid gap-0.5">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {u.name}
                        {u.isSiteAdmin && <Badge variant="outline">{t("siteAdmin")}</Badge>}
                      </span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t("salonCount", { count: u.salonCount })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("salons")}</CardTitle>
            <CardDescription>{q ? t("matchingSalons") : t("newestSalons")}</CardDescription>
          </CardHeader>
          <CardContent>
            {salons.isPending && <p className="text-sm text-muted-foreground">{common("loading")}</p>}
            {salons.data?.length === 0 && <p className="text-sm text-muted-foreground">{t("noSalons")}</p>}
            <ul className="divide-y">
              {salons.data?.map((s) => (
                <li key={s.id}>
                  <Link href={`/admin/salons/${s.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent">
                    <span className="grid gap-0.5">
                      <span className="text-sm font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground">
                        /{s.slug} · {s.timezone}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t("salonCounts", { staff: s.memberCount, appts: s.appointmentCount })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl tabular-nums">{value ?? "—"}</div>
    </div>
  );
}
