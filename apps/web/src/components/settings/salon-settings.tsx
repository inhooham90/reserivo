"use client";

import { updateSalonSchema, type Salon, type UpdateSalonInput } from "@reserivo/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FieldError } from "@/components/field-error";
import { useSettingsDialog } from "@/components/settings/settings-dialog";
import { SettingsRow, SettingsRows, SettingsSection, Switch, WithUnit } from "@/components/settings/settings-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { salonKeys, useSalon } from "@/lib/salon-context";
import { ghostPillSm, pillButtonSm, pillInputSm, pillSelectSm } from "@/lib/v3";
import { cn } from "cn";

/** At most three may be picked; the shared schema enforces the same. */
const REMINDER_CHOICES = [48, 24, 2] as const;

type Form = Pick<
  Salon,
  "name" | "timezone" | "slotIntervalMin" | "leadTimeMin" | "maxAdvanceDays" | "cancelWindowHours" | "reminderHoursBefore"
>;

const fromSalon = (s: Salon): Form => ({
  name: s.name,
  timezone: s.timezone,
  slotIntervalMin: s.slotIntervalMin,
  leadTimeMin: s.leadTimeMin,
  maxAdvanceDays: s.maxAdvanceDays,
  cancelWindowHours: s.cancelWindowHours,
  reminderHoursBefore: s.reminderHoursBefore,
});

/** Salon identity, booking policies and reminders. Managers only; others see the values read-only. */
export default function SalonSettings() {
  const { salon, isManager } = useSalon();
  const { close, footer } = useSettingsDialog();
  const t = useTranslations("settings.salon");
  const dialog = useTranslations("settings.dialog");
  const common = useTranslations("common");
  const reminderLabel = (hours: number) =>
    hours < 24 ? t("reminderHours", { hours }) : t("reminderDays", { days: hours / 24 });
  const queryClient = useQueryClient();
  const timezones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);

  const [form, setForm] = useState<Form>(() => fromSalon(salon));
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(fromSalon(salon));

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

  const num = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    save.reset();
    setForm({ ...form, [key]: e.target.valueAsNumber });
  };
  const set = (patch: Partial<Form>) => {
    save.reset();
    setForm({ ...form, ...patch });
  };
  const numberInput = cn(pillInputSm, "text-right tabular-nums");

  const status = save.isPending
    ? t("saving")
    : dirty
      ? dialog("unsaved")
      : save.isSuccess
        ? t("saved")
        : null;

  return (
    <div className="grid gap-8">
      <SettingsSection title={t("title")} hint={t("linkStays", { slug: salon.slug })}>
        <SettingsRows>
          <SettingsRow label={t("name")} htmlFor="st-name">
            <Input id="st-name" className={pillInputSm} value={form.name} disabled={!isManager} onChange={(e) => set({ name: e.target.value })} />
          </SettingsRow>
          <SettingsRow label={t("timezone")} htmlFor="st-tz" description={t("timezoneHint")}>
            <select
              id="st-tz"
              className={cn(pillSelectSm, "w-full")}
              value={form.timezone}
              disabled={!isManager}
              onChange={(e) => set({ timezone: e.target.value })}
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </SettingsRow>
        </SettingsRows>
      </SettingsSection>

      <SettingsSection title={t("policies")} hint={t("policiesHint")}>
        <SettingsRows>
          <SettingsRow label={t("slotGrid")} htmlFor="st-slot" description={t("slotGridHint")}>
            <WithUnit unit={t("unitMinutes")}>
            <select
              id="st-slot"
              className={cn(pillSelectSm, "w-full")}
              value={form.slotIntervalMin}
              disabled={!isManager}
              onChange={(e) => set({ slotIntervalMin: Number(e.target.value) })}
            >
              {[5, 10, 15, 20, 30, 45, 60].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            </WithUnit>
          </SettingsRow>
          <SettingsRow label={t("leadTime")} htmlFor="st-lead" description={t("leadTimeHint")}>
            <WithUnit unit={t("unitMinutes")}>
              <Input id="st-lead" className={numberInput} type="number" min={0} step={15} inputMode="numeric" value={form.leadTimeMin} disabled={!isManager} onChange={num("leadTimeMin")} />
            </WithUnit>
          </SettingsRow>
          <SettingsRow label={t("maxAdvance")} htmlFor="st-adv" description={t("maxAdvanceHint")}>
            <WithUnit unit={t("unitDays")}>
              <Input id="st-adv" className={numberInput} type="number" min={1} max={365} inputMode="numeric" value={form.maxAdvanceDays} disabled={!isManager} onChange={num("maxAdvanceDays")} />
            </WithUnit>
          </SettingsRow>
          <SettingsRow label={t("cancelWindow")} htmlFor="st-cancel" description={t("cancelWindowHint")}>
            <WithUnit unit={t("unitHours")}>
              <Input id="st-cancel" className={numberInput} type="number" min={0} max={336} inputMode="numeric" value={form.cancelWindowHours} disabled={!isManager} onChange={num("cancelWindowHours")} />
            </WithUnit>
          </SettingsRow>
        </SettingsRows>
      </SettingsSection>

      <SettingsSection title={t("reminders")} hint={t("remindersHint")}>
        <SettingsRows>
          {REMINDER_CHOICES.map((hours) => (
            <SettingsRow key={hours} compact label={reminderLabel(hours)} htmlFor={`st-rem-${hours}`}>
              <Switch
                id={`st-rem-${hours}`}
                disabled={!isManager}
                checked={form.reminderHoursBefore.includes(hours)}
                onChange={(e) =>
                  set({
                    reminderHoursBefore: e.target.checked
                      ? [...form.reminderHoursBefore, hours].sort((a, b) => b - a)
                      : form.reminderHoursBefore.filter((h) => h !== hours),
                  })
                }
              />
            </SettingsRow>
          ))}
        </SettingsRows>
        {form.reminderHoursBefore.length === 0 && <p className="text-sm text-muted-foreground">{t("noReminders")}</p>}
      </SettingsSection>

      {/* Pinned under the scrolling body, as in the design; only a manager can save. */}
      {isManager &&
        footer &&
        createPortal(
          <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3 md:px-8 md:py-4">
            <div aria-live="polite" className="mr-auto flex min-w-0 items-center gap-1.5 text-sm text-body">
              {!dirty && save.isSuccess && <CircleCheck aria-hidden className="size-[18px]" />}
              {error || save.error ? (
                <FieldError message={error ?? (save.error instanceof ApiError ? save.error.message : undefined)} />
              ) : (
                status
              )}
            </div>
            <Button variant="ghost" className={ghostPillSm} onClick={close}>
              {common("cancel")}
            </Button>
            <Button className={pillButtonSm} onClick={submit} disabled={!dirty || save.isPending}>
              {save.isPending ? t("saving") : t("save")}
            </Button>
          </div>,
          footer,
        )}
    </div>
  );
}
