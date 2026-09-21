"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createSalonSchema, type CreateSalonInput, type MySalon } from "@reserivo/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

/**
 * Used in two places: the first-run screen for someone with no salon yet, and
 * Settings → Your salons for anyone opening another.
 */
export function CreateSalonCard({ title, description, onCancel }: { title?: string; description?: string; onCancel?: () => void }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const timezones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);
  const browserZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  // takesAppointments has a schema default, so the input type is looser than the output.
  const form = useForm<z.input<typeof createSalonSchema>, unknown, CreateSalonInput>({
    resolver: zodResolver(createSalonSchema),
    defaultValues: { name: "", slug: "", timezone: browserZone, takesAppointments: true },
  });

  const create = useMutation({
    mutationFn: (input: CreateSalonInput) => api<MySalon>("/salons", { method: "POST", json: input }),
    onSuccess: (salon) => {
      void queryClient.invalidateQueries({ queryKey: ["salons", "mine"] });
      router.push(`/s/${salon.id}/calendar`);
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  // Suggest a link from the name until the user edits the link themselves.
  const slugTouched = form.formState.dirtyFields.slug;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title ?? "Create a salon"}</CardTitle>
        <CardDescription>{description ?? "You become its first manager."}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit((v) => {
            setServerError(null);
            create.mutate(v);
          })}
          className="grid max-w-md gap-4"
          noValidate
        >
          <div className="grid gap-1.5">
            <Label htmlFor="salon-name">Name</Label>
            <Input
              id="salon-name"
              {...form.register("name", {
                onChange: (e) => {
                  if (!slugTouched) form.setValue("slug", slugify(e.target.value), { shouldValidate: false });
                },
              })}
            />
            <FieldError message={form.formState.errors.name?.message} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="salon-slug">Booking URL</Label>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <span>/</span>
              <Input id="salon-slug" {...form.register("slug")} />
            </div>
            <FieldError message={form.formState.errors.slug?.message} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="salon-tz">Time zone</Label>
            <select id="salon-tz" className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" {...form.register("timezone")}>
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
            <FieldError message={form.formState.errors.timezone?.message} />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5" {...form.register("takesAppointments")} />
            <span>
              I also take appointments myself
              <span className="block text-xs text-muted-foreground">
                Solo operators and owner-stylists. You can change this later under Settings → Team.
              </span>
            </span>
          </label>
          <FieldError message={serverError ?? undefined} />
          <div className="flex gap-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create salon"}
            </Button>
            {onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .slice(0, 50);
}
