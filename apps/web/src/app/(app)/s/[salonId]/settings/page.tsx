"use client";

import { updateSalonSchema, type Salon, type UpdateSalonInput } from "@reserivo/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { salonKeys, useSalon } from "@/lib/salon-context";

/** Salon identity and booking policies. Managers only; others see the values read-only. */
export default function SettingsPage() {
  const { salon, isManager } = useSalon();
  const queryClient = useQueryClient();
  const timezones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);

  const [form, setForm] = useState({
    name: salon.name,
    timezone: salon.timezone,
    slotIntervalMin: salon.slotIntervalMin,
    leadTimeMin: salon.leadTimeMin,
    maxAdvanceDays: salon.maxAdvanceDays,
    cancelWindowHours: salon.cancelWindowHours,
  });
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (input: UpdateSalonInput) => api<Salon>(`/salons/${salon.id}`, { method: "PATCH", json: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: salonKeys.salon(salon.id) });
      void queryClient.invalidateQueries({ queryKey: ["salons", "mine"] });
    },
  });

  const submit = () => {
    setError(null);
    const parsed = updateSalonSchema.safeParse(form);
    if (!parsed.success) {
      setError(`${parsed.error.issues[0].path.join(".")}: ${parsed.error.issues[0].message}`);
      return;
    }
    save.mutate(parsed.data);
  };

  const num = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.valueAsNumber });

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Salon</CardTitle>
          <CardDescription>Your booking link stays /{salon.slug}.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="st-name">Name</Label>
            <Input id="st-name" value={form.name} disabled={!isManager} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="st-tz">Time zone</Label>
            <select
              id="st-tz"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={form.timezone}
              disabled={!isManager}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Working hours are wall-clock times in this zone.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Booking policies</CardTitle>
          <CardDescription>What customers may do on the public page.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="st-slot">Slot grid (min)</Label>
              <select
                id="st-slot"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.slotIntervalMin}
                disabled={!isManager}
                onChange={(e) => setForm({ ...form, slotIntervalMin: Number(e.target.value) })}
              >
                {[5, 10, 15, 20, 30, 45, 60].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="st-lead">Minimum notice (min)</Label>
              <Input id="st-lead" type="number" min={0} step={15} value={form.leadTimeMin} disabled={!isManager} onChange={num("leadTimeMin")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="st-adv">Book up to (days ahead)</Label>
              <Input id="st-adv" type="number" min={1} max={365} value={form.maxAdvanceDays} disabled={!isManager} onChange={num("maxAdvanceDays")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="st-cancel">Free cancel until (hours before)</Label>
              <Input id="st-cancel" type="number" min={0} max={336} value={form.cancelWindowHours} disabled={!isManager} onChange={num("cancelWindowHours")} />
            </div>
          </div>
          {isManager && (
            <>
              <FieldError message={error ?? (save.error instanceof ApiError ? save.error.message : undefined)} />
              <Button onClick={submit} disabled={save.isPending} className="justify-self-start">
                {save.isPending ? "Saving…" : save.isSuccess && !save.isPending ? "Saved" : "Save settings"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
