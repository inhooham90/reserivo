"use client";

import type { MySalon } from "@reserivo/shared";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { CreateSalonCard } from "@/components/salon/create-salon-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { rolesLabel } from "@/lib/format";
import { useSalon } from "@/lib/salon-context";

/** Move between the salons you work in, or start another one. */
export default function YourSalonsPage() {
  const { salon } = useSalon();
  const [creating, setCreating] = useState(false);
  const salons = useQuery({ queryKey: ["salons", "mine"], queryFn: () => api<MySalon[]>("/salons/mine") });

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Your salons</CardTitle>
          <CardDescription>Opening one takes you to its schedule.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {salons.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
          {salons.data?.map((s) => {
            const current = s.id === salon.id;
            return (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
              >
                <span className="grid gap-0.5">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {s.name}
                    {current && <Badge variant="secondary">Currently open</Badge>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    /{s.slug} · {s.timezone} · {rolesLabel(s.roles)}
                  </span>
                </span>
                {current ? (
                  <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/s/${s.id}/calendar`} />}>
                    Go to schedule
                  </Button>
                ) : (
                  <Button size="sm" nativeButton={false} render={<Link href={`/s/${s.id}/calendar`} />}>
                    Open
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {creating ? (
        <CreateSalonCard onCancel={() => setCreating(false)} />
      ) : (
        <Button className="justify-self-start" onClick={() => setCreating(true)}>
          Create another salon
        </Button>
      )}
    </div>
  );
}
