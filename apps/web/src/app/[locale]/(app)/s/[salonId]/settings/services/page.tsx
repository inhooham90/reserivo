"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { canAllowDoubleBooking, createServiceSchema, DOUBLE_BOOKING_MIN_DURATION_MIN, type Service } from "@reserivo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { FieldError } from "@/components/field-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { useFormat } from "@/lib/use-format";
import { salonKeys, useSalon } from "@/lib/salon-context";

/** The form works in dollars; the API takes cents. */
const formSchema = createServiceSchema.omit({ designerId: true, priceCents: true }).extend({
  priceDollars: z.number().min(0).max(10_000),
});
type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;

export default function ServicesPage() {
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

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_380px]">
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg">{t("title")}</h2>
          {isManager && designers.length > 1 && (
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
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
        </div>
        {designers.length === 0 && <p className="text-muted-foreground">{settings("noDesigners")}</p>}
        {services.isPending && <p className="text-muted-foreground">{common("loading")}</p>}
        {services.data && mine.length === 0 && (
          <p className="text-muted-foreground">{t("none")}</p>
        )}
        {mine.map((s) => (
          <Card key={s.id} className={s.active ? "" : "opacity-60"}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {s.name}
                  {!s.active && <Badge variant="outline">{t("hidden")}</Badge>}
                  {s.allowsDoubleBooking && <Badge variant="outline">{t("doubleBooking")}</Badge>}
                </CardTitle>
                <CardDescription>
                  {f.cents(s.priceCents)} · {f.duration(s.durationMin)}
                  {s.bufferMin ? ` ${t("buffer", { duration: f.duration(s.bufferMin) })}` : ""}
                  {s.category ? ` · ${s.category}` : ""}
                </CardDescription>
              </div>
              {canEdit && (
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                    {t("edit")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (confirm(t("confirmDelete", { name: s.name }))) remove.mutate(s.id);
                    }}
                  >
                    {t("delete")}
                  </Button>
                </div>
              )}
            </CardHeader>
          </Card>
        ))}
      </section>
      {canEdit && (
        <aside className="self-start">
          {editing ? (
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
          ) : (
            <Button onClick={() => setEditing("new")}>{t("add")}</Button>
          )}
        </aside>
      )}
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>{service ? t("editTitle") : t("newTitle")}</CardTitle>
        <CardDescription>{t("formHint", { min: DOUBLE_BOOKING_MIN_DURATION_MIN })}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit((v) =>
            // The box is hidden below the threshold, so never send a stale tick.
            save.mutate({ ...v, allowsDoubleBooking: canShare && v.allowsDoubleBooking }),
          )}
          className="grid gap-3"
          noValidate
        >
          <div className="grid gap-1.5">
            <Label htmlFor="svc-name">{t("name")}</Label>
            <Input id="svc-name" {...form.register("name")} />
            <FieldError message={err.name?.message} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="svc-category">{t("category")}</Label>
            <Input id="svc-category" placeholder={t("categoryPlaceholder")} {...form.register("category")} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="svc-price">{t("price")}</Label>
              <Input id="svc-price" type="number" step="0.01" min="0" {...form.register("priceDollars", { valueAsNumber: true })} />
              <FieldError message={err.priceDollars?.message} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="svc-duration">{t("minutes")}</Label>
              <Input id="svc-duration" type="number" step="5" min="5" {...form.register("durationMin", { valueAsNumber: true })} />
              <FieldError message={err.durationMin?.message} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="svc-buffer">{t("bufferLabel")}</Label>
              <Input id="svc-buffer" type="number" step="5" min="0" {...form.register("bufferMin", { valueAsNumber: true })} />
              <FieldError message={err.bufferMin?.message} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="svc-desc">{t("description")}</Label>
            <Textarea id="svc-desc" rows={3} {...form.register("description")} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register("active")} />
            {t("bookable")}
          </label>
          {canShare && (
            <div className="grid gap-1 rounded-md border border-border bg-muted/40 p-3">
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" {...form.register("allowsDoubleBooking")} />
                <span>{t("allowDouble")}</span>
              </label>
              <p className="pl-6 text-xs text-muted-foreground">{t("allowDoubleHint")}</p>
            </div>
          )}
          <FieldError message={save.error instanceof ApiError ? save.error.message : undefined} />
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? t("saving") : service ? t("saveChanges") : t("addService")}
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
