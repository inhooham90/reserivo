"use client";

import type { MySalon } from "@reserivo/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { CreateSalonCard } from "@/components/salon/create-salon-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useFormat } from "@/lib/use-format";

/**
 * Move between the salons you work in, or start one.
 *
 * Deliberately **not** under `/s/{salonId}`: everything there needs a salon to
 * scope to, and this is the one page someone with no salon must be able to
 * reach. It is how a new account creates its first business.
 */
export default function YourSalonsPage() {
  const f = useFormat();
  const t = useTranslations("settings.yourSalons");
  const common = useTranslations("common");
  const [creating, setCreating] = useState(false);
  const salons = useQuery({ queryKey: ["salons", "mine"], queryFn: () => api<MySalon[]>("/salons/mine") });

  if (salons.isPending) return <p className="text-muted-foreground">{common("loading")}</p>;

  if (salons.isError) {
    return (
      <Card className="mx-auto mt-8 max-w-md">
        <CardHeader>
          <CardTitle>{t("loadFailed")}</CardTitle>
          <CardDescription>{t("checkConnection")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void salons.refetch()}>{t("retry")}</Button>
        </CardContent>
      </Card>
    );
  }

  const list = salons.data ?? [];

  // Nothing to switch between, so skip straight to the form rather than making
  // someone find a button to reveal it.
  if (list.length === 0) {
    return (
      <div className="mx-auto grid max-w-lg gap-4">
        <CreateSalonCard
          title={t("setUpTitle")}
          description={t("setUpHint")}
        />
        <p className="text-sm text-muted-foreground">
          {t.rich("justBooking", {
            link: (chunks) => (
              <Link href="/appointments" className="underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("hint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {list.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground">
                  /{s.slug} · {s.timezone} · {f.roles(s.roles)}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/s/${s.id}/settings`} />}>
                  {t("settings")}
                </Button>
                <Button size="sm" nativeButton={false} render={<Link href={`/s/${s.id}/calendar`} />}>
                  {t("open")}
                </Button>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {creating ? (
        <CreateSalonCard onCancel={() => setCreating(false)} />
      ) : (
        <Button className="justify-self-start" onClick={() => setCreating(true)}>
          {t("createAnother")}
        </Button>
      )}
    </div>
  );
}
