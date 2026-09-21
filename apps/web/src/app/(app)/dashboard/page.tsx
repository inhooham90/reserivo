"use client";

import type { MySalon } from "@reserivo/shared";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { readCurrentSalon } from "@/lib/current-salon";

/**
 * Where signing in lands. Staff go straight to a schedule — that is the screen
 * they live in — and everyone else to their own bookings. Nothing is rendered
 * here beyond the moment it takes to decide.
 */
export default function DashboardPage() {
  const router = useRouter();
  const salons = useQuery({ queryKey: ["salons", "mine"], queryFn: () => api<MySalon[]>("/salons/mine") });

  const list = salons.data;
  useEffect(() => {
    if (!list) return;
    if (list.length === 0) {
      router.replace("/appointments");
      return;
    }
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
        <CardContent>
          <Button onClick={() => void salons.refetch()}>Retry</Button>
          <p className="mt-3 text-sm text-muted-foreground">
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

  return <p className="text-muted-foreground">Opening your schedule…</p>;
}
