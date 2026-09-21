"use client";

import type { Service } from "@reserivo/shared";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { salonKeys, useSalon } from "@/lib/salon-context";

/** Salon home: a quick read on setup progress. Bookings land here in Phase 2. */
export default function SalonOverviewPage() {
  const { salon, members, me, isManager } = useSalon();
  const services = useQuery({
    queryKey: salonKeys.services(salon.id),
    queryFn: () => api<Service[]>(`/salons/${salon.id}/services`),
  });

  const bookable = members.filter((m) => m.acceptsBookings).length;
  const activeServices = services.data?.filter((s) => s.active).length ?? 0;
  const base = `/s/${salon.id}`;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Link href={`${base}/team`}>
        <Card className="h-full transition-colors hover:bg-accent">
          <CardHeader>
            <CardTitle>{members.length} on the team</CardTitle>
            <CardDescription>
              {bookable} bookable · {isManager ? "Invite designers and manage roles" : "See who you work with"}
            </CardDescription>
          </CardHeader>
        </Card>
      </Link>
      <Link href={`${base}/services`}>
        <Card className="h-full transition-colors hover:bg-accent">
          <CardHeader>
            <CardTitle>{activeServices} active services</CardTitle>
            <CardDescription>{me ? "Set what you offer, prices and durations" : "The salon menu"}</CardDescription>
          </CardHeader>
        </Card>
      </Link>
      <Link href={`${base}/hours`}>
        <Card className="h-full transition-colors hover:bg-accent">
          <CardHeader>
            <CardTitle>Working hours</CardTitle>
            <CardDescription>Weekly schedule and days off, in {salon.timezone}</CardDescription>
          </CardHeader>
        </Card>
      </Link>
    </div>
  );
}
