"use client";

import type { MySalon } from "@reserivo/shared";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { readCurrentSalon } from "@/lib/current-salon";

export default function DashboardPage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}

/**
 * Where signing in lands. Staff go straight to a schedule — that is the screen
 * they live in — and everyone else to their own bookings. `?to=messages` opens
 * the business inbox instead, which is where a business account's header
 * Messages link goes from outside a business. An approved account with no
 * business yet goes to /settings to create one. Nothing is rendered here
 * beyond the moment it takes to decide.
 */
function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const to = useSearchParams().get("to") === "messages" ? "messages" : "calendar";
  const salons = useQuery({ queryKey: ["salons", "mine"], queryFn: () => api<MySalon[]>("/salons/mine") });

  const list = salons.data;
  const canCreate = Boolean(user?.canCreateBusiness);
  useEffect(() => {
    if (!list) return;
    if (list.length === 0) {
      router.replace(canCreate ? "/settings" : "/appointments");
      return;
    }
    // Return to wherever they were last, as long as they still work there.
    const remembered = readCurrentSalon();
    const salon = list.find((s) => s.id === remembered) ?? list[0];
    router.replace(`/s/${salon.id}/${to}`);
  }, [list, router, to, canCreate]);

  if (salons.isError) {
    return (
      <Card className="mx-auto mt-8 max-w-md">
        <CardHeader>
          <CardTitle>Couldn’t load your businesses</CardTitle>
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
