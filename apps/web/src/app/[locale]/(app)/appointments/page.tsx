"use client";

import type { CustomerAppointment, Thread } from "@reserivo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { FieldError } from "@/components/field-error";
import { RateDesigner } from "@/components/rating/rate-designer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { useFormat } from "@/lib/use-format";

/** The customer's own bookings across every salon, with self-service cancel. */
export default function MyAppointmentsPage() {
  const f = useFormat();
  const queryClient = useQueryClient();
  const router = useRouter();
  const message = useMutation({
    mutationFn: (a: CustomerAppointment) =>
      api<Thread>("/me/conversations", { method: "POST", json: { salonId: a.salon.id, designerId: a.designerId } }),
    onSuccess: (t) => router.push(`/messages/${t.conversationId}`),
  });
  const appts = useQuery({ queryKey: ["me", "appointments"], queryFn: () => api<CustomerAppointment[]>("/me/appointments") });
  const cancel = useMutation({
    mutationFn: (id: string) => api<CustomerAppointment>(`/me/appointments/${id}/cancel`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me", "appointments"] }),
  });

  // Captured once per mount: "upcoming" must not flip mid-render as the clock ticks.
  const [now] = useState(() => Date.now());
  const upcoming = appts.data?.filter((a) => new Date(a.startAt).getTime() >= now && a.status !== "CANCELLED") ?? [];
  const past = appts.data?.filter((a) => !upcoming.includes(a)) ?? [];

  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <h1 className="text-xl">Upcoming</h1>
        {appts.isPending && <p className="text-muted-foreground">Loading…</p>}
        {appts.data && upcoming.length === 0 && (
          <p className="text-muted-foreground">
            Nothing booked. Open a salon’s booking link to make an appointment, or{" "}
            <Link href="/settings" className="underline">
              set up your own salon
            </Link>
            .
          </p>
        )}
        {upcoming.map((a) => (
          <Card key={a.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>{f.inTz(a.startAt, a.salon.timezone, "dateTimeLong")}</CardTitle>
                <CardDescription>
                  {a.serviceName} with {a.designerName} at{" "}
                  <Link href={`/${a.salon.slug}`} className="underline">
                    {a.salon.name}
                  </Link>{" "}
                  · {f.cents(a.priceCents)}
                </CardDescription>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <Button size="sm" variant="secondary" disabled={message.isPending} onClick={() => message.mutate(a)}>
                  {/* Full name on purpose: a given name cannot be split off reliably — Korean and
                      Chinese names are not space-separated, so .split(" ")[0] returns the whole name. */}
                  Message {a.designerName}
                </Button>
                {a.cancellableUntil ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={cancel.isPending}
                    onClick={() => {
                      if (confirm("Cancel this appointment?")) cancel.mutate(a.id);
                    }}
                  >
                    Cancel
                  </Button>
                ) : (
                  <span className="self-center text-xs text-muted-foreground">Contact the salon to change</span>
                )}
              </div>
            </CardHeader>
            {cancel.isError && cancel.variables === a.id && (
              <CardContent>
                <FieldError message={cancel.error instanceof ApiError ? cancel.error.message : "Could not cancel"} />
              </CardContent>
            )}
          </Card>
        ))}
      </section>

      {past.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-lg text-muted-foreground">Past</h2>
          {past.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm">
              <span>
                <span className="font-medium">{f.inTz(a.startAt, a.salon.timezone, "dateTimeWithYear")}</span>{" "}
                <span className="text-muted-foreground">
                  · {a.serviceName} with {a.designerName} · {a.salon.name}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Badge variant="outline">{f.status(a.status)}</Badge>
                {/* Only a finished visit can be rated, and the API checks the same
                    thing — a cancelled or missed appointment is no basis for a score. */}
                {a.status === "COMPLETED" && (
                  <RateDesigner designerId={a.designerId} designerName={a.designerName} />
                )}
                <Button size="xs" variant="ghost" disabled={message.isPending} onClick={() => message.mutate(a)}>
                  Message
                </Button>
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
