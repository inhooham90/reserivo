"use client";

import type { MySalon, Salon } from "@reserivo/shared";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

/** Salon home. Phase 1 fills this in with services, hours and team. */
export default function SalonPage() {
  const { salonId } = useParams<{ salonId: string }>();
  const salon = useQuery({ queryKey: ["salons", salonId], queryFn: () => api<Salon>(`/salons/${salonId}`) });
  const mine = useQuery({ queryKey: ["salons", "mine"], queryFn: () => api<MySalon[]>("/salons/mine") });
  const role = mine.data?.find((s) => s.id === salonId)?.role;

  if (salon.isPending) return <p className="text-muted-foreground">Loading…</p>;
  if (salon.isError) return <p className="text-destructive">You do not have access to this salon.</p>;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{salon.data.name}</CardTitle>
          <CardDescription>
            Booking page: <code>/{salon.data.slug}</code> · {salon.data.timezone}
            {role && <> · You are a {role === "MANAGER" ? "manager" : "designer"} here</>}
          </CardDescription>
        </CardHeader>
      </Card>
      <p className="text-sm text-muted-foreground">
        Services, working hours and team management arrive in Phase 1.
      </p>
    </div>
  );
}
