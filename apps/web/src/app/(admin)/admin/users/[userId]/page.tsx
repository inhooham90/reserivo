"use client";

import type { AdminUserDetail } from "@reserivo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { FieldError } from "@/components/field-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { rolesLabel } from "@/lib/format";

export default function AdminUserPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const { impersonate } = useAuth();
  const [confirming, setConfirming] = useState(false);

  const user = useQuery({ queryKey: ["admin", "users", userId], queryFn: () => api<AdminUserDetail>(`/admin/users/${userId}`) });

  const actAs = useMutation({
    mutationFn: () => impersonate(userId),
    onSuccess: () => router.replace("/dashboard"),
  });

  if (user.isPending) return <p className="text-muted-foreground">Loading…</p>;
  if (user.isError) return <p className="text-destructive">No such user.</p>;
  const u = user.data;

  return (
    <div className="grid gap-4">
      <Link href="/admin" className="text-sm text-muted-foreground underline">
        ← All users
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              {u.name}
              {u.isSiteAdmin && <Badge variant="outline">Site admin</Badge>}
            </CardTitle>
            <CardDescription>
              {u.email}
              {u.phone ? ` · ${u.phone}` : ""} · joined {new Date(u.createdAt).toLocaleDateString()}
            </CardDescription>
          </div>
          {u.canImpersonate && !confirming && (
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setConfirming(true)}>
              Act as {u.name.split(" ")[0]}
            </Button>
          )}
        </CardHeader>
        {(confirming || actAs.isError) && (
          <CardContent className="grid gap-2 border-t pt-4">
            {confirming && (
              <div className="grid gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <p>
                  You will use Reserivo as <span className="font-medium">{u.name}</span> and see exactly what they see. Everything
                  you do is written to the audit log under your own account. Your session stays underneath — press Stop in the red
                  banner to come back.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" disabled={actAs.isPending} onClick={() => actAs.mutate()}>
                    {actAs.isPending ? "Switching…" : `Yes, act as ${u.name}`}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                    Cancel
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
              {u.isSiteAdmin ? "Site admins cannot act as one another." : "This is you."}
            </p>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Works at</CardTitle>
          <CardDescription>{u.memberships.length === 0 ? "Not a member of any salon." : "Salon memberships"}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {u.memberships.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <Link href={`/admin/salons/${m.salonId}`} className="font-medium underline">
                    {m.salonName}
                  </Link>
                  <span className="text-muted-foreground"> · as {m.displayName}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant="secondary">{rolesLabel(m.roles)}</Badge>
                  {m.status !== "ACTIVE" && <Badge variant="outline">{m.status.toLowerCase()}</Badge>}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Books at</CardTitle>
          <CardDescription>{u.customerOf.length === 0 ? "No client records." : "Salons holding a client record"}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {u.customerOf.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/admin/salons/${c.salonId}`} className="underline">
                  {c.salonName}
                </Link>
                <span className="text-muted-foreground">
                  {c.appointments} appointment{c.appointments === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
