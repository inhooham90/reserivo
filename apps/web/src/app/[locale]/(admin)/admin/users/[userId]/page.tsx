"use client";

import type { AdminUserDetail } from "@reserivo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FieldError } from "@/components/field-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useFormat } from "@/lib/use-format";

export default function AdminUserPage() {
  const f = useFormat();
  const t = useTranslations("admin");
  const common = useTranslations("common");
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const { impersonate } = useAuth();
  const [confirming, setConfirming] = useState(false);

  const user = useQuery({ queryKey: ["admin", "users", userId], queryFn: () => api<AdminUserDetail>(`/admin/users/${userId}`) });

  const actAs = useMutation({
    mutationFn: () => impersonate(userId),
    onSuccess: () => router.replace("/dashboard"),
  });

  if (user.isPending) return <p className="text-muted-foreground">{common("loading")}</p>;
  if (user.isError) return <p className="text-destructive">{t("user.notFound")}</p>;
  const u = user.data;

  return (
    <div className="grid gap-4">
      <Link href="/admin" className="text-sm text-muted-foreground underline">
        ← {t("user.back")}
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              {u.name}
              {u.isSiteAdmin && <Badge variant="outline">{t("siteAdmin")}</Badge>}
            </CardTitle>
            <CardDescription>
              {u.email}
              {u.phone ? ` · ${u.phone}` : ""} ·{" "}
              {/* A user belongs to no salon, so the only honest zone is the admin's own. */}
              {t("user.joined", { date: f.inTz(u.createdAt, Intl.DateTimeFormat().resolvedOptions().timeZone, "dateWithYear") })}
            </CardDescription>
          </div>
          {u.canImpersonate && !confirming && (
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setConfirming(true)}>
              {t("user.actAs", { name: u.name.split(" ")[0] })}
            </Button>
          )}
        </CardHeader>
        {(confirming || actAs.isError) && (
          <CardContent className="grid gap-2 border-t pt-4">
            {confirming && (
              <div className="grid gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <p>
                  {t.rich("user.confirm", {
                    product: "Reserivo",
                    name: u.name,
                    b: (chunks) => <span className="font-medium">{chunks}</span>,
                  })}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" disabled={actAs.isPending} onClick={() => actAs.mutate()}>
                    {actAs.isPending ? t("user.switching") : t("user.confirmYes", { name: u.name })}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                    {common("cancel")}
                  </Button>
                </div>
              </div>
            )}
            <FieldError message={actAs.error instanceof ApiError ? actAs.error.message : undefined} />
          </CardContent>
        )}
        {!u.canImpersonate && (
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {u.isSiteAdmin ? t("user.cannotAdmins") : t("user.isYou")}
            </p>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("user.worksAt")}</CardTitle>
          <CardDescription>{u.memberships.length === 0 ? t("user.noMemberships") : t("user.memberships")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {u.memberships.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <Link href={`/admin/salons/${m.salonId}`} className="font-medium underline">
                    {m.salonName}
                  </Link>
                  <span className="text-muted-foreground"> · {t("user.asName", { name: m.displayName })}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant="secondary">{f.roles(m.roles)}</Badge>
                  {m.status !== "ACTIVE" && <Badge variant="outline">{t(`status.${m.status as "INVITED" | "ACTIVE" | "REMOVED"}`)}</Badge>}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("user.booksAt")}</CardTitle>
          <CardDescription>{u.customerOf.length === 0 ? t("user.noClients") : t("user.clientRecords")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {u.customerOf.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/admin/salons/${c.salonId}`} className="underline">
                  {c.salonName}
                </Link>
                <span className="text-muted-foreground">
                  {t("user.appointments", { count: c.appointments })}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
