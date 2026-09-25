"use client";

import {
  addDays,
  localToUtc,
  completableFrom,
  noShowMarkableFrom,
  NO_SHOW_GRACE_MIN,
  PAYMENT_METHODS,
  todayIn,
  utcToLocal,
  type AvailabilityResponse,
  type PaymentMethod,
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
import { salonKeys, useSalon } from "@/lib/salon-context";
import { useFormat } from "@/lib/use-format";
import { cn } from "cn";

/** Day view spans these local hours; appointments outside still render, clamped. */
const DAY_START = 7 * 60;
const DAY_END = 21 * 60;
const PX_PER_MIN = 0.8; // 48px per hour

/**
 * Rescheduling is a quarter-hour decision in practice, so the minute picker
 * offers only these. Anything finer stays reachable through the calendar grid,
 * which follows the salon's own slot interval.
 */
const RESCHEDULE_MINUTES = [0, 15, 30, 45];
const HOURS_OF_DAY = Array.from({ length: 24 }, (_, hour) => hour);
const isQuarter = (minutes: number) => RESCHEDULE_MINUTES.includes(minutes % 60);

/** Shortcuts on the tip field. Manual entry always wins. */
const TIP_PERCENTS = [15, 18, 20, 25];

/**
 * Reads the tip field. Empty is null — nobody recorded one — which is not the
 * same as a recorded zero, so the two must stay distinguishable all the way
 * down to the column. Undefined means the text is not a usable amount.
 */
function parseTipDollars(input: string): number | null | undefined {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 10_000) return undefined;
  return Math.round(value * 100);
}

const centsToInput = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(2));
/** Matches the other bare selects in the app; shadcn has no select component here. */
const SELECT_CLASS = "h-9 rounded-md border border-input bg-transparent px-2 text-sm";
const yFor = (minutes: number) => (minutes - DAY_START) * PX_PER_MIN;

/** An existing appointment reduced to the span it occupies on one designer's day. */
interface Busy {
  designerId: string;
  /** Local minutes: the service itself. */
  start: number;
  end: number;
  /** end + cleanup buffer — the range nothing else may touch. */
  blockEnd: number;
  /** The service has waiting time in it, so something else may sit on top. */
  sharable: boolean;
}

/**
 * Side-by-side placement for a designer's day. Overlapping appointments are
 * split into clusters, each cluster into as many lanes as it is deep, so a
 * double booking reads as two columns rather than one block hiding another.
 *
 * A cluster where everything can be booked over gets one spare lane: the empty
 * strip is where a click lands, which is also what makes the room visible.
 */
function layoutLanes(items: { start: number; end: number; sharable: boolean }[]): { lane: number; lanes: number }[] {
  const placed: { lane: number; lanes: number }[] = new Array(items.length);
  const order = items.map((it, i) => ({ ...it, i })).sort((a, b) => a.start - b.start || a.end - b.end);

  let cluster: typeof order = [];
  let clusterEnd = Number.NEGATIVE_INFINITY;
  const flush = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = [];
    const lane = new Map<number, number>();
    for (const it of cluster) {
      let slot = laneEnds.findIndex((end) => end <= it.start);
      if (slot === -1) slot = laneEnds.push(0) - 1;
      laneEnds[slot] = it.end;
      lane.set(it.i, slot);
    }
    const lanes = laneEnds.length + (cluster.every((it) => it.sharable) ? 1 : 0);
    for (const it of cluster) placed[it.i] = { lane: lane.get(it.i) ?? 0, lanes };
    cluster = [];
    clusterEnd = Number.NEGATIVE_INFINITY;
  };

  for (const it of order) {
    if (it.start >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  flush();
  return placed;
}

export default function CalendarPage() {
  const f = useFormat();
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
      return {
        designerId: a.designerId,
        start,
        end: start + a.durationMin,
        blockEnd: start + a.durationMin + a.bufferMin,
        sharable: a.allowsDoubleBooking,
      };
    });

  /**
   * What the eye sees. Every rendered block captures its own click, so a ghost
   * drawn under one would lie about where clicking lands — including under a
   * cancelled block, whose time is free but which is still on screen.
   */
  const drawn = visible.map((a) => {
    const start = utcToLocal(new Date(a.startAt), salon.timezone).minutes;
    return {
      designerId: a.designerId,
      start,
      end: start + a.durationMin + (a.status === "CANCELLED" ? 0 : a.bufferMin),
      sharable: a.allowsDoubleBooking,
    };
  });

  /** Lane geometry per appointment id, computed once per designer column. */
  const laneOf = new Map<string, { lane: number; lanes: number }>();
  for (const m of columns) {
    const mine = visible.filter((a) => a.designerId === m.id);
    const boxes = mine.map((a) => {
      const start = utcToLocal(new Date(a.startAt), salon.timezone).minutes;
      return { start, end: start + a.durationMin + a.bufferMin, sharable: a.allowsDoubleBooking };
    });
    layoutLanes(boxes).forEach((geom, i) => laneOf.set(mine[i].id, geom));
  }
  /** Horizontal placement for one block, leaving a 4px gutter on each side. */
  const laneStyle = (id: string) => {
    const { lane, lanes } = laneOf.get(id) ?? { lane: 0, lanes: 1 };
    return {
      left: "calc(" + (lane * 100) / lanes + "% + 4px)",
      width: "calc(" + 100 / lanes + "% - 8px)",
    };
  };

  /** The service the form would use for this designer — what a new booking there would cost in time. */
  const serviceFor = (designerId: string): Service | null => {
    const list = services.data ?? [];
    const id = resolveServiceId(list, designerId, draft?.serviceId ?? null);
    return list.find((s) => s.id === id) ?? null;
  };
  const blockOf = (svc: Service | null) => (svc ? svc.durationMin + svc.bufferMin : snap);

  /** The first existing appointment a booking of `blockMin` starting at `minutes` would run into.
   *
   * This mirrors the database, which refuses an overlap only when neither side
   * can be shared: a sharable booking never clashes, and nothing ever clashes
   * with a sharable appointment.
   */
  const clashAt = (designerId: string, minutes: number, blockMin: number, sharable = false): Busy | undefined =>
    sharable
      ? undefined
      : busy.find((b) => !b.sharable && b.designerId === designerId && minutes < b.blockEnd && minutes + blockMin > b.start);

  /**
   * Only "free" cells are placeable, and only they get a hover preview —
   * anywhere else the grid stays quiet rather than explaining itself.
   *  past     — the time has gone.
   *  occupied — the cursor is inside an appointment (or its cleanup buffer).
   *  nofit    — the cell is free, but this service would run into the next appointment.
   */
  const cellState = (designerId: string, minutes: number): "past" | "occupied" | "nofit" | "free" => {
    if (isPast(minutes)) return "past";
    // Being inside a sharable block is not an obstacle — that spare lane is
    // exactly where a second booking goes.
    if (drawn.some((d) => !d.sharable && d.designerId === designerId && minutes >= d.start && minutes < d.end))
      return "occupied";
    const svc = serviceFor(designerId);
    return clashAt(designerId, minutes, blockOf(svc), svc?.allowsDoubleBooking ?? false) ? "nofit" : "free";
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
  const ghostClash = ghost
    ? clashAt(ghost.designerId, ghost.minutes!, blockOf(ghostService), ghostService?.allowsDoubleBooking ?? false)
    : undefined;
  const conflict =
    ghost && isPast(ghost.minutes!)
      ? `${f.minutes(ghost.minutes!)} has already passed — pick a time from now on.`
      : ghostClash && ghostService
        ? `${ghostService.name} takes ${f.duration(ghostService.durationMin + ghostService.bufferMin)} including cleanup, so it would run into the ${f.minutes(ghostClash.start)} appointment.`
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
          <Input type="date" className="w-40" aria-label="Date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <span className="text-sm text-muted-foreground">{f.localDate(date)}</span>
        </div>
        {!draft && !selected && columns.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {appts.data?.length ? "Select an appointment for details, or click an empty time to book." : "Click an empty time to book the first appointment."}
          </p>
        )}
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

      {/* The side column exists only while something is open in it, so an idle
          schedule gets the full width instead of a 360px strip holding a hint. */}
      <div className={cn("grid gap-4", (draft || selected) && "lg:grid-cols-[1fr_360px]")}>
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
                  {f.hour(h)}
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
                      + {f.minutes(hover.minutes)}
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
                      {ghostClash ? "Overlaps" : conflict ? "Past" : "New"} · {f.minutes(ghost.minutes!)}
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
                              className="pointer-events-none absolute z-10 rounded-b-md border-x border-b border-dashed border-primary/30 bg-primary/5"
                              style={{
                                ...laneStyle(a.id),
                                top: yFor(start + a.durationMin),
                                height: a.bufferMin * PX_PER_MIN - 1,
                              }}
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
                              "absolute z-20 cursor-pointer overflow-hidden rounded-md border px-2 py-1 text-left text-xs leading-tight transition-colors",
                              a.status === "CONFIRMED" && "border-primary/40 bg-primary/15 hover:bg-primary/25",
                              a.status === "PENDING" && "border-dashed border-primary/40 bg-primary/5",
                              a.status === "COMPLETED" && "border-border bg-muted text-muted-foreground",
                              a.status === "NO_SHOW" && "border-destructive/40 bg-destructive/10 text-destructive",
                              a.status === "CANCELLED" && "border-border bg-transparent text-muted-foreground line-through",
                              selected?.id === a.id && "ring-2 ring-ring",
                            )}
                            style={{ ...laneStyle(a.id), top, height }}
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

        <aside className="self-start lg:sticky lg:top-4">
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
              // Remount per appointment: the confirm steps, the notes field and
              // the reschedule time are all per-appointment state, and reusing
              // the instance would carry a primed confirmation to the next one.
              key={selected.id}
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
        </aside>
      </div>
    </div>
  );
}

/** Records or corrects the tip on an appointment that is already complete. */
function TipEditor({
  tipCents,
  priceCents,
  saving,
  onSave,
}: {
  tipCents: number | null;
  priceCents: number;
  saving: boolean;
  onSave: (cents: number | null) => void;
}) {
  const [value, setValue] = useState(() => centsToInput(tipCents));
  const parsed = parseTipDollars(value);
  const pct = tipCents !== null && priceCents > 0 ? Math.round((tipCents / priceCents) * 1000) / 10 : null;

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="appt-tip-saved">Tip</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          id="appt-tip-saved"
          className="h-8 w-24"
          inputMode="decimal"
          placeholder="$0.00"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {TIP_PERCENTS.map((percent) => (
          <Button
            key={percent}
            size="xs"
            variant="outline"
            onClick={() => setValue(centsToInput(Math.round((priceCents * percent) / 100)))}
          >
            {percent}%
          </Button>
        ))}
        <Button
          size="xs"
          disabled={saving || parsed === undefined || parsed === tipCents}
          onClick={() => parsed !== undefined && onSave(parsed)}
        >
          Save
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {parsed === undefined
          ? "Enter a dollar amount, or clear the field to record nothing."
          : pct !== null
            ? `${pct}% of the service price.`
            : "Not recorded."}
      </p>
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
  /** Ticks with the calendar, so the timed gates open without a reload. */
  now: Date;
  canEdit: boolean;
  onChanged: (a: StaffAppointment) => void;
  onClose: () => void;
}) {
  const f = useFormat();
  const { salon, members } = useSalon();
  const [reason, setReason] = useState("");
  const [confirmNoShow, setConfirmNoShow] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);
  /** Chosen in the confirm step; null means nobody recorded how they paid. */
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  /** Kept as text so an empty field stays "not recorded" rather than zero. */
  const [tip, setTip] = useState("");
  // A proposed new time, not a readout of the current one — the header already
  // shows that — so snapping an off-grid appointment to the nearest quarter is
  // honest rather than misleading.
  const [moveMinutes, setMoveMinutes] = useState(() => {
    const m = utcToLocal(new Date(appt.startAt), salon.timezone).minutes;
    return Math.min(1425, Math.round(m / 15) * 15);
  });
  const [notes, setNotes] = useState(appt.internalNotes ?? "");

  const update = useMutation({
    mutationFn: (json: Record<string, unknown>) =>
      api<StaffAppointment>(`/salons/${salon.id}/appointments/${appt.id}`, { method: "PATCH", json }),
    onSuccess: onChanged,
  });

  const open = appt.status === "CONFIRMED" || appt.status === "PENDING";
  const designer = members.find((m) => m.id === appt.designerId)?.displayName;

  /**
   * Where this appointment could actually go on the shown day. Staff mode, so
   * no lead time — but still no past, no closed hours and no clashes. It
   * excludes itself, or it would always be its own obstacle.
   */
  const reschedule = useQuery({
    queryKey: [...salonKeys.salon(salon.id), "reschedule", appt.id, date],
    queryFn: () =>
      api<AvailabilityResponse>(
        `/salons/${salon.id}/availability?designerId=${appt.designerId}&serviceId=${appt.serviceId}&from=${date}&days=1&excludeAppointmentId=${appt.id}`,
      ),
    enabled: open && canEdit && Boolean(appt.serviceId),
  });
  /**
   * A deleted service leaves nothing to measure, so fall back to every hour
   * and say the times were not checked rather than offering none.
   */
  const timesChecked = Boolean(appt.serviceId);
  const openStarts = (reschedule.data?.days[0]?.slots ?? []).map((slot) => slot.startMinutes).filter(isQuarter);
  const openHours = timesChecked
    ? [...new Set(openStarts.map((m) => Math.floor(m / 60)))]
    : HOURS_OF_DAY;
  const minutesInHour = (hour: number) =>
    timesChecked ? openStarts.filter((m) => Math.floor(m / 60) === hour).map((m) => m % 60) : RESCHEDULE_MINUTES;
  /**
   * The stored choice only counts while it is still on offer — slots move as
   * the day fills up and the clock passes. Deriving it beats syncing state.
   */
  const chosen = !timesChecked || openStarts.includes(moveMinutes) ? moveMinutes : (openStarts[0] ?? null);
  const nothingOpen = timesChecked && reschedule.isSuccess && openStarts.length === 0;
  /** null = not recorded, undefined = the field does not read as an amount. */
  const tipCents = parseTipDollars(tip);
  // Someone ten minutes late is late, not absent. The API enforces the same gate.
  const markableFrom = noShowMarkableFrom(appt.startAt);
  const canNoShow = now >= markableFrom;
  // Nor can a service be finished before it starts. Same gate in the API.
  const completeFrom = completableFrom(appt.startAt);
  const canComplete = now >= completeFrom;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            {appt.customer.name}
            <Badge variant={open ? "default" : "outline"}>{f.status(appt.status)}</Badge>
          </CardTitle>
          <CardDescription>
            {appt.serviceName} · {f.cents(appt.priceCents)} · with {designer}
            <br />
            {f.inTz(appt.startAt, salon.timezone)} – {f.inTz(appt.endAt, salon.timezone, "time")}
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
                  <Label htmlFor="appt-move-hour">Move to</Label>
                  {reschedule.isPending && timesChecked && (
                    <p className="text-xs text-muted-foreground">Finding open times…</p>
                  )}
                  {nothingOpen && (
                    <p className="text-xs text-muted-foreground">
                      Nothing left on this day fits {appt.serviceName}. Pick another day on the calendar first.
                    </p>
                  )}
                  {chosen !== null && !nothingOpen && !(reschedule.isPending && timesChecked) && (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          id="appt-move-hour"
                          className={SELECT_CLASS}
                          value={Math.floor(chosen / 60)}
                          onChange={(e) => {
                            const hour = Number(e.target.value);
                            const options = minutesInHour(hour);
                            const keep = options.includes(chosen % 60) ? chosen % 60 : (options[0] ?? 0);
                            setMoveMinutes(hour * 60 + keep);
                          }}
                        >
                          {openHours.map((hour) => (
                            <option key={hour} value={hour}>
                              {f.hour(hour * 60)}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Minutes past the hour"
                          className={SELECT_CLASS}
                          value={chosen % 60}
                          onChange={(e) => setMoveMinutes(Math.floor(chosen / 60) * 60 + Number(e.target.value))}
                        >
                          {minutesInHour(Math.floor(chosen / 60)).map((minute) => (
                            <option key={minute} value={minute}>
                              {String(minute).padStart(2, "0")}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={update.isPending}
                          onClick={() =>
                            update.mutate({ startAt: localToUtc(date, chosen, salon.timezone).toISOString() })
                          }
                        >
                          Reschedule
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {timesChecked
                          ? "Only times that are still open and fit the service are listed."
                          : "This service was removed, so open times could not be checked."}
                      </p>
                    </>
                  )}
                </div>
                <div className="grid gap-2 border-t pt-4">
                  <div className="flex gap-2">
                    {!confirmComplete && (
                      <Button
                        size="sm"
                        disabled={!canComplete || update.isPending}
                        onClick={() => setConfirmComplete(true)}
                      >
                        Completed
                      </Button>
                    )}
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
                  {!canComplete && (
                    <p className="text-xs text-muted-foreground">
                      This appointment starts at {f.inTz(completeFrom, salon.timezone, "time")}. It can be
                      completed from then.
                    </p>
                  )}
                  {!canNoShow && (
                    <p className="text-xs text-muted-foreground">
                      No-show can be marked from {f.inTz(markableFrom, salon.timezone, "time")}, {NO_SHOW_GRACE_MIN} minutes
                      after the start.
                    </p>
                  )}
                  {confirmComplete && (
                    <div className="grid gap-3 rounded-md border border-primary/40 bg-primary/5 p-3">
                      <p className="text-xs">
                        Mark {appt.customer.name}&rsquo;s {appt.serviceName} as completed? Completed is final &mdash;
                        unlike a no-show, it cannot be undone.
                      </p>
                      <div className="grid gap-1.5">
                        <p className="text-xs text-muted-foreground">How did they pay? Optional.</p>
                        <div className="flex flex-wrap gap-1.5">
                          {PAYMENT_METHODS.map((method) => (
                            <Button
                              key={method}
                              size="xs"
                              variant={payment === method ? "default" : "outline"}
                              aria-pressed={payment === method}
                              onClick={() => setPayment(payment === method ? null : method)}
                            >
                              {f.payment(method)}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="appt-tip" className="text-xs font-normal text-muted-foreground">
                          Tip? Optional.
                        </Label>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Input
                            id="appt-tip"
                            className="h-8 w-24"
                            inputMode="decimal"
                            placeholder="$0.00"
                            value={tip}
                            onChange={(e) => setTip(e.target.value)}
                          />
                          {TIP_PERCENTS.map((percent) => (
                            <Button
                              key={percent}
                              size="xs"
                              variant="outline"
                              onClick={() => setTip(centsToInput(Math.round((appt.priceCents * percent) / 100)))}
                            >
                              {percent}%
                            </Button>
                          ))}
                        </div>
                        {tipCents === undefined && <p className="text-xs text-destructive">Enter a dollar amount.</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={update.isPending || tipCents === undefined}
                          onClick={() => {
                            setConfirmComplete(false);
                            update.mutate({ status: "COMPLETED", paymentMethod: payment, tipCents });
                          }}
                        >
                          Yes, complete
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmComplete(false)}>
                          Not yet
                        </Button>
                      </div>
                    </div>
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

            {appt.status === "COMPLETED" && (
              <div className="grid gap-3 border-t pt-4">
                <div className="grid gap-1.5">
                  <Label>Payment</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {PAYMENT_METHODS.map((method) => (
                      <Button
                        key={method}
                        size="xs"
                        variant={appt.paymentMethod === method ? "default" : "outline"}
                        aria-pressed={appt.paymentMethod === method}
                        disabled={update.isPending}
                        onClick={() => update.mutate({ paymentMethod: appt.paymentMethod === method ? null : method })}
                      >
                        {f.payment(method)}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {appt.paymentMethod
                      ? "Tap again to clear it."
                      : "Not recorded. This is a note for the salon, not a payment."}
                  </p>
                </div>
                <TipEditor
                  // Remount on the saved value so the field shows what was stored.
                  key={String(appt.tipCents)}
                  tipCents={appt.tipCents}
                  priceCents={appt.priceCents}
                  saving={update.isPending}
                  onSave={(cents) => update.mutate({ tipCents: cents })}
                />
              </div>
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
