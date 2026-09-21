"use client";

import type { AdminSalonDetail } from "@reserivo/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useFormat } from "@/lib/use-format";

export default function AdminSalonPage() {
  const f = useFormat();
  const { salonId } = useParams<{ salonId: string }>();
  const salon = useQuery({
    queryKey: ["admin", "salons", salonId],
    queryFn: () => api<AdminSalonDetail>(`/admin/salons/${salonId}`),
  });

  if (salon.isPending) return <p className="text-muted-foreground">Loading…</p>;
  if (salon.isError) return <p className="text-destructive">No such salon.</p>;
  const s = salon.data;

  return (
    <div className="grid gap-4">
      <Link href="/admin" className="text-sm text-muted-foreground underline">
        ← All salons
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>{s.name}</CardTitle>
            <CardDescription>
              {/* A platform event, not a salon-local one, so it is shown in the admin's own zone — not s.timezone. */}
              /{s.slug} · {s.timezone} · created{" "}
              {f.inTz(s.createdAt, Intl.DateTimeFormat().resolvedOptions().timeZone, "dateWithYear")}
            </CardDescription>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/${s.slug}`} target="_blank" />}>
              Booking page
            </Button>
            {/* Site admins pass the tenancy guard for any salon. */}
            <Button size="sm" nativeButton={false} render={<Link href={`/s/${s.id}`} />}>
              Open workspace
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            <Stat label="Staff" value={s.memberCount} />
            <Stat label="Services" value={s.serviceCount} />
            <Stat label="Customers" value={s.customerCount} />
            <Stat label="Appointments" value={s.appointmentCount} />
            <Stat label="Upcoming" value={s.upcomingAppointments} />
          </dl>
          <p className="text-xs text-muted-foreground">
            Slots every {s.policies.slotIntervalMin} min · {s.policies.leadTimeMin} min notice · books{" "}
            {s.policies.maxAdvanceDays} days ahead · free cancellation until {s.policies.cancelWindowHours}h before.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>Roles and access</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {s.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                <span className="grid gap-0.5">
                  <Link href={`/admin/users/${m.userId}`} className="font-medium underline">
                    {m.displayName}
                  </Link>
                  <span className="text-xs text-muted-foreground">{m.email}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant="secondary">{f.roles(m.roles)}</Badge>
                  {m.status !== "ACTIVE" && <Badge variant="outline">{m.status.toLowerCase()}</Badge>}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Link href={`/admin/audit?salonId=${s.id}`} className="text-sm underline">
        See this salon’s audit log →
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg tabular-nums">{value}</dd>
    </div>
  );
}
