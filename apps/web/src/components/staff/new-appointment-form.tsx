"use client";

import {
  hhmmToMinutes,
  localToUtc,
  minutesToHHMM,
  type AvailabilityResponse,
  type Customer,
  type Service,
  type StaffAppointment,
  type StaffBookAppointmentInput,
} from "@reserivo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { formatCents, formatDuration, minutesLabel } from "@/lib/format";
import { salonKeys, useSalon } from "@/lib/salon-context";
import { cn } from "cn";

/**
 * Designer, service, date and start time are owned by the calendar so clicking
 * the grid can drive them — and so the grid can size its preview and refuse
 * placements that would overlap.
 */
export interface AppointmentDraft {
  designerId: string;
  /** Preference, not a guarantee: resolve it with resolveServiceId(). */
  serviceId: string | null;
  date: string;
  /** Local minutes from midnight, or null until a time is chosen. */
  minutes: number | null;
}

/**
 * The service actually in effect: the preferred one when it is still active
 * and belongs to this designer, otherwise their first active service.
 * Derived on every render — no state to keep in sync.
 */
export function resolveServiceId(services: Service[], designerId: string, preferred: string | null): string | null {
  const mine = services.filter((s) => s.designerId === designerId && s.active);
  return mine.some((s) => s.id === preferred) ? preferred : (mine[0]?.id ?? null);
}

/**
 * Book on a customer's behalf. Staff see the same slot grid customers do, and
 * may type any time — walk-ins and favours happen outside published hours —
 * but never a time that would overlap another appointment.
 */
export function NewAppointmentForm({
  draft,
  onDraftChange,
  conflict,
  onCreated,
  onCancel,
}: {
  draft: AppointmentDraft;
  onDraftChange: (next: AppointmentDraft) => void;
  /** Set by the calendar when the chosen time would overlap an existing appointment. */
  conflict?: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const { salon, members, me, isManager } = useSalon();
  const designers = members.filter((m) => m.roles.includes("DESIGNER"));
  const choosable = isManager ? designers : designers.filter((m) => m.id === me?.id);
  const { designerId, date, minutes } = draft;

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "" });
  const [notes, setNotes] = useState("");

  const services = useQuery({
    queryKey: salonKeys.services(salon.id),
    queryFn: () => api<Service[]>(`/salons/${salon.id}/services`),
  });
  const all = services.data ?? [];
  const mine = all.filter((s) => s.designerId === designerId && s.active);
  const serviceId = resolveServiceId(all, designerId, draft.serviceId);
  const service = mine.find((s) => s.id === serviceId);

  const availability = useQuery({
    queryKey: [...salonKeys.salon(salon.id), "staff-availability", designerId, serviceId, date],
    queryFn: () =>
      api<AvailabilityResponse>(`/salons/${salon.id}/availability?designerId=${designerId}&serviceId=${serviceId}&from=${date}&days=1`),
    enabled: Boolean(designerId && serviceId && date),
  });
  const slots = availability.data?.days[0]?.slots ?? [];
  const onGrid = minutes !== null && slots.some((s) => s.startMinutes === minutes);

  const customers = useQuery({
    queryKey: [...salonKeys.salon(salon.id), "customers", q],
    queryFn: () => api<Customer[]>(`/salons/${salon.id}/customers?q=${encodeURIComponent(q)}&limit=8`),
    enabled: q.trim().length >= 2,
  });

  const book = useMutation({
    mutationFn: (input: StaffBookAppointmentInput) =>
      api<StaffAppointment>(`/salons/${salon.id}/appointments`, { method: "POST", json: input }),
    onSuccess: onCreated,
  });

  const canSubmit = Boolean(serviceId && minutes !== null && !conflict && (customerId || newCustomer.name.trim()));
  const setMinutes = (m: number | null) => onDraftChange({ ...draft, minutes: m });

  return (
    <Card>
      <CardHeader>
        <CardTitle>New appointment</CardTitle>
        <CardDescription>Click the calendar to pick a time, choose a slot, or type one. Overlaps are refused.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (minutes === null || !serviceId || conflict) return;
            book.mutate({
              designerId,
              serviceId,
              startAt: localToUtc(date, minutes, salon.timezone).toISOString(),
              ...(customerId
                ? { customerId }
                : {
                    customer: {
                      name: newCustomer.name.trim(),
                      phone: newCustomer.phone.trim() || undefined,
                      email: newCustomer.email.trim() || undefined,
                    },
                  }),
              internalNotes: notes.trim() || undefined,
            });
          }}
        >
          {choosable.length > 1 && (
            <div className="grid gap-1.5">
              <Label htmlFor="na-designer">Designer</Label>
              <select
                id="na-designer"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={designerId}
                onChange={(e) => onDraftChange({ ...draft, designerId: e.target.value })}
              >
                {choosable.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="na-service">Service</Label>
            <select
              id="na-service"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={serviceId ?? ""}
              onChange={(e) => onDraftChange({ ...draft, serviceId: e.target.value })}
            >
              {mine.length === 0 && <option value="">No active services for this designer</option>}
              {mine.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatDuration(s.durationMin)} · {formatCents(s.priceCents)}
                </option>
              ))}
            </select>
            {service && service.bufferMin > 0 && (
              <p className="text-xs text-muted-foreground">
                Blocks {formatDuration(service.durationMin + service.bufferMin)} including {service.bufferMin} min cleanup.
              </p>
            )}
          </div>

          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="na-date">Date</Label>
              <Input
                id="na-date"
                type="date"
                value={date}
                onChange={(e) => e.target.value && onDraftChange({ ...draft, date: e.target.value, minutes: null })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="na-time">Time</Label>
              <Input
                id="na-time"
                type="time"
                step={300}
                className="w-32"
                value={minutes === null ? "" : minutesToHHMM(minutes)}
                onChange={(e) => setMinutes(e.target.value ? hhmmToMinutes(e.target.value) : null)}
                aria-invalid={Boolean(conflict)}
              />
            </div>
          </div>

          {conflict ? (
            <FieldError message={conflict} />
          ) : (
            minutes !== null &&
            !onGrid &&
            availability.isSuccess && (
              <p className="text-xs text-muted-foreground">
                {minutesLabel(minutes)} is outside published hours or off the slot grid — fine for staff, and nothing else is booked then.
              </p>
            )
          )}

          <div className="grid gap-1.5">
            <Label>Open slots</Label>
            {availability.isPending && serviceId && <p className="text-xs text-muted-foreground">Loading…</p>}
            {slots.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {slots.map((s) => (
                  <button
                    key={s.startAt}
                    type="button"
                    onClick={() => setMinutes(s.startMinutes)}
                    className={cn(
                      "rounded-md border px-2 py-1 text-xs transition-colors",
                      minutes === s.startMinutes ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                    )}
                  >
                    {minutesLabel(s.startMinutes)}
                  </button>
                ))}
              </div>
            )}
            {serviceId && availability.isSuccess && slots.length === 0 && (
              <p className="text-xs text-muted-foreground">Nothing open in published hours for this service.</p>
            )}
          </div>

          <div className="grid gap-1.5 border-t pt-4">
            <Label htmlFor="na-customer">Customer</Label>
            {customerId ? (
              <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{customers.data?.find((c) => c.id === customerId)?.name ?? "Selected customer"}</span>
                <Button size="xs" variant="ghost" onClick={() => setCustomerId(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <Input id="na-customer" placeholder="Search existing by name, phone or email…" value={q} onChange={(e) => setQ(e.target.value)} />
                {customers.data && customers.data.length > 0 && (
                  <ul className="divide-y rounded-md border text-sm">
                    {customers.data.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent"
                          onClick={() => setCustomerId(c.id)}
                        >
                          <span>{c.name}</span>
                          <span className="text-xs text-muted-foreground">{[c.phone, c.email].filter(Boolean).join(" · ")}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-muted-foreground">…or add a new one:</p>
                <div className="grid gap-2">
                  <Input placeholder="Name" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Phone" type="tel" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
                    <Input placeholder="Email" type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="na-notes">Internal notes</Label>
            <Input id="na-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <FieldError message={book.error instanceof ApiError ? book.error.message : undefined} />
          <div className="flex gap-2">
            <Button type="submit" disabled={!canSubmit || book.isPending}>
              {book.isPending ? "Booking…" : service && minutes !== null ? `Book ${service.name} at ${minutesLabel(minutes)}` : "Book"}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
