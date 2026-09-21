"use client";

import {
  createAvailabilityExceptionSchema,
  findOutsideSalonHours,
  hhmmToMinutes,
  minutesToHHMM,
  replaceAvailabilityRulesSchema,
  type Availability,
  type AvailabilityException,
  type AvailabilityRule,
  type AvailabilityRuleInput,
  type SalonHours,
} from "@reserivo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { useFormat } from "@/lib/use-format";
import { salonKeys, useSalon } from "@/lib/salon-context";

/** Display order Mon…Sun; stored weekday numbers stay 0=Sun. */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * Hours has two layers. The salon's opening hours are shared and manager-edited.
 * Designers keep personal hours inside them. Managers have no personal hours —
 * they work the salon's.
 */
export default function HoursPage() {
  const { salon, members, me, isManager } = useSalon();
  const designers = members.filter((m) => m.roles.includes("DESIGNER"));
  const meDesigner = Boolean(me?.roles.includes("DESIGNER"));
  const [memberId, setMemberId] = useState<string>(meDesigner ? me!.id : (designers[0]?.id ?? ""));

  const salonHours = useQuery({
    queryKey: salonKeys.hours(salon.id),
    queryFn: () => api<SalonHours>(`/salons/${salon.id}/hours`),
  });
  const availability = useQuery({
    queryKey: salonKeys.availability(salon.id, memberId),
    queryFn: () => api<Availability>(`/salons/${salon.id}/members/${memberId}/availability`),
    enabled: Boolean(memberId),
  });

  const canEditMember = isManager || me?.id === memberId;
  const selected = members.find((m) => m.id === memberId);

  return (
    <div className="grid gap-8">
      <section className="grid gap-4">
        <div>
          <h2 className="text-lg">Salon hours</h2>
          <p className="text-sm text-muted-foreground">
            When the shop is open, in {salon.timezone}. Everyone who takes appointments schedules inside these.
          </p>
        </div>
        {salonHours.data && (
          <div className="grid gap-6 md:grid-cols-[1fr_380px]">
            <WeeklyEditor
              key={`salon:${salonHours.data.rules.map((r) => r.id).join(",")}`}
              title="Opening hours"
              description="Add a second window for a lunch closure."
              rules={salonHours.data.rules}
              canEdit={isManager}
              endpoint={`/salons/${salon.id}/hours/rules`}
              invalidateKeys={[salonKeys.hours(salon.id), ["salons", salon.id, "availability"]]}
            />
            <Exceptions
              title="Closures & special days"
              description="Holidays, early closes, one-off openings. Applies to everyone."
              exceptions={salonHours.data.exceptions}
              canEdit={isManager}
              endpoint={`/salons/${salon.id}/hours/exceptions`}
              invalidateKeys={[salonKeys.hours(salon.id), ["salons", salon.id, "availability"]]}
            />
          </div>
        )}
      </section>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg">Designer hours</h2>
            <p className="text-sm text-muted-foreground">
              {isManager
                ? meDesigner
                  ? "Your hours and your team’s. Each schedule must fit inside the salon hours."
                  : "You don’t take appointments. Set each designer’s schedule here."
                : "Your working hours. They must fit inside the salon hours."}
            </p>
          </div>
          {isManager && designers.length > 1 && (
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
            >
              {designers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          )}
        </div>

        {designers.length === 0 && (
          <p className="text-sm text-muted-foreground">Nobody takes appointments yet — give someone the Designer role from the Team tab.</p>
        )}
        {memberId && availability.isPending && <p className="text-muted-foreground">Loading…</p>}
        {memberId && availability.data && salonHours.data && (
          <div className="grid gap-6 md:grid-cols-[1fr_380px]">
            <WeeklyEditor
              key={`${memberId}:${availability.data.rules.map((r) => r.id).join(",")}`}
              title={selected ? `${selected.displayName}’s week` : "Weekly hours"}
              description="Salon hours are shown under each day as the limit."
              rules={availability.data.rules}
              bounds={salonHours.data.rules}
              canEdit={canEditMember}
              endpoint={`/salons/${salon.id}/members/${memberId}/availability/rules`}
              invalidateKeys={[salonKeys.availability(salon.id, memberId)]}
            />
            <Exceptions
              title="Days off & changes"
              description="Overrides the weekly hours for one date, within the salon’s hours."
              exceptions={availability.data.exceptions}
              canEdit={canEditMember}
              endpoint={`/salons/${salon.id}/members/${memberId}/availability/exceptions`}
              invalidateKeys={[salonKeys.availability(salon.id, memberId)]}
            />
          </div>
        )}
      </section>
    </div>
  );
}

type Draft = Record<number, { start: string; end: string }[]>;

function toDraft(rules: AvailabilityRule[]): Draft {
  const d: Draft = {};
  for (const wd of DISPLAY_ORDER) d[wd] = [];
  for (const r of rules) d[r.weekday].push({ start: minutesToHHMM(r.startMinutes), end: minutesToHHMM(r.endMinutes) });
  return d;
}

function WeeklyEditor({
  title,
  description,
  rules,
  bounds,
  canEdit,
  endpoint,
  invalidateKeys,
}: {
  title: string;
  description: string;
  rules: AvailabilityRule[];
  /** Salon hours, when editing a designer: shown per day and validated client-side. */
  bounds?: AvailabilityRule[];
  canEdit: boolean;
  endpoint: string;
  invalidateKeys: readonly (readonly string[])[];
}) {
  const f = useFormat();
  // Indexed 0 = Sunday, matching the stored `weekday` column and DISPLAY_ORDER.
  const weekdays = f.weekdays();
  const queryClient = useQueryClient();
  // The parent keys this component on the saved rule ids, so a successful save remounts it with a fresh draft.
  const [draft, setDraft] = useState<Draft>(() => toDraft(rules));
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (input: { rules: AvailabilityRuleInput[] }) => api<AvailabilityRule[]>(endpoint, { method: "PUT", json: input }),
    onSuccess: () => invalidateKeys.forEach((k) => queryClient.invalidateQueries({ queryKey: [...k] })),
  });

  const update = (wd: number, i: number, patch: Partial<{ start: string; end: string }>) =>
    setDraft((d) => ({ ...d, [wd]: d[wd].map((w, j) => (j === i ? { ...w, ...patch } : w)) }));
  const add = (wd: number) => {
    const b = bounds?.filter((r) => r.weekday === wd)[0];
    const start = b ? minutesToHHMM(b.startMinutes) : "09:00";
    const end = b ? minutesToHHMM(b.endMinutes) : "17:00";
    setDraft((d) => ({ ...d, [wd]: [...d[wd], { start, end }] }));
  };
  const removeWin = (wd: number, i: number) => setDraft((d) => ({ ...d, [wd]: d[wd].filter((_, j) => j !== i) }));

  const submit = () => {
    setError(null);
    const flat: AvailabilityRuleInput[] = [];
    for (const wd of DISPLAY_ORDER) {
      for (const w of draft[wd]) flat.push({ weekday: wd, startMinutes: hhmmToMinutes(w.start), endMinutes: hhmmToMinutes(w.end) });
    }
    // Same checks the API runs, so the user sees the real error before a round trip.
    const parsed = replaceAvailabilityRulesSchema.safeParse({ rules: flat });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const idx = typeof issue.path[1] === "number" ? issue.path[1] : null;
      setError(`${idx !== null ? weekdays[flat[idx].weekday] + ": " : ""}${issue.message}`);
      return;
    }
    if (bounds) {
      const outside = findOutsideSalonHours(flat, bounds);
      if (outside) {
        const lim = outside.salonWindows.map((w) => `${f.minutes(w.startMinutes)}–${f.minutes(w.endMinutes)}`).join(", ") || "closed";
        setError(`${weekdays[outside.rule.weekday]}: outside salon hours (${lim}).`);
        return;
      }
    }
    save.mutate(parsed.data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {DISPLAY_ORDER.map((wd) => {
          const dayBounds = bounds?.filter((r) => r.weekday === wd) ?? [];
          const closed = bounds !== undefined && dayBounds.length === 0;
          return (
            <div key={wd} className="grid grid-cols-[6rem_1fr] items-start gap-3 border-b pb-3 last:border-0 last:pb-0">
              <div className="pt-1.5 text-sm">
                <div className="font-medium">{weekdays[wd]}</div>
                {bounds && (
                  <div className="text-xs text-muted-foreground">
                    {closed ? "Salon closed" : dayBounds.map((b) => `${f.minutes(b.startMinutes)}–${f.minutes(b.endMinutes)}`).join(", ")}
                  </div>
                )}
              </div>
              <div className="grid gap-2">
                {draft[wd].length === 0 && <p className="pt-1.5 text-sm text-muted-foreground">{closed ? "—" : "Off"}</p>}
                {draft[wd].map((w, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <Input type="time" step={300} className="w-32" value={w.start} disabled={!canEdit} onChange={(e) => update(wd, i, { start: e.target.value })} />
                    <span className="text-muted-foreground">–</span>
                    <Input type="time" step={300} className="w-32" value={w.end} disabled={!canEdit} onChange={(e) => update(wd, i, { end: e.target.value })} />
                    {canEdit && (
                      <Button size="xs" variant="ghost" onClick={() => removeWin(wd, i)}>
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                {canEdit && !closed && (
                  <Button size="xs" variant="outline" className="justify-self-start" onClick={() => add(wd)}>
                    {draft[wd].length ? "Add window" : "Add hours"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {canEdit && (
          <>
            <FieldError message={error ?? (save.error instanceof ApiError ? save.error.message : undefined)} />
            <Button onClick={submit} disabled={save.isPending} className="justify-self-start">
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Exceptions({
  title,
  description,
  exceptions,
  canEdit,
  endpoint,
  invalidateKeys,
}: {
  title: string;
  description: string;
  exceptions: AvailabilityException[];
  canEdit: boolean;
  endpoint: string;
  invalidateKeys: readonly (readonly string[])[];
}) {
  const f = useFormat();
  const queryClient = useQueryClient();
  const invalidate = () => invalidateKeys.forEach((k) => queryClient.invalidateQueries({ queryKey: [...k] }));
  const [date, setDate] = useState("");
  const [type, setType] = useState<"OFF" | "CUSTOM">("OFF");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("14:00");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: (json: unknown) => api<AvailabilityException>(endpoint, { method: "POST", json }),
    onSuccess: () => {
      setDate("");
      setNote("");
      invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api<void>(`${endpoint}/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const submit = () => {
    setError(null);
    const parsed = createAvailabilityExceptionSchema.safeParse({
      date,
      type,
      ...(type === "CUSTOM" ? { startMinutes: hhmmToMinutes(start), endMinutes: hhmmToMinutes(end) } : {}),
      note: note || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    add.mutate(parsed.data);
  };

  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {exceptions.length === 0 && <p className="text-sm text-muted-foreground">Nothing upcoming.</p>}
        {exceptions.map((x) => (
          <div key={x.id} className="flex items-center justify-between gap-2 text-sm">
            <span>
              <span className="font-medium">{f.localDate(x.date)}</span>{" "}
              <span className="text-muted-foreground">
                · {x.type === "OFF" ? "Closed" : `${f.minutes(x.startMinutes!)}–${f.minutes(x.endMinutes!)}`}
                {x.note ? ` · ${x.note}` : ""}
              </span>
            </span>
            {canEdit && (
              <Button size="xs" variant="ghost" onClick={() => remove.mutate(x.id)} disabled={remove.isPending}>
                Remove
              </Button>
            )}
          </div>
        ))}
        {canEdit && (
          <div className="grid gap-3 border-t pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor={`${title}-date`}>Date</Label>
                <Input id={`${title}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`${title}-type`}>Type</Label>
                <select
                  id={`${title}-type`}
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={type}
                  onChange={(e) => setType(e.target.value as "OFF" | "CUSTOM")}
                >
                  <option value="OFF">Closed / day off</option>
                  <option value="CUSTOM">Custom hours</option>
                </select>
              </div>
            </div>
            {type === "CUSTOM" && (
              <div className="flex items-center gap-2">
                <Input type="time" step={300} className="w-32" value={start} onChange={(e) => setStart(e.target.value)} />
                <span className="text-muted-foreground">–</span>
                <Input type="time" step={300} className="w-32" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor={`${title}-note`}>Note</Label>
              <Input id={`${title}-note`} placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <FieldError message={error ?? (add.error instanceof ApiError ? add.error.message : undefined)} />
            <Button size="sm" onClick={submit} disabled={add.isPending || !date} className="justify-self-start">
              {add.isPending ? "Adding…" : "Add"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
