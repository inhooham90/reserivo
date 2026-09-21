"use client";

import {
  createAvailabilityExceptionSchema,
  hhmmToMinutes,
  minutesToHHMM,
  replaceAvailabilityRulesSchema,
  type Availability,
  type AvailabilityException,
  type AvailabilityRule,
  type AvailabilityRuleInput,
} from "@reserivo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { formatLocalDate, WEEKDAYS } from "@/lib/format";
import { salonKeys, useSalon } from "@/lib/salon-context";

/** Display order Mon…Sun; stored weekday numbers stay 0=Sun. */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function HoursPage() {
  const { salon, members, me, isManager } = useSalon();
  const [memberId, setMemberId] = useState<string>(me?.id ?? members[0]?.id ?? "");
  const canEdit = isManager || me?.id === memberId;

  const availability = useQuery({
    queryKey: salonKeys.availability(salon.id, memberId),
    queryFn: () => api<Availability>(`/salons/${salon.id}/members/${memberId}/availability`),
    enabled: Boolean(memberId),
  });

  return (
    <div className="grid gap-6">
      {isManager && members.length > 1 && (
        <div className="flex items-center gap-3">
          <Label htmlFor="hours-member">Schedule for</Label>
          <select
            id="hours-member"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>
      )}
      {availability.isPending && <p className="text-muted-foreground">Loading…</p>}
      {availability.data && (
        <div className="grid gap-6 md:grid-cols-[1fr_380px]">
          <WeeklyEditor
            key={memberId}
            salonId={salon.id}
            memberId={memberId}
            rules={availability.data.rules}
            canEdit={canEdit}
            timezone={salon.timezone}
          />
          <Exceptions salonId={salon.id} memberId={memberId} exceptions={availability.data.exceptions} canEdit={canEdit} />
        </div>
      )}
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
  salonId,
  memberId,
  rules,
  canEdit,
  timezone,
}: {
  salonId: string;
  memberId: string;
  rules: AvailabilityRule[];
  canEdit: boolean;
  timezone: string;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => toDraft(rules));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setDraft(toDraft(rules)), [rules]);

  const save = useMutation({
    mutationFn: (input: { rules: AvailabilityRuleInput[] }) =>
      api<AvailabilityRule[]>(`/salons/${salonId}/members/${memberId}/availability/rules`, { method: "PUT", json: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: salonKeys.availability(salonId, memberId) }),
  });

  const update = (wd: number, i: number, patch: Partial<{ start: string; end: string }>) =>
    setDraft((d) => ({ ...d, [wd]: d[wd].map((w, j) => (j === i ? { ...w, ...patch } : w)) }));
  const add = (wd: number) => setDraft((d) => ({ ...d, [wd]: [...d[wd], { start: "09:00", end: "17:00" }] }));
  const removeWin = (wd: number, i: number) => setDraft((d) => ({ ...d, [wd]: d[wd].filter((_, j) => j !== i) }));

  const submit = () => {
    setError(null);
    const flat: AvailabilityRuleInput[] = [];
    for (const wd of DISPLAY_ORDER) {
      for (const w of draft[wd]) {
        flat.push({ weekday: wd, startMinutes: hhmmToMinutes(w.start), endMinutes: hhmmToMinutes(w.end) });
      }
    }
    // Same schema the API enforces, so the user sees the real error before a round trip.
    const parsed = replaceAvailabilityRulesSchema.safeParse({ rules: flat });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const idx = typeof issue.path[1] === "number" ? issue.path[1] : null;
      const day = idx !== null ? WEEKDAYS[flat[idx].weekday] : "";
      setError(`${day ? day + ": " : ""}${issue.message}`);
      return;
    }
    save.mutate(parsed.data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly hours</CardTitle>
        <CardDescription>Local time in {timezone}. Add a second window for a split shift.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {DISPLAY_ORDER.map((wd) => (
          <div key={wd} className="grid grid-cols-[6rem_1fr] items-start gap-3 border-b pb-3 last:border-0 last:pb-0">
            <div className="pt-1.5 text-sm font-medium">{WEEKDAYS[wd]}</div>
            <div className="grid gap-2">
              {draft[wd].length === 0 && <p className="pt-1.5 text-sm text-muted-foreground">Off</p>}
              {draft[wd].map((w, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Input
                    type="time"
                    step={300}
                    className="w-32"
                    value={w.start}
                    disabled={!canEdit}
                    onChange={(e) => update(wd, i, { start: e.target.value })}
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="time"
                    step={300}
                    className="w-32"
                    value={w.end}
                    disabled={!canEdit}
                    onChange={(e) => update(wd, i, { end: e.target.value })}
                  />
                  {canEdit && (
                    <Button size="xs" variant="ghost" onClick={() => removeWin(wd, i)}>
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              {canEdit && (
                <Button size="xs" variant="outline" className="justify-self-start" onClick={() => add(wd)}>
                  {draft[wd].length ? "Add window" : "Add hours"}
                </Button>
              )}
            </div>
          </div>
        ))}
        {canEdit && (
          <>
            <FieldError message={error ?? (save.error instanceof ApiError ? save.error.message : undefined)} />
            <Button onClick={submit} disabled={save.isPending} className="justify-self-start">
              {save.isPending ? "Saving…" : "Save weekly hours"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Exceptions({
  salonId,
  memberId,
  exceptions,
  canEdit,
}: {
  salonId: string;
  memberId: string;
  exceptions: AvailabilityException[];
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: salonKeys.availability(salonId, memberId) });
  const [date, setDate] = useState("");
  const [type, setType] = useState<"OFF" | "CUSTOM">("OFF");
  const [start, setStart] = useState("10:00");
  const [end, setEnd] = useState("14:00");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: (json: unknown) =>
      api<AvailabilityException>(`/salons/${salonId}/members/${memberId}/availability/exceptions`, { method: "POST", json }),
    onSuccess: () => {
      setDate("");
      setNote("");
      void invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) =>
      api<void>(`/salons/${salonId}/members/${memberId}/availability/exceptions/${id}`, { method: "DELETE" }),
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
        <CardTitle>Days off & changes</CardTitle>
        <CardDescription>Overrides the weekly hours for one date.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {exceptions.length === 0 && <p className="text-sm text-muted-foreground">Nothing upcoming.</p>}
        {exceptions.map((x) => (
          <div key={x.id} className="flex items-center justify-between gap-2 text-sm">
            <span>
              <span className="font-medium">{formatLocalDate(x.date)}</span>{" "}
              <span className="text-muted-foreground">
                · {x.type === "OFF" ? "Off" : `${minutesToHHMM(x.startMinutes!)}–${minutesToHHMM(x.endMinutes!)}`}
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
                <Label htmlFor="exc-date">Date</Label>
                <Input id="exc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="exc-type">Type</Label>
                <select
                  id="exc-type"
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={type}
                  onChange={(e) => setType(e.target.value as "OFF" | "CUSTOM")}
                >
                  <option value="OFF">Day off</option>
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
              <Label htmlFor="exc-note">Note</Label>
              <Input id="exc-note" placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
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
