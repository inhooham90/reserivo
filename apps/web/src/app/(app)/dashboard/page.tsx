"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createSalonSchema, type CreateSalonInput, type MySalon } from "@reserivo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

export default function DashboardPage() {
  const salons = useQuery({ queryKey: ["salons", "mine"], queryFn: () => api<MySalon[]>("/salons/mine") });

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_360px]">
      <section className="grid gap-3">
        <h1 className="text-xl font-semibold">Your salons</h1>
        {salons.isPending && <p className="text-muted-foreground">Loading…</p>}
        {salons.isError && <p className="text-destructive">Could not load your salons.</p>}
        {salons.data?.length === 0 && (
          <p className="text-muted-foreground">You are not part of any salon yet. Create one to get started.</p>
        )}
        {salons.data?.map((s) => (
          <Link key={s.id} href={`/s/${s.id}`}>
            <Card className="transition-colors hover:bg-accent">
              <CardHeader>
                <CardTitle>{s.name}</CardTitle>
                <CardDescription>
                  /{s.slug} · {s.timezone} · {s.role === "MANAGER" ? "Manager" : "Designer"}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </section>
      <CreateSalonCard />
    </div>
  );
}

function CreateSalonCard() {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const timezones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);
  const browserZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  const form = useForm<CreateSalonInput>({
    resolver: zodResolver(createSalonSchema),
    defaultValues: { name: "", slug: "", timezone: browserZone },
  });

  const create = useMutation({
    mutationFn: (input: CreateSalonInput) => api<MySalon>("/salons", { method: "POST", json: input }),
    onSuccess: () => {
      form.reset({ name: "", slug: "", timezone: browserZone });
      void queryClient.invalidateQueries({ queryKey: ["salons", "mine"] });
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  // Suggest a slug from the name until the user edits the slug themselves.
  const slugTouched = form.formState.dirtyFields.slug;
  const onNameChange = (name: string) => {
    if (!slugTouched) form.setValue("slug", slugify(name), { shouldValidate: false });
  };

  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle>Create a salon</CardTitle>
        <CardDescription>You become its first manager.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit((v) => {
            setServerError(null);
            create.mutate(v);
          })}
          className="grid gap-4"
          noValidate
        >
          <div className="grid gap-1.5">
            <Label htmlFor="salon-name">Name</Label>
            <Input
              id="salon-name"
              {...form.register("name", { onChange: (e) => onNameChange(e.target.value) })}
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
            <select
              id="salon-tz"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              {...form.register("timezone")}
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
            <FieldError message={form.formState.errors.timezone?.message} />
          </div>
          <FieldError message={serverError ?? undefined} />
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create salon"}
          </Button>
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
