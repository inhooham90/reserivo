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
  windowsForDate,
  type AvailabilityResponse,
  type PaymentMethod,
  type SalonHours,
  type Service,
  type StaffAppointment,
} from "@reserivo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Info, MousePointerClick, Plus, TriangleAlert } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { FieldError } from "@/components/field-error";
import { NewAppointmentForm, resolveServiceId, type AppointmentDraft } from "@/components/staff/new-appointment-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { api, ApiError } from "@/lib/api";
import { salonKeys, useSalon } from "@/lib/salon-context";
import { useFormat } from "@/lib/use-format";
import { ghostPillSm, pillButtonSm, pillSelectSm, textLink } from "@/lib/v3";
import { cn } from "cn";

/** Day view spans these local hours; appointments outside still render, clamped. */
const DAY_START = 7 * 60;
const DAY_END = 21 * 60;
const HOUR_PX = 56;
const PX_PER_MIN = HOUR_PX / 60;

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
 * Reads the tip field. Empty is null (nobody recorded one), which is not the
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
const yFor = (minutes: number) => (minutes - DAY_START) * PX_PER_MIN;

/** An existing appointment reduced to the span it occupies on one designer's day. */
interface Busy {
  designerId: string;
  /** Local minutes: the service itself. */
  start: number;
  end: number;
  /** end + cleanup buffer: the range nothing else may touch. */
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

/** The stretches of the grid outside opening hours, for the closed-hours hatch. */
function closedSpans(open: { startMinutes: number; endMinutes: number }[]): [number, number][] {
  const spans: [number, number][] = [];
  let cursor = DAY_START;
  for (const w of open) {
    if (w.startMinutes > cursor) spans.push([cursor, Math.min(w.startMinutes, DAY_END)]);
    cursor = Math.max(cursor, w.endMinutes);
  }
  if (cursor < DAY_END) spans.push([cursor, DAY_END]);
  return spans.filter(([a, b]) => b > a);
}

/** Up to two letters for a column avatar. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return picked.map((w) => Array.from(w)[0] ?? "").join("").toUpperCase();
}

/**
 * Block colour. Open appointments are coloured by who booked them, the one
 * distinction staff read at a glance (lavender: the client online; butter:
 * staff, which is where walk-ins land). Final states override: completed
 * greys out, a no-show is red, a cancellation is a dashed outline (DESIGN.md
 * "Calendar blocks").
 */
function blockTone(a: StaffAppointment): string {
  switch (a.status) {
    case "COMPLETED":
      return "bg-surface-muted text-body";
    case "NO_SHOW":
      return "bg-destructive/10 text-destructive";
    case "CANCELLED":
      return "border border-dashed border-(--cancelled-edge) bg-card text-body [&_.who]:line-through [&_.what]:line-through";
    default:
      return cn(
        a.source === "ONLINE" ? "bg-lavender" : "bg-butter shadow-[inset_0_0_0_1px_var(--border)]",
        // Awaiting confirmation: the same colour, with a dashed edge to say it is not settled.
        a.status === "PENDING" && "border border-dashed border-(--cancelled-edge)",
      );
  }
}

export default function CalendarPage() {
  const f = useFormat();
  const t = useTranslations("schedule");
  const { salon, members, me, isManager } = useSalon();
  const [date, setDate] = useState(() => todayIn(salon.timezone));
  const [selected, setSelected] = useState<StaffAppointment | null>(null);
  const [draft, setDraft] = useState<AppointmentDraft | null>(null);
  const [hover, setHover] = useState<{ designerId: string; minutes: number } | null>(null);
  const [showCancelled, setShowCancelled] = useState(false);
  /** One designer's column only, or null for everyone. */
  const [only, setOnly] = useState<string | null>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  // Ticks so the now-line and the shading over past time keep up without a reload.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const queryClient = useQueryClient();

  const designers = members.filter((m) => m.roles.includes("DESIGNER"));
  const allowed = isManager ? designers : designers.filter((m) => m.id === me?.id);
  // A filter pointing at someone no longer bookable falls back to everyone.
  const columns = allowed.some((m) => m.id === only) ? allowed.filter((m) => m.id === only) : allowed;
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
  const hours = useQuery({
    queryKey: salonKeys.hours(salon.id),
    queryFn: () => api<SalonHours>(`/salons/${salon.id}/hours`),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [...salonKeys.salon(salon.id), "appointments"] });

  const shownIds = new Set(columns.map((m) => m.id));
  const dayAppts = (appts.data ?? []).filter((a) => shownIds.has(a.designerId));
  const visible = dayAppts.filter((a) => showCancelled || a.status !== "CANCELLED");
  const hourMarks = Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, i) => DAY_START + i * 60);
  const nowLocal = utcToLocal(now, salon.timezone);
  const showNowLine = nowLocal.date === date && nowLocal.minutes >= DAY_START && nowLocal.minutes <= DAY_END;

  /** Time already gone: the whole day for a past date, everything before the clock for today. */
  const today = todayIn(salon.timezone);
  const pastCutoff = date < today ? DAY_END : date === today ? nowLocal.minutes : null;
  const isPast = (minutes: number) => pastCutoff !== null && minutes < pastCutoff;

  /** Opening hours for this date, by the same rule the booking engine uses. */
  const open = hours.data ? windowsForDate(date, hours.data.rules, hours.data.exceptions) : [];
  const closed = hours.data ? closedSpans(open) : [];

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
   * drawn under one would lie about where clicking lands, including under a
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
  /** Horizontal placement for one block, leaving a 6px gutter on each side. */
  const laneStyle = (id: string) => {
    const { lane, lanes } = laneOf.get(id) ?? { lane: 0, lanes: 1 };
    return {
      left: "calc(" + (lane * 100) / lanes + "% + 6px)",
      width: "calc(" + 100 / lanes + "% - 12px)",
    };
  };

  /** The service the form would use for this designer: what a new booking there would cost in time. */
  const serviceFor = (designerId: string): Service | null => {
    const list = services.data ?? [];
    const id = resolveServiceId(list, designerId, draft?.serviceId ?? null);
    return list.find((s) => s.id === id) ?? null;
  };
  const blockOf = (svc: Service | null) => (svc ? svc.durationMin + svc.bufferMin : snap);

  /**
   * The first existing appointment a booking of `blockMin` starting at
   * `minutes` would run into.
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
   * Only "free" cells are placeable, and only they get a hover preview.
   * Anywhere else the grid stays quiet rather than explaining itself.
   *  past     the time has gone.
   *  occupied the cursor is inside an appointment (or its cleanup buffer).
   *  nofit    the cell is free, but this service would run into the next appointment.
   */
  const cellState = (designerId: string, minutes: number): "past" | "occupied" | "nofit" | "free" => {
    if (isPast(minutes)) return "past";
    // Being inside a sharable block is not an obstacle: that spare lane is
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
      ? t("conflict.past", { time: f.minutes(ghost.minutes!) })
      : ghostClash && ghostService
        ? t("conflict.clash", {
            service: ghostService.name,
            duration: f.duration(ghostService.durationMin + ghostService.bufferMin),
            time: f.minutes(ghostClash.start),
          })
        : undefined;

  // The day in numbers, from the same appointments the grid shows.
  const live = dayAppts.filter((a) => a.status !== "CANCELLED");
  const cancelled = dayAppts.filter((a) => a.status === "CANCELLED");
  const bookedMin = live.reduce((sum, a) => sum + a.durationMin, 0);
  const openMin = open.reduce((sum, w) => sum + (w.endMinutes - w.startMinutes), 0) * columns.length;
  const stillToCome = live.filter((a) => new Date(a.startAt) > now).length;
  const upNext = live
    .filter((a) => date !== today || new Date(a.endAt) > now)
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 6);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.displayName ?? "";
  const select = (a: StaffAppointment) => {
    setDraft(null);
    setSelected(a);
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div role="toolbar" aria-label={t("toolbar.label")} className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-full bg-muted p-1 shadow-[inset_0_0_0_1px_var(--border)]">
          <Button variant="ghost" size="icon" className="size-10 hover:bg-surface-muted" aria-label={t("toolbar.prevDay")} onClick={() => setDate((d) => addDays(d, -1))}>
            <ChevronLeft aria-hidden />
          </Button>
          <Button variant="ghost" size="sm" className={ghostPillSm} disabled={date === today} onClick={() => setDate(today)}>
            {t("toolbar.today")}
          </Button>
          <Button variant="ghost" size="icon" className="size-10 hover:bg-surface-muted" aria-label={t("toolbar.nextDay")} onClick={() => setDate((d) => addDays(d, 1))}>
            <ChevronRight aria-hidden />
          </Button>
          <span className="mx-2 text-base font-semibold whitespace-nowrap" aria-live="polite">
            {f.localDate(date, "dayLong")}
          </span>
          {/* Jump to any date. The native picker does the work; the input stays in the tab order. */}
          <label className="relative mr-1 grid size-10 cursor-pointer place-items-center rounded-full hover:bg-surface-muted focus-within:ring-3 focus-within:ring-ring">
            <CalendarDays aria-hidden className="size-4" />
            <input
              ref={dateInput}
              type="date"
              aria-label={t("toolbar.goToDate")}
              className="absolute inset-0 cursor-pointer opacity-0"
              value={date}
              onClick={() => dateInput.current?.showPicker?.()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </label>
        </div>

        {allowed.length > 1 && (
          <div role="group" aria-label={t("toolbar.showDesigner")} className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1 shadow-[inset_0_0_0_1px_var(--border)]">
            {[{ id: null, displayName: t("toolbar.everyone") }, ...allowed].map((m) => {
              const pressed = (only === null && m.id === null) || (m.id !== null && columns.length === 1 && columns[0].id === m.id);
              return (
                <button
                  key={m.id ?? "all"}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => setOnly(m.id)}
                  className={cn(
                    "h-10 shrink-0 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
                    pressed ? "bg-primary text-primary-foreground" : "hover:bg-surface-muted",
                  )}
                >
                  {m.displayName}
                </button>
              );
            })}
          </div>
        )}

        <span className="hidden flex-1 md:block" />
        <label className="flex items-center gap-3 text-sm text-body">
          <input
            type="checkbox"
            className="size-5 accent-foreground"
            checked={showCancelled}
            onChange={(e) => setShowCancelled(e.target.checked)}
          />
          {t("toolbar.showCancelled")}
        </label>
        <Button className={pillButtonSm} onClick={() => openDraft(columns[0]?.id ?? "", null)} disabled={columns.length === 0}>
          <Plus aria-hidden />
          {t("toolbar.newAppointment")}
        </Button>
      </div>

      {columns.length === 0 ? (
        <p className="text-sm text-body">
          {t.rich("noDesigners", {
            link: (chunks) => (
              <Link href={`/s/${salon.id}/settings/team`} className={textLink}>
                {chunks}
              </Link>
            ),
          })}
        </p>
      ) : (
        !draft &&
        !selected && (
          <p className="-mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-body">
            <Info aria-hidden className="size-4 shrink-0" />
            {dayAppts.length ? t("hint.withAppointments") : t("hint.empty")}
            {isManager && (
              <Link href={`/s/${salon.id}/settings/hours`} className={textLink}>
                {t("hint.editHours")}
              </Link>
            )}
          </p>
        )
      )}

      <section aria-label={t("tiles.label")} className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-4">
        <Tile accent label={t("tiles.appointments")} value={String(live.length)}>
          {live.length === 0
            ? t("tiles.nothingBooked")
            : date < today
              ? t("tiles.completedCount", { count: live.filter((a) => a.status === "COMPLETED").length })
              : t("tiles.stillToCome", { count: stillToCome })}
        </Tile>
        <Tile label={t("tiles.booked")} value={f.duration(bookedMin)}>
          {openMin > 0
            ? t("tiles.ofOpen", { open: f.duration(openMin), count: columns.length })
            : hours.isSuccess
              ? t("tiles.closedDay")
              : " "}
        </Tile>
        <Tile label={t("tiles.openTime")} value={f.duration(Math.max(0, openMin - bookedMin))}>
          {t("tiles.freeInside")}
        </Tile>
        <Tile label={t("tiles.cancelled")} value={String(cancelled.length)}>
          {cancelled.length === 0 ? t("tiles.noneCancelled") : showCancelled ? t("tiles.cancelledShown") : t("tiles.cancelledHidden")}
        </Tile>
      </section>

      {/* The side column exists only while something is open in it, so an idle
          schedule gets the full width instead of a strip holding a hint. */}
      <div className={cn("grid gap-6", (draft || selected) && "lg:grid-cols-[minmax(0,1fr)_380px]")}>
        {columns.length > 0 && (
          <section aria-label={t("grid.label")} className="min-w-0 self-start">
            <div className="relative overflow-x-auto rounded-lg bg-card shadow-[inset_0_0_0_1px_var(--border)]">
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `5rem repeat(${columns.length}, minmax(180px, 1fr))`,
                  minWidth: `calc(5rem + ${columns.length * 180}px)`,
                }}
              >
                <div className="border-b border-border" />
                {columns.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 border-b border-border px-4 py-3 text-sm font-medium">
                    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-lavender text-xs font-semibold shadow-[inset_0_0_0_1px_var(--border)]">
                      {initials(m.displayName)}
                    </span>
                    <span className="truncate">{m.displayName}</span>
                    <span className="ml-auto text-[13px] font-normal whitespace-nowrap text-muted-foreground tabular-nums">
                      {t("grid.bookedCount", { count: live.filter((a) => a.designerId === m.id).length })}
                    </span>
                  </div>
                ))}

                <div className="relative" style={{ height: yFor(DAY_END) }}>
                  {hourMarks.slice(1).map((h) => (
                    <span
                      key={h}
                      className="absolute right-2.5 -translate-y-1/2 text-xs whitespace-nowrap text-muted-foreground tabular-nums"
                      style={{ top: yFor(h) }}
                    >
                      {f.hour(h)}
                    </span>
                  ))}
                </div>

                {columns.map((m, index) => {
                  const editable = canPlaceIn(m.id);
                  const svc = serviceFor(m.id);
                  return (
                    <div
                      key={m.id}
                      aria-label={m.displayName}
                      className={cn("relative border-l border-border", editable && "cursor-copy")}
                      style={{
                        height: yFor(DAY_END),
                        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${HOUR_PX - 1}px, var(--hour-rule) ${HOUR_PX - 1}px ${HOUR_PX}px)`,
                      }}
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
                      {/* Outside opening hours: hatched, still bookable by staff (walk-ins, favours). */}
                      {closed.map(([from, to]) => (
                        <div
                          key={from}
                          className="pointer-events-none absolute inset-x-0"
                          style={{
                            top: yFor(from),
                            height: (to - from) * PX_PER_MIN,
                            backgroundImage: "repeating-linear-gradient(135deg, var(--closed-hatch) 0 6px, transparent 6px 12px)",
                          }}
                        />
                      ))}

                      {/* Time that has gone: shaded and not placeable. Sits under the blocks so past appointments stay readable. */}
                      {pastCutoff !== null && (
                        <div
                          className="pointer-events-none absolute inset-x-0 top-0 bg-surface-muted/50"
                          style={{ height: Math.max(0, yFor(Math.min(pastCutoff, DAY_END))) }}
                        />
                      )}

                      {showNowLine && (
                        <div aria-hidden className="pointer-events-none absolute inset-x-0 z-30 h-0.5 bg-foreground" style={{ top: yFor(nowLocal.minutes) }}>
                          {index === 0 && <span className="absolute -top-1 -left-[5px] size-2.5 rounded-full bg-foreground" />}
                        </div>
                      )}

                      {hover && hover.designerId === m.id && !(ghost && ghost.designerId === m.id && ghost.minutes === hover.minutes) && (
                        <div
                          className="pointer-events-none absolute inset-x-1.5 overflow-hidden rounded-sm px-1.5 text-xs leading-tight shadow-[inset_0_0_0_1.5px_var(--foreground)]"
                          style={{ top: yFor(hover.minutes), height: Math.max(18, blockOf(svc) * PX_PER_MIN - 2) }}
                        >
                          {f.minutes(hover.minutes)}
                        </div>
                      )}

                      {ghost && ghost.designerId === m.id && (
                        <div
                          className={cn(
                            "pointer-events-none absolute inset-x-1.5 z-10 flex items-start gap-1 overflow-hidden rounded-sm px-1.5 py-1 text-xs font-medium leading-tight",
                            conflict
                              ? "border-[1.5px] border-dashed border-destructive bg-card text-destructive"
                              : "bg-lavender/60 shadow-[inset_0_0_0_2px_var(--foreground)]",
                          )}
                          style={{ top: yFor(ghost.minutes!), height: Math.max(22, blockOf(ghostService) * PX_PER_MIN - 2) }}
                        >
                          {conflict && <TriangleAlert aria-hidden className="size-3 shrink-0" />}
                          {ghostClash ? t("grid.ghostOverlaps") : conflict ? t("grid.ghostPast") : t("grid.ghostNew")} · {f.minutes(ghost.minutes!)}
                        </div>
                      )}

                      {visible
                        .filter((a) => a.designerId === m.id)
                        .map((a) => {
                          const start = utcToLocal(new Date(a.startAt), salon.timezone).minutes;
                          const top = Math.max(0, yFor(start));
                          const height = Math.max(22, a.durationMin * PX_PER_MIN - 2);
                          const blocking = a.status !== "CANCELLED";
                          const short = a.durationMin <= 30;
                          return (
                            <div key={a.id}>
                              {/* Cleanup time: nothing may be booked into it, so show it rather than leaving a deceptive gap. */}
                              {blocking && a.bufferMin > 0 && (
                                <div
                                  className="pointer-events-none absolute z-10 rounded-b-sm border-x border-b border-dashed border-(--cancelled-edge)"
                                  style={{ ...laneStyle(a.id), top: top + height, height: a.bufferMin * PX_PER_MIN }}
                                />
                              )}
                              <button
                                type="button"
                                aria-label={t("grid.block", {
                                  status: f.status(a.status),
                                  client: a.customer.name,
                                  service: a.serviceName,
                                  start: f.minutes(start),
                                  end: f.minutes(start + a.durationMin),
                                  source: a.source === "ONLINE" ? t("grid.sourceOnline") : t("grid.sourceStaff"),
                                })}
                                onClick={(e) => {
                                  e.stopPropagation(); // don't also place a draft under the block
                                  select(a);
                                }}
                                className={cn(
                                  "absolute z-20 flex cursor-pointer flex-col overflow-hidden rounded-sm px-2 text-left transition-shadow outline-none hover:shadow-[inset_0_0_0_1.5px_var(--foreground)] focus-visible:ring-3 focus-visible:ring-ring",
                                  short ? "justify-center" : "gap-px py-1",
                                  blockTone(a),
                                  selected?.id === a.id && "shadow-[inset_0_0_0_2px_var(--foreground)]",
                                )}
                                style={{ ...laneStyle(a.id), top, height }}
                              >
                                <span className="flex min-w-0 items-baseline gap-1.5">
                                  <span className="text-xs whitespace-nowrap text-body tabular-nums">{f.minutes(start)}</span>
                                  <span className="who truncate text-sm leading-tight font-medium">{a.customer.name}</span>
                                </span>
                                {!short && <span className="what truncate text-xs leading-tight text-body">{a.serviceName}</span>}
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>

              {appts.isSuccess && visible.length === 0 && (
                <div className="pointer-events-none absolute inset-0 top-14 grid place-items-center p-4">
                  <div className="grid justify-items-center gap-4 rounded-2xl bg-card px-8 py-6 shadow-[inset_0_0_0_1px_var(--border)]">
                    <Image src="/images/mona-binoculars.png" alt="" width={538} height={720} className="h-auto w-[120px] md:w-[150px]" />
                    <p className="flex items-center gap-2 rounded-full bg-butter px-6 py-3 text-sm font-medium">
                      <MousePointerClick aria-hidden className="size-4 shrink-0" />
                      {date < today ? t("grid.emptyPast") : t("grid.emptyFuture")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <ul aria-label={t("legend.label")} className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-body">
              <LegendItem className="bg-lavender">{t("legend.online")}</LegendItem>
              <LegendItem className="bg-butter shadow-[inset_0_0_0_1px_var(--border)]">{t("legend.staff")}</LegendItem>
              {/* The final states read the same words as the status pills and the panel badge. */}
              <LegendItem className="bg-surface-muted">{f.status("COMPLETED")}</LegendItem>
              <LegendItem className="bg-destructive/10">{f.status("NO_SHOW")}</LegendItem>
              <LegendItem className="border border-dashed border-(--cancelled-edge) bg-card">{f.status("CANCELLED")}</LegendItem>
              <LegendItem className="bg-[repeating-linear-gradient(135deg,var(--closed-hatch)_0_3px,transparent_3px_6px)] shadow-[inset_0_0_0_1px_var(--border)]">
                {t("legend.closed")}
              </LegendItem>
            </ul>
          </section>
        )}

        {(draft || selected) && (
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
        )}
      </div>

      {columns.length > 0 && (
        <section aria-labelledby="up-next" className="overflow-x-auto rounded-lg bg-muted p-4 shadow-[inset_0_0_0_1px_var(--border)] md:p-6">
          <h2 id="up-next" className="mb-4 text-[28px] leading-[1.3]">
            {date === today ? t("upNext.upNext") : t("upNext.thisDay")}
          </h2>
          {upNext.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("upNext.nothingElse")}</p>
          ) : (
            <UpNextTable rows={upNext} nameOf={nameOf} onSelect={select} timezone={salon.timezone} showDesigner={columns.length > 1} />
          )}
        </section>
      )}
    </div>
  );
}

/** A stat tile (DESIGN.md "Stat tiles"). The value is Geist, never the serif. */
function Tile({ label, value, accent, children }: { label: string; value: string; accent?: boolean; children: ReactNode }) {
  return (
    <div className={cn("grid content-start gap-2 rounded-lg p-4 md:p-6", accent ? "bg-lavender" : "bg-card shadow-[inset_0_0_0_1px_var(--border)]")}>
      <span className="text-sm font-medium">{label}</span>
      <span className="text-[28px] leading-[1.1] font-semibold tracking-[-0.02em] whitespace-nowrap tabular-nums md:text-4xl">{value}</span>
      <span className={cn("text-sm", accent ? "text-body" : "text-muted-foreground")}>{children}</span>
    </div>
  );
}

function LegendItem({ className, children }: { className: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden className={cn("size-3.5 rounded-xs", className)} />
      {children}
    </li>
  );
}

function UpNextTable({
  rows,
  nameOf,
  onSelect,
  timezone,
  showDesigner,
}: {
  rows: StaffAppointment[];
  nameOf: (designerId: string) => string;
  onSelect: (a: StaffAppointment) => void;
  timezone: string;
  showDesigner: boolean;
}) {
  const f = useFormat();
  const t = useTranslations("schedule.upNext");
  const th = "px-3 pb-3 text-left text-sm font-medium whitespace-nowrap text-muted-foreground";
  const td = "border-t border-border px-3 py-3 align-middle";
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr>
          <th className={th}>{t("time")}</th>
          <th className={th}>{t("client")}</th>
          <th className={th}>{t("service")}</th>
          {showDesigner && <th className={cn(th, "hidden sm:table-cell")}>{t("designer")}</th>}
          <th className={cn(th, "text-right")}>{t("length")}</th>
          <th className={th}>{t("status")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.id}>
            <td className={cn(td, "font-medium whitespace-nowrap tabular-nums")}>{f.inTz(a.startAt, timezone, "time")}</td>
            <td className={td}>
              <button type="button" className={cn(textLink, "text-left")} onClick={() => onSelect(a)}>
                {a.customer.name}
              </button>
            </td>
            <td className={td}>{a.serviceName}</td>
            {showDesigner && <td className={cn(td, "hidden sm:table-cell")}>{nameOf(a.designerId)}</td>}
            <td className={cn(td, "text-right whitespace-nowrap tabular-nums")}>{f.duration(a.durationMin)}</td>
            <td className={td}>
              <span
                className={cn(
                  "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
                  a.status === "COMPLETED" ? "bg-surface-muted" : a.source === "ONLINE" ? "bg-lavender" : "bg-butter shadow-[inset_0_0_0_1px_var(--border)]",
                )}
              >
                {f.status(a.status)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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
  const t = useTranslations("schedule.panel");
  const [value, setValue] = useState(() => centsToInput(tipCents));
  const parsed = parseTipDollars(value);
  const pct = tipCents !== null && priceCents > 0 ? Math.round((tipCents / priceCents) * 1000) / 10 : null;

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="appt-tip-saved">{t("tip")}</Label>
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
          {t("save")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {parsed === undefined ? t("tipInvalid") : pct !== null ? t("tipPct", { pct }) : t("tipNotRecorded")}
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
  const t = useTranslations("schedule.panel");
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
    <Card className="rounded-2xl bg-card ring-border">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2 font-display text-[22px] leading-tight font-medium tracking-[-0.01em]">
            {appt.customer.name}
            <Badge variant={open ? "default" : "outline"}>{f.status(appt.status)}</Badge>
          </CardTitle>
          <CardDescription>
            {t("summary", { service: appt.serviceName, price: f.cents(appt.priceCents), designer: designer ?? "" })}
            <br />
            {f.inTz(appt.startAt, salon.timezone)} – {f.inTz(appt.endAt, salon.timezone, "time")}
            {appt.bufferMin ? ` ${t("buffer", { duration: f.duration(appt.bufferMin) })}` : ""}
          </CardDescription>
        </div>
        <Button size="xs" variant="ghost" onClick={onClose}>
          {t("close")}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        {(appt.customer.email || appt.customer.phone) && (
          <p className="text-muted-foreground">{[appt.customer.email, appt.customer.phone].filter(Boolean).join(" · ")}</p>
        )}
        {appt.notes && (
          <p>
            <span className="text-muted-foreground">{t("customerNote")}</span> {appt.notes}
          </p>
        )}
        {appt.cancelReason && <p className="text-muted-foreground">{t("cancelledReason", { reason: appt.cancelReason })}</p>}
        <p className="text-xs text-muted-foreground">{appt.source === "ONLINE" ? t("bookedOnline") : t("bookedStaff")}</p>

        {canEdit && (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="appt-notes">{t("internalNotes")}</Label>
              <Input id="appt-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <Button
                size="xs"
                variant="outline"
                className="justify-self-start"
                disabled={update.isPending}
                onClick={() => update.mutate({ internalNotes: notes || null })}
              >
                {t("saveNotes")}
              </Button>
            </div>

            {open && (
              <>
                <div className="grid gap-1.5 border-t pt-4">
                  <Label htmlFor="appt-move-hour">{t("moveTo")}</Label>
                  {reschedule.isPending && timesChecked && (
                    <p className="text-xs text-muted-foreground">{t("findingTimes")}</p>
                  )}
                  {nothingOpen && (
                    <p className="text-xs text-muted-foreground">{t("nothingFits", { service: appt.serviceName })}</p>
                  )}
                  {chosen !== null && !nothingOpen && !(reschedule.isPending && timesChecked) && (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          id="appt-move-hour"
                          className={pillSelectSm}
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
                          aria-label={t("minutesPast")}
                          className={pillSelectSm}
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
                          {t("reschedule")}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {timesChecked ? t("onlyOpen") : t("serviceRemoved")}
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
                        {t("complete")}
                      </Button>
                    )}
                    {!confirmNoShow && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canNoShow || update.isPending}
                        onClick={() => setConfirmNoShow(true)}
                      >
                        {t("noShow")}
                      </Button>
                    )}
                  </div>
                  {!canComplete && (
                    <p className="text-xs text-muted-foreground">
                      {t("completeFrom", { time: f.inTz(completeFrom, salon.timezone, "time") })}
                    </p>
                  )}
                  {!canNoShow && (
                    <p className="text-xs text-muted-foreground">
                      {t("noShowFrom", { time: f.inTz(markableFrom, salon.timezone, "time"), grace: NO_SHOW_GRACE_MIN })}
                    </p>
                  )}
                  {confirmComplete && (
                    <div className="grid gap-3 rounded-lg bg-lavender p-3">
                      <p className="text-xs">{t("confirmComplete", { client: appt.customer.name, service: appt.serviceName })}</p>
                      <div className="grid gap-1.5">
                        <p className="text-xs text-muted-foreground">{t("howPaid")}</p>
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
                          {t("tipOptional")}
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
                        {tipCents === undefined && <p className="text-xs text-destructive">{t("enterAmount")}</p>}
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
                          {t("yesComplete")}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmComplete(false)}>
                          {t("notYet")}
                        </Button>
                      </div>
                    </div>
                  )}
                  {confirmNoShow && (
                    <div className="grid gap-2 rounded-lg bg-destructive/10 p-3">
                      <p className="text-xs">{t("confirmNoShow", { client: appt.customer.name })}</p>
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
                          {t("yesNoShow")}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmNoShow(false)}>
                          {t("keepBooked")}
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input placeholder={t("cancelReason")} value={reason} onChange={(e) => setReason(e.target.value)} />
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={update.isPending}
                      onClick={() => {
                        if (confirm(t("cancelConfirm"))) update.mutate({ status: "CANCELLED", cancelReason: reason || undefined });
                      }}
                    >
                      {t("cancel")}
                    </Button>
                  </div>
                </div>
              </>
            )}

            {appt.status === "COMPLETED" && (
              <div className="grid gap-3 border-t pt-4">
                <div className="grid gap-1.5">
                  <Label>{t("payment")}</Label>
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
                    {appt.paymentMethod ? t("tapToClear") : t("paymentNotRecorded")}
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
                  {t("undoNoShow")}
                </Button>
                <p className="text-xs text-muted-foreground">{t("undoHint")}</p>
              </div>
            )}
            <FieldError message={update.error instanceof ApiError ? update.error.message : undefined} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
