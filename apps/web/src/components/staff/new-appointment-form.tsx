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
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { salonKeys, useSalon } from "@/lib/salon-context";
import { useFormat } from "@/lib/use-format";
import { pillInputSm, pillSelectSm } from "@/lib/v3";
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
  const f = useFormat();
  const t = useTranslations("schedule.form");
  const common = useTranslations("common");
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
    <Card className="rounded-2xl bg-card ring-border">
      <CardHeader>
        <CardTitle className="font-display text-[22px] leading-tight font-medium tracking-[-0.01em]">{t("title")}</CardTitle>
        <CardDescription>{t("hint")}</CardDescription>
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
              <Label htmlFor="na-designer">{t("designer")}</Label>
              <select
                id="na-designer"
                className={pillSelectSm}
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
            <Label htmlFor="na-service">{t("service")}</Label>
            <select
              id="na-service"
              className={pillSelectSm}
              value={serviceId ?? ""}
              onChange={(e) => onDraftChange({ ...draft, serviceId: e.target.value })}
            >
              {mine.length === 0 && <option value="">{t("noServices")}</option>}
              {mine.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {f.duration(s.durationMin)} · {f.cents(s.priceCents)}
                </option>
              ))}
            </select>
            {service && service.bufferMin > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("blocks", { total: f.duration(service.durationMin + service.bufferMin), cleanup: f.duration(service.bufferMin) })}
              </p>
            )}
          </div>

          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="na-date">{t("date")}</Label>
              <Input className={pillInputSm}
                id="na-date"
                type="date"
                value={date}
                onChange={(e) => e.target.value && onDraftChange({ ...draft, date: e.target.value, minutes: null })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="na-time">{t("time")}</Label>
              <Input
                id="na-time"
                type="time"
                step={300}
                className={cn(pillInputSm, "w-32")}
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
                {t("offGrid", { time: f.minutes(minutes) })}
              </p>
            )
          )}

          <div className="grid gap-1.5">
            <Label>{t("openSlots")}</Label>
            {availability.isPending && serviceId && <p className="text-xs text-muted-foreground">{common("loading")}</p>}
            {slots.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {slots.map((s) => (
                  <button
                    key={s.startAt}
                    type="button"
                    onClick={() => setMinutes(s.startMinutes)}
                    className={cn(
                      "h-8 rounded-full px-3 text-xs font-medium tabular-nums transition-colors shadow-[inset_0_0_0_1px_var(--border)]",
                      minutes === s.startMinutes ? "bg-foreground text-background shadow-none" : "bg-card hover:bg-surface-muted",
                    )}
                  >
                    {f.minutes(s.startMinutes)}
                  </button>
                ))}
              </div>
            )}
            {serviceId && availability.isSuccess && slots.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("noSlots")}</p>
            )}
          </div>

          <div className="grid gap-1.5 border-t pt-4">
            <Label htmlFor="na-customer">{t("customer")}</Label>
            {customerId ? (
              <div className="flex items-center justify-between rounded-full px-4 py-1.5 text-sm shadow-[inset_0_0_0_1px_var(--input)]">
                <span>{customers.data?.find((c) => c.id === customerId)?.name ?? t("selectedCustomer")}</span>
                <Button size="xs" variant="ghost" onClick={() => setCustomerId(null)}>
                  {t("change")}
                </Button>
              </div>
            ) : (
              <>
                <Input className={pillInputSm} id="na-customer" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
                {customers.data && customers.data.length > 0 && (
                  <ul className="divide-y divide-border overflow-hidden rounded-lg text-sm shadow-[inset_0_0_0_1px_var(--border)]">
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
                <p className="text-xs text-muted-foreground">{t("orNew")}</p>
                <div className="grid gap-2">
                  <Input className={pillInputSm} placeholder={t("name")} value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input className={pillInputSm} placeholder={t("phone")} type="tel" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
                    <Input className={pillInputSm} placeholder={t("email")} type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="na-notes">{t("internalNotes")}</Label>
            <Input className={pillInputSm} id="na-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <FieldError message={book.error instanceof ApiError ? book.error.message : undefined} />
          <div className="flex gap-2">
            <Button type="submit" disabled={!canSubmit || book.isPending}>
              {book.isPending ? t("booking") : service && minutes !== null ? t("bookAt", { service: service.name, time: f.minutes(minutes) }) : t("book")}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              {common("cancel")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
