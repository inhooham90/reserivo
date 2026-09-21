"use client";

import type { MySalon } from "@reserivo/shared";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CreateSalonCard } from "@/components/salon/create-salon-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { readCurrentSalon } from "@/lib/current-salon";

/**
 * Where signing in lands. Staff go straight to a schedule — that is the screen
 * they live in. Someone with no salon gets the first-run screen instead, since
 * for them the only useful next step is creating one or seeing their own bookings.
 */
export default function DashboardPage() {
  const router = useRouter();
  const salons = useQuery({ queryKey: ["salons", "mine"], queryFn: () => api<MySalon[]>("/salons/mine") });

  const list = salons.data;
  useEffect(() => {
    if (!list || list.length === 0) return;
    // Return to wherever they were last, as long as they still work there.
    const remembered = readCurrentSalon();
    const salon = list.find((s) => s.id === remembered) ?? list[0];
    router.replace(`/s/${salon.id}/calendar`);
  }, [list, router]);

  if (salons.isError) {
    return (
      <Card className="mx-auto mt-8 max-w-md">
        <CardHeader>
          <CardTitle>Couldn’t load your salons</CardTitle>
          <CardDescription>Check your connection and try again.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button className="justify-self-start" onClick={() => void salons.refetch()}>
            Retry
          </Button>
          <p className="text-sm text-muted-foreground">
            Or go to{" "}
            <Link href="/appointments" className="underline">
              your appointments
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  if (list && list.length === 0) {
    return (
      <div className="mx-auto grid max-w-xl gap-4">
        <div>
          <h1 className="text-2xl">Welcome to Reserivo</h1>
          <p className="text-sm text-muted-foreground">
            Set up your salon and you’ll get a booking page to share with clients. It takes a minute.
          </p>
        </div>
        <CreateSalonCard title="Create your salon" description="You become its manager, and can invite your team next." />
        <p className="text-sm text-muted-foreground">
          Here as a client instead?{" "}
          <Link href="/appointments" className="underline">
            See your appointments
          </Link>
          .
        </p>
      </div>
    );
  }

  return <p className="text-muted-foreground">Opening your schedule…</p>;
}
