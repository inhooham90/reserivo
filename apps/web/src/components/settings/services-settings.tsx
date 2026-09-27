"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { canAllowDoubleBooking, createServiceSchema, DOUBLE_BOOKING_MIN_DURATION_MIN, type Service } from "@reserivo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { FieldError } from "@/components/field-error";
import { SettingsRow, SettingsRows, SettingsSection, Switch } from "@/components/settings/settings-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { useFormat } from "@/lib/use-format";
import { salonKeys, useSalon } from "@/lib/salon-context";
import { ghostPillSm, outlinePillSm, pillButtonSm, pillInputSm, pillSelectSm } from "@/lib/v3";
import { cn } from "cn";

/** The form works in dollars; the API takes cents. */
const formSchema = createServiceSchema.omit({ designerId: true, priceCents: true }).extend({
  priceDollars: z.number().min(0).max(10_000),
});
type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

const chip = "inline-flex h-6 items-center rounded-full border border-border px-2.5 text-xs font-medium";

export default function ServicesSettings() {
  const { salon, members, me, isManager } = useSalon();
  const f = useFormat();
  const t = useTranslations("settings.services");
  const settings = useTranslations("settings");
  const common = useTranslations("common");
  const designers = members.filter((m) => m.roles.includes("DESIGNER"));
  const [designerId, setDesignerId] = useState<string>(
    me && me.roles.includes("DESIGNER") ? me.id : (designers[0]?.id ?? ""),
  );
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const queryClient = useQueryClient();

  const services = useQuery({
    queryKey: salonKeys.services(salon.id),
    queryFn: () => api<Service[]>(`/salons/${salon.id}/services`),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: salonKeys.services(salon.id) });

  const remove = useMutation({
    mutationFn: (id: string) => api<void>(`/salons/${salon.id}/services/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const mine = services.data?.filter((s) => s.designerId === designerId) ?? [];
  const canEdit = isManager || me?.id === designerId;
  const selected = designers.find((m) => m.id === designerId);

  if (designers.length === 0) return <p className="text-sm text-muted-foreground">{settings("noDesigners")}</p>;

  const addButton = canEdit && !editing && (
    <Button className={pillButtonSm} onClick={() => setEditing("new")}>
      <Plus aria-hidden />
      {t("add")}
    </Button>
  );

  return (
    <div className="grid gap-8">
      <SettingsSection
        title={selected ? t("forDesigner", { name: selected.displayName }) : t("title")}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {isManager && designers.length > 1 && (
              <select
                aria-label={t("designer")}
                className={pillSelectSm}
                value={designerId}
                onChange={(e) => {
                  setDesignerId(e.target.value);
                  setEditing(null);
                }}
              >
                {designers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            )}
            {mine.length > 0 && addButton}
          </div>
        }
      >
        {editing && (
          <ServiceForm
            key={editing === "new" ? "new" : editing.id}
            salonId={salon.id}
            designerId={designerId}
            service={editing === "new" ? null : editing}
            onDone={() => {
              setEditing(null);
              void invalidate();
            }}
            onCancel={() => setEditing(null)}
          />
        )}

        {services.isPending && <p className="text-sm text-muted-foreground">{common("loading")}</p>}

        {services.data && mine.length === 0 && !editing && (
          // DESIGN.md: Mona the doctor holds the Services empty state, on butter.
          <div className="grid items-center gap-x-8 gap-y-3 rounded-lg bg-butter p-6 md:grid-cols-[160px_minmax(0,1fr)] md:p-8">
            <Image src="/images/mona-doctor.png" alt="" width={511} height={720} className="h-auto w-[120px] md:row-span-3 md:w-[160px]" />
            <h4 className="text-base font-semibold">{t("emptyTitle")}</h4>
            <p className="max-w-[46ch] text-sm text-body">{t("emptyBody")}</p>
            {canEdit && (
              <Button variant="outline" className={cn(outlinePillSm, "justify-self-start")} onClick={() => setEditing("new")}>
                <Plus aria-hidden />
                {t("add")}
              </Button>
            )}
          </div>
        )}

        {mine.length > 0 && (
          <SettingsRows>
            {mine.map((s) => (
              <div key={s.id} className={cn("flex flex-wrap items-center gap-4 px-4 py-4 md:px-6", !s.active && "text-muted-foreground")}>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {s.name}
                    {!s.active && <span className={chip}>{t("hidden")}</span>}
                    {s.allowsDoubleBooking && <span className={chip}>{t("doubleBooking")}</span>}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                    {f.cents(s.priceCents)} · {f.duration(s.durationMin)}
                    {s.bufferMin ? ` ${t("buffer", { duration: f.duration(s.bufferMin) })}` : ""}
                    {s.category ? ` · ${s.category}` : ""}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" className={outlinePillSm} onClick={() => setEditing(s)}>
                      {t("edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      className={cn(ghostPillSm, "text-destructive")}
                      disabled={remove.isPending}
                      onClick={() => {
                        if (confirm(t("confirmDelete", { name: s.name }))) remove.mutate(s.id);
                      }}
                    >
                      {t("delete")}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </SettingsRows>
        )}
      </SettingsSection>
    </div>
  );
}

function ServiceForm({
  salonId,
  designerId,
  service,
  onDone,
  onCancel,
}: {
  salonId: string;
  designerId: string;
  service: Service | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("settings.services");
  const common = useTranslations("common");
  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: service
      ? {
          name: service.name,
          category: service.category ?? "",
          description: service.description ?? "",
          priceDollars: service.priceCents / 100,
          durationMin: service.durationMin,
          bufferMin: service.bufferMin,
          active: service.active,
          allowsDoubleBooking: service.allowsDoubleBooking,
        }
      : {
          name: "",
          category: "",
          description: "",
          priceDollars: 0,
          durationMin: 60,
          bufferMin: 0,
          active: true,
          allowsDoubleBooking: false,
        },
  });

  const save = useMutation({
    mutationFn: (v: FormOutput) => {
      const { priceDollars, ...rest } = v;
      const json = {
        ...rest,
        category: rest.category || null,
        description: rest.description || null,
        priceCents: Math.round(priceDollars * 100),
      };
      return service
        ? api<Service>(`/salons/${salonId}/services/${service.id}`, { method: "PATCH", json })
        : api<Service>(`/salons/${salonId}/services`, { method: "POST", json: { ...json, designerId } });
    },
    onSuccess: onDone,
  });

  const err = form.formState.errors;
  // Sharing only makes sense once a service is long enough to have downtime,
  // so the option follows whatever duration is currently typed in.
  const typedDuration = useWatch({ control: form.control, name: "durationMin" });
  const canShare = canAllowDoubleBooking(Number(typedDuration) || 0);
  const field = "grid gap-2";

  return (
    <form
      onSubmit={form.handleSubmit((v) =>
        // The switch is hidden below the threshold, so never send a stale tick.
        save.mutate({ ...v, allowsDoubleBooking: canShare && v.allowsDoubleBooking }),
      )}
      className="grid gap-5 rounded-lg bg-muted p-4 shadow-[inset_0_0_0_1px_var(--border)] md:p-6"
      noValidate
    >
      <div>
        <h4 className="text-base font-semibold">{service ? t("editTitle") : t("newTitle")}</h4>
        <p className="mt-0.5 text-sm text-body">{t("formHint", { min: DOUBLE_BOOKING_MIN_DURATION_MIN })}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className={field}>
          <Label htmlFor="svc-name">{t("name")}</Label>
          <Input id="svc-name" className={pillInputSm} aria-invalid={Boolean(err.name)} {...form.register("name")} />
          <FieldError message={err.name?.message} />
        </div>
        <div className={field}>
          <Label htmlFor="svc-category">{t("category")}</Label>
          <Input id="svc-category" className={pillInputSm} placeholder={t("categoryPlaceholder")} {...form.register("category")} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className={field}>
          <Label htmlFor="svc-price">{t("price")}</Label>
          <Input id="svc-price" className={cn(pillInputSm, "tabular-nums")} type="number" step="0.01" min="0" {...form.register("priceDollars", { valueAsNumber: true })} />
          <FieldError message={err.priceDollars?.message} />
        </div>
        <div className={field}>
          <Label htmlFor="svc-duration">{t("minutes")}</Label>
          <Input id="svc-duration" className={cn(pillInputSm, "tabular-nums")} type="number" step="5" min="5" {...form.register("durationMin", { valueAsNumber: true })} />
          <FieldError message={err.durationMin?.message} />
        </div>
        <div className={field}>
          <Label htmlFor="svc-buffer">{t("bufferLabel")}</Label>
          <Input id="svc-buffer" className={cn(pillInputSm, "tabular-nums")} type="number" step="5" min="0" {...form.register("bufferMin", { valueAsNumber: true })} />
          <FieldError message={err.bufferMin?.message} />
        </div>
      </div>
      <div className={field}>
        <Label htmlFor="svc-desc">{t("description")}</Label>
        <Textarea id="svc-desc" className="rounded-2xl bg-card px-4 py-3" rows={3} {...form.register("description")} />
      </div>
      <SettingsRows>
        <SettingsRow compact label={t("bookable")} htmlFor="svc-active">
          <Switch id="svc-active" {...form.register("active")} />
        </SettingsRow>
        {canShare && (
          <SettingsRow compact label={t("allowDouble")} htmlFor="svc-double" description={t("allowDoubleHint")}>
            <Switch id="svc-double" {...form.register("allowsDoubleBooking")} />
          </SettingsRow>
        )}
      </SettingsRows>
      <FieldError message={save.error instanceof ApiError ? save.error.message : undefined} />
      <div className="flex gap-2">
        <Button type="submit" className={pillButtonSm} disabled={save.isPending}>
          {save.isPending ? t("saving") : service ? t("saveChanges") : t("addService")}
        </Button>
        <Button type="button" variant="ghost" className={ghostPillSm} onClick={onCancel}>
          {common("cancel")}
        </Button>
      </div>
    </form>
  );
}
