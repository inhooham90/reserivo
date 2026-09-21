"use client";

import {
  addDays,
  localToUtc,
  noShowMarkableFrom,
  NO_SHOW_GRACE_MIN,
  todayIn,
  utcToLocal,
  type Service,
  type StaffAppointment,
} from "@reserivo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type MouseEvent } from "react";
import { FieldError } from "@/components/field-error";
import { NewAppointmentForm, resolveServiceId, type AppointmentDraft } from "@/components/staff/new-appointment-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { formatCents, formatDuration, formatInTz, formatLocalDate, minutesLabel, statusLabel } from "@/lib/format";
import { salonKeys, useSalon } from "@/lib/salon-context";
import { cn } from "cn";

/** Day view spans these local hours; appointments outside still render, clamped. */
const DAY_START = 7 * 60;
const DAY_END = 21 * 60;
const PX_PER_MIN = 0.8; // 48px per hour
const yFor = (minutes: number) => (minutes - DAY_START) * PX_PER_MIN;

/** An existing appointment reduced to the span it occupies on one designer's day. */
interface Busy {
  designerId: string;
  /** Local minutes: the service itself. */
  start: number;
  end: number;
  /** end + cleanup buffer — the range nothing else may touch. */
  blockEnd: number;
}

export default function CalendarPage() {
  const { salon, members, me, isManager } = useSalon();
  const [date, setDate] = useState(() => todayIn(salon.timezone));
  const [selected, setSelected] = useState<StaffAppointment | null>(null);
  const [draft, setDraft] = useState<AppointmentDraft | null>(null);
  const [hover, setHover] = useState<{ designerId: string; minutes: number } | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  // Ticks so the now-line and the shading over past time keep up without a reload.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const queryClient = useQueryClient();

  const designers = members.filter((m) => m.roles.includes("DESIGNER"));
  const columns = isManager ? designers : designers.filter((m) => m.id === me?.id);
  const canPlaceIn = (designerId: string) => isManager || designerId === me?.id;
  // Snap clicks to the salon's slot grid; 15 min at most so the grid stays usable.
  const snap = Math.min(salon.slotIntervalMin, 15);

  const appts = useQuery({
    queryKey: [...salonKeys.salon(salon.id), "appointments", date],
    queryFn: () => api<StaffAppointment[]>(`/salons/${salon.id}/appointments?from=${date}&to=${date}`),
    refetchInterval: 60_000,
  });
  const services = useQuery({
    queryKey: salonKeys.services(salon.id),
    queryFn: () => api<Service[]>(`/salons/${salon.id}/services`),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [...salonKeys.salon(salon.id), "appointments"] });

  const visible = (appts.data ?? []).filter((a) => showCancelled || a.status !== "CANCELLED");
  const hours = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START + i * 60);
  const nowLocal = utcToLocal(now, salon.timezone);
  const showNowLine = nowLocal.date === date && nowLocal.minutes >= DAY_START && nowLocal.minutes <= DAY_END;

  /** Time already gone: the whole day for a past date, everything before the clock for today. */
  const today = todayIn(salon.timezone);
  const pastCutoff = date < today ? DAY_END : date === today ? nowLocal.minutes : null;
  const isPast = (minutes: number) => pastCutoff !== null && minutes < pastCutoff;

  /** What actually reserves time. Cancelled appointments free their slot up again. */
  const busy: Busy[] = (appts.data ?? [])
    .filter((a) => a.status !== "CANCELLED")
    .map((a) => {
      const start = utcToLocal(new Date(a.startAt), salon.timezone).minutes;
      return { designerId: a.designerId, start, end: start + a.durationMin, blockEnd: start + a.durationMin + a.bufferMin };
    });

  /**
   * What the eye sees. Every rendered block captures its own click, so a ghost
   * drawn under one would lie about where clicking lands — including under a
   * cancelled block, whose time is free but which is still on screen.
   */
  const drawn = visible.map((a) => {
    const start = utcToLocal(new Date(a.startAt), salon.timezone).minutes;
    return { designerId: a.designerId, start, end: start + a.durationMin + (a.status === "CANCELLED" ? 0 : a.bufferMin) };
  });

  /** The service the form would use for this designer — what a new booking there would cost in time. */
  const serviceFor = (designerId: string): Service | null => {
    const list = services.data ?? [];
    const id = resolveServiceId(list, designerId, draft?.serviceId ?? null);
    return list.find((s) => s.id === id) ?? null;
  };
  const blockOf = (svc: Service | null) => (svc ? svc.durationMin + svc.bufferMin : snap);

  /** The first existing appointment a booking of `blockMin` starting at `minutes` would run into. */
  const clashAt = (designerId: string, minutes: number, blockMin: number): Busy | undefined =>
    busy.find((b) => b.designerId === designerId && minutes < b.blockEnd && minutes + blockMin > b.start);

  /**
   * Only "free" cells are placeable, and only they get a hover preview —
   * anywhere else the grid stays quiet rather than explaining itself.
   *  past     — the time has gone.
   *  occupied — the cursor is inside an appointment (or its cleanup buffer).
   *  nofit    — the cell is free, but this service would run into the next appointment.
   */
  const cellState = (designerId: string, minutes: number): "past" | "occupied" | "nofit" | "free" => {
    if (isPast(minutes)) return "past";
    if (drawn.some((d) => d.designerId === designerId && minutes >= d.start && minutes < d.end)) return "occupied";
    return clashAt(designerId, minutes, blockOf(serviceFor(designerId))) ? "nofit" : "free";
  };

  /** Where in the column the cursor is, snapped to the grid. */
  const minutesAt = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = DAY_START + (e.clientY - rect.top) / PX_PER_MIN;
    const snapped = Math.floor(raw / snap) * snap;
    return Math.min(DAY_END - snap, Math.max(DAY_START, snapped));
  };

  const openDraft = (designerId: string, minutes: number | null) => {
    setSelected(null);
    // Re-clicking while the form is open moves the time but keeps what was typed and the chosen service.
    setDraft((d) => ({ designerId, date, minutes, serviceId: d?.serviceId ?? null }));
  };

  // The placed draft, plus why it cannot be booked (also handed to the form).
  const ghost = draft && draft.date === date && draft.minutes !== null ? draft : null;
  const ghostService = ghost ? serviceFor(ghost.designerId) : null;
  const ghostClash = ghost ? clashAt(ghost.designerId, ghost.minutes!, blockOf(ghostService)) : undefined;
  const conflict =
    ghost && isPast(ghost.minutes!)
      ? `${minutesLabel(ghost.minutes!)} has already passed — pick a time from now on.`
      : ghostClash && ghostService
        ? `${ghostService.name} takes ${formatDuration(ghostService.durationMin + ghostService.bufferMin)} including cleanup, so it would run into the ${minutesLabel(ghostClash.start)} appointment.`
        : undefined;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" aria-label="Previous day" onClick={() => setDate((d) => addDays(d, -1))}>
            <span aria-hidden="true">←</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDate(todayIn(salon.timezone))}>
            Today
          </Button>
          <Button size="sm" variant="outline" aria-label="Next day" onClick={() => setDate((d) => addDays(d, 1))}>
            <span aria-hidden="true">→</span>
          </Button>
          <Input type="date" className="w-40" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <span className="text-sm text-muted-foreground">{formatLocalDate(date)}</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
            Show cancelled
          </label>
          <Button onClick={() => openDraft(columns[0]?.id ?? "", null)} disabled={columns.length === 0}>
            New appointment
          </Button>
        </div>
      </div>

      {columns.length === 0 && (
        <p className="text-sm text-muted-foreground">Nobody takes appointments yet — give someone the Designer role from the Team tab.</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="overflow-x-auto rounded-xl border bg-card">
          <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `3.5rem repeat(${columns.length}, minmax(140px, 1fr))` }}>
            <div className="sticky top-0 z-10 border-b bg-card" />
            {columns.map((m) => (
              <div key={m.id} className="sticky top-0 z-10 border-b border-l bg-card px-3 py-2 text-sm font-medium">
                {m.displayName}
              </div>
            ))}

            <div className="relative" style={{ height: yFor(DAY_END) }}>
              {hours.map((h) => (
                <div key={h} className="absolute right-2 -translate-y-1/2 text-xs text-muted-foreground" style={{ top: yFor(h) }}>
                  {minutesLabel(h).replace(":00", "")}
                </div>
              ))}
            </div>

            {columns.map((m) => {
              const editable = canPlaceIn(m.id);
              const svc = serviceFor(m.id);
              return (
                <div
                  key={m.id}
                  className={cn("relative border-l", editable && "cursor-crosshair")}
                  style={{ height: yFor(DAY_END) }}
                  onMouseMove={
                    editable
                      ? (e) => {
                          const minutes = minutesAt(e);
                          setHover(cellState(m.id, minutes) === "free" ? { designerId: m.id, minutes } : null);
                        }
                      : undefined
                  }
                  onMouseLeave={editable ? () => setHover(null) : undefined}
                  onClick={
                    editable
                      ? (e) => {
                          const minutes = minutesAt(e);
                          // Occupied cells and gaps too small for this service are not placeable.
                          if (cellState(m.id, minutes) === "free") openDraft(m.id, minutes);
                        }
                      : undefined
                  }
                >
                  {hours.map((h) => (
                    <div key={h} className="absolute inset-x-0 border-t border-border/60" style={{ top: yFor(h) }} />
                  ))}

                  {/* Time that has gone: shaded and not placeable. Sits under the blocks so past appointments stay readable. */}
                  {pastCutoff !== null && (
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 bg-muted/60"
                      style={{ height: Math.max(0, yFor(Math.min(pastCutoff, DAY_END))) }}
                    />
                  )}

                  {showNowLine && (
                    <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-destructive/70" style={{ top: yFor(nowLocal.minutes) }} />
                  )}

                  {hover && hover.designerId === m.id && !(ghost && ghost.designerId === m.id && ghost.minutes === hover.minutes) && (
                    <div
                      className="pointer-events-none absolute inset-x-1 overflow-hidden rounded-md border border-dashed border-primary/50 bg-primary/5 px-2 text-xs leading-tight text-primary"
                      style={{ top: yFor(hover.minutes), height: Math.max(20, blockOf(svc) * PX_PER_MIN - 2) }}
                    >
                      + {minutesLabel(hover.minutes)}
                    </div>
                  )}

                  {ghost && ghost.designerId === m.id && (
                    <div
                      className={cn(
                        "pointer-events-none absolute inset-x-1 z-10 overflow-hidden rounded-md border-2 border-dashed px-2 py-0.5 text-xs font-medium leading-tight",
                        conflict ? "border-destructive bg-destructive/10 text-destructive" : "border-primary bg-primary/10 text-primary",
                      )}
                      style={{ top: yFor(ghost.minutes!), height: Math.max(22, blockOf(ghostService) * PX_PER_MIN - 2) }}
                    >
                      {ghostClash ? "Overlaps" : conflict ? "Past" : "New"} · {minutesLabel(ghost.minutes!)}
                    </div>
                  )}

                  {visible
                    .filter((a) => a.designerId === m.id)
                    .map((a) => {
                      const start = utcToLocal(new Date(a.startAt), salon.timezone).minutes;
                      const top = Math.max(0, yFor(start));
                      const height = Math.max(22, a.durationMin * PX_PER_MIN - 2);
                      const blocking = a.status !== "CANCELLED";
                      return (
                        <div key={a.id}>
                          {/* Cleanup time: nothing may be booked into it, so show it rather than leaving a deceptive gap. */}
                          {blocking && a.bufferMin > 0 && (
                            <div
                              className="pointer-events-none absolute inset-x-1 z-10 rounded-b-md border-x border-b border-dashed border-primary/30 bg-primary/5"
                              style={{ top: yFor(start + a.durationMin), height: a.bufferMin * PX_PER_MIN - 1 }}
                            />
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation(); // don't also place a draft under the block
                              setDraft(null);
                              setSelected(a);
                            }}
                            className={cn(
                              "absolute inset-x-1 z-20 cursor-pointer overflow-hidden rounded-md border px-2 py-1 text-left text-xs leading-tight transition-colors",
                              a.status === "CONFIRMED" && "border-primary/40 bg-primary/15 hover:bg-primary/25",
                              a.status === "PENDING" && "border-dashed border-primary/40 bg-primary/5",
                              a.status === "COMPLETED" && "border-border bg-muted text-muted-foreground",
                              a.status === "NO_SHOW" && "border-destructive/40 bg-destructive/10 text-destructive",
                              a.status === "CANCELLED" && "border-border bg-transparent text-muted-foreground line-through",
                              selected?.id === a.id && "ring-2 ring-ring",
                            )}
                            style={{ top, height }}
                          >
                            <span className="font-medium">{a.customer.name}</span>
                            <span className="block truncate opacity-80">{a.serviceName}</span>
                          </button>
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="self-start">
          {draft && (
            <NewAppointmentForm
              draft={draft}
              onDraftChange={(next) => {
                setDraft(next);
                if (next.date !== date) setDate(next.date);
              }}
              conflict={conflict}
              onCreated={() => {
                setDraft(null);
                void invalidate();
              }}
              onCancel={() => setDraft(null)}
            />
          )}
          {selected && !draft && (
            <AppointmentPanel
              appt={selected}
              date={date}
              now={now}
              canEdit={isManager || selected.designerId === me?.id}
              onChanged={(a) => {
                setSelected(a);
                void invalidate();
              }}
              onClose={() => setSelected(null)}
            />
          )}
          {!draft && !selected && columns.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {appts.data?.length ? "Select an appointment for details, or click an empty time to book." : "Click an empty time to book the first appointment."}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function AppointmentPanel({
  appt,
  date,
  now,
  canEdit,
  onChanged,
  onClose,
}: {
  appt: StaffAppointment;
  date: string;
  /** Ticks with the calendar, so the no-show gate opens without a reload. */
  now: Date;
  canEdit: boolean;
  onChanged: (a: StaffAppointment) => void;
  onClose: () => void;
}) {
  const { salon, members } = useSalon();
  const [reason, setReason] = useState("");
  const [confirmNoShow, setConfirmNoShow] = useState(false);
  const [newTime, setNewTime] = useState(() => {
    const m = utcToLocal(new Date(appt.startAt), salon.timezone).minutes;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  });
  const [notes, setNotes] = useState(appt.internalNotes ?? "");

  const update = useMutation({
    mutationFn: (json: Record<string, unknown>) =>
      api<StaffAppointment>(`/salons/${salon.id}/appointments/${appt.id}`, { method: "PATCH", json }),
    onSuccess: onChanged,
  });

  const open = appt.status === "CONFIRMED" || appt.status === "PENDING";
  const designer = members.find((m) => m.id === appt.designerId)?.displayName;
  // Someone ten minutes late is late, not absent. The API enforces the same gate.
  const markableFrom = noShowMarkableFrom(appt.startAt);
  const canNoShow = now >= markableFrom;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            {appt.customer.name}
            <Badge variant={open ? "default" : "outline"}>{statusLabel(appt.status)}</Badge>
          </CardTitle>
          <CardDescription>
            {appt.serviceName} · {formatCents(appt.priceCents)} · with {designer}
            <br />
            {formatInTz(appt.startAt, salon.timezone, "EEE, MMM d · h:mm a")} – {formatInTz(appt.endAt, salon.timezone, "h:mm a")}
            {appt.bufferMin ? ` (+${appt.bufferMin} min buffer)` : ""}
          </CardDescription>
        </div>
        <Button size="xs" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        {(appt.customer.email || appt.customer.phone) && (
          <p className="text-muted-foreground">{[appt.customer.email, appt.customer.phone].filter(Boolean).join(" · ")}</p>
        )}
        {appt.notes && (
          <p>
            <span className="text-muted-foreground">Customer note:</span> {appt.notes}
          </p>
        )}
        {appt.cancelReason && <p className="text-muted-foreground">Cancelled: {appt.cancelReason}</p>}
        <p className="text-xs text-muted-foreground">Booked {appt.source === "ONLINE" ? "online" : "by staff"}.</p>

        {canEdit && (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="appt-notes">Internal notes</Label>
              <Input id="appt-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <Button
                size="xs"
                variant="outline"
                className="justify-self-start"
                disabled={update.isPending}
                onClick={() => update.mutate({ internalNotes: notes || null })}
              >
                Save notes
              </Button>
            </div>

            {open && (
              <>
                <div className="grid gap-1.5 border-t pt-4">
                  <Label htmlFor="appt-move">Move to</Label>
                  <div className="flex gap-2">
                    <Input id="appt-move" type="time" step={300} className="w-32" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={update.isPending}
                      onClick={() => {
                        const [h, m] = newTime.split(":").map(Number);
                        update.mutate({ startAt: localToUtc(date, h * 60 + m, salon.timezone).toISOString() });
                      }}
                    >
                      Reschedule
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 border-t pt-4">
                  <div className="flex gap-2">
                    <Button size="sm" disabled={update.isPending} onClick={() => update.mutate({ status: "COMPLETED" })}>
                      Completed
                    </Button>
                    {!confirmNoShow && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canNoShow || update.isPending}
                        onClick={() => setConfirmNoShow(true)}
                      >
                        No-show
                      </Button>
                    )}
                  </div>
                  {!canNoShow && (
                    <p className="text-xs text-muted-foreground">
                      No-show can be marked from {formatInTz(markableFrom, salon.timezone, "h:mm a")}, {NO_SHOW_GRACE_MIN} minutes
                      after the start.
                    </p>
                  )}
                  {confirmNoShow && (
                    <div className="grid gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                      <p className="text-xs">
                        Mark {appt.customer.name} as a no-show? It counts on their record in the customer list. You can undo it.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={update.isPending}
                          onClick={() => {
                            setConfirmNoShow(false);
                            update.mutate({ status: "NO_SHOW" });
                          }}
                        >
                          Yes, no-show
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmNoShow(false)}>
                          Keep as booked
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input placeholder="Cancel reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={update.isPending}
                      onClick={() => {
                        if (confirm("Cancel this appointment?")) update.mutate({ status: "CANCELLED", cancelReason: reason || undefined });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </>
            )}

            {appt.status === "NO_SHOW" && (
              <div className="grid gap-1.5 border-t pt-4">
                <Button
                  size="sm"
                  variant="outline"
                  className="justify-self-start"
                  disabled={update.isPending}
                  onClick={() => update.mutate({ status: "CONFIRMED" })}
                >
                  Undo no-show
                </Button>
                <p className="text-xs text-muted-foreground">Puts it back to booked, as long as nothing else has taken the time.</p>
              </div>
            )}
            <FieldError message={update.error instanceof ApiError ? update.error.message : undefined} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
