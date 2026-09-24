"use client";

import { updateSalonSchema, type Salon, type UpdateSalonInput } from "@reserivo/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { salonKeys, useSalon } from "@/lib/salon-context";

/** Salon identity and booking policies. Managers only; others see the values read-only. */
/** At most three may be picked; the shared schema enforces the same. */
const REMINDER_CHOICES = [48, 24, 2] as const;


export default function SettingsPage() {
  const { salon, isManager } = useSalon();
  const t = useTranslations("settings.salon");
  const reminderLabel = (hours: number) =>
    hours < 24 ? t("reminderHours", { hours }) : t("reminderDays", { days: hours / 24 });
  const queryClient = useQueryClient();
  const timezones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);

  const [form, setForm] = useState({
    name: salon.name,
    timezone: salon.timezone,
    slotIntervalMin: salon.slotIntervalMin,
    leadTimeMin: salon.leadTimeMin,
    maxAdvanceDays: salon.maxAdvanceDays,
    cancelWindowHours: salon.cancelWindowHours,
    reminderHoursBefore: salon.reminderHoursBefore,
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
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("linkStays", { slug: salon.slug })}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="st-name">{t("name")}</Label>
            <Input id="st-name" value={form.name} disabled={!isManager} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="st-tz">{t("timezone")}</Label>
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
            <p className="text-xs text-muted-foreground">{t("timezoneHint")}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("policies")}</CardTitle>
          <CardDescription>{t("policiesHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="st-slot">{t("slotGrid")}</Label>
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
              <Label htmlFor="st-lead">{t("leadTime")}</Label>
              <Input id="st-lead" type="number" min={0} step={15} value={form.leadTimeMin} disabled={!isManager} onChange={num("leadTimeMin")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="st-adv">{t("maxAdvance")}</Label>
              <Input id="st-adv" type="number" min={1} max={365} value={form.maxAdvanceDays} disabled={!isManager} onChange={num("maxAdvanceDays")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="st-cancel">{t("cancelWindow")}</Label>
              <Input id="st-cancel" type="number" min={0} max={336} value={form.cancelWindowHours} disabled={!isManager} onChange={num("cancelWindowHours")} />
            </div>
          </div>
          <div className="grid gap-2 border-t pt-4">
            <Label>{t("reminders")}</Label>
            <p className="text-xs text-muted-foreground">{t("remindersHint")}</p>
            {REMINDER_CHOICES.map((hours) => (
              <label key={hours} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={!isManager}
                  checked={form.reminderHoursBefore.includes(hours)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      reminderHoursBefore: e.target.checked
                        ? [...form.reminderHoursBefore, hours].sort((a, b) => b - a)
                        : form.reminderHoursBefore.filter((h) => h !== hours),
                    })
                  }
                />
                {reminderLabel(hours)}
              </label>
            ))}
            {form.reminderHoursBefore.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("noReminders")}</p>
            )}
          </div>

          {isManager && (
            <>
              <FieldError message={error ?? (save.error instanceof ApiError ? save.error.message : undefined)} />
              <Button onClick={submit} disabled={save.isPending} className="justify-self-start">
                {save.isPending ? t("saving") : save.isSuccess && !save.isPending ? t("saved") : t("save")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
