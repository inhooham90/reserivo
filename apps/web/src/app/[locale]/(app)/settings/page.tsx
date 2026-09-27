"use client";

import type { MySalon } from "@reserivo/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Globe, Link2, Plus, UserRound } from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { CreateSalonCard } from "@/components/salon/create-salon-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useFormat } from "@/lib/use-format";
import { ghostPillSm, outlinePillSm } from "@/lib/v3";

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
          <CardTitle role="heading" aria-level={1}>{t("loadFailed")}</CardTitle>
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
    <div className="grid items-center gap-12 py-4 md:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-[1.3] md:text-4xl md:leading-[1.2]">{t("title")}</h1>
        <p className="mt-2 mb-8 text-base text-body">{t("hint")}</p>
        <ul className="grid gap-3">
          {list.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-6 rounded-lg bg-muted p-6 shadow-[inset_0_0_0_1px_var(--border)]">
              <div className="min-w-0">
                <p className="text-base font-semibold">{s.name}</p>
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-body">
                  <span className="inline-flex items-center gap-1.5">
                    <Link2 aria-hidden className="size-4" />/{s.slug}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Globe aria-hidden className="size-4" />
                    {s.timezone}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <UserRound aria-hidden className="size-4" />
                    {f.roles(s.roles)}
                  </span>
                </p>
              </div>
              <span className="ml-auto flex items-center gap-2">
                <Button variant="outline" className={outlinePillSm} nativeButton={false} render={<Link href={`/s/${s.id}/settings`} />}>
                  {t("settings")}
                </Button>
                <Button variant="outline" className={outlinePillSm} nativeButton={false} render={<Link href={`/s/${s.id}/calendar`} />}>
                  {t("open")}
                  <ArrowRight data-icon="inline-end" aria-hidden />
                </Button>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4">
          {creating ? (
            <CreateSalonCard onCancel={() => setCreating(false)} />
          ) : (
            <Button variant="ghost" className={ghostPillSm} onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              {t("createAnother")}
            </Button>
          )}
        </div>
      </div>
      <div className="hidden justify-items-center gap-3 text-center md:grid">
        <Image src="/images/mona-hairflip.png" alt="" width={620} height={720} className="h-auto w-[200px]" />
        <p className="max-w-[26ch] text-sm text-muted-foreground">{t("aside")}</p>
      </div>
    </div>
  );
}
