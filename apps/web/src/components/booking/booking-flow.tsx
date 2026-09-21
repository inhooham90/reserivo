"use client";

import {
  addDays,
  todayIn,
  type AvailabilityResponse,
  type BookAppointmentInput,
  type CustomerAppointment,
  type PublicSalon,
} from "@reserivo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@/i18n/navigation";
import { useMemo, useState } from "react";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { RatingSummary } from "@/components/rating/stars";
import { useFormat } from "@/lib/use-format";
import { cn } from "cn";

type Designer = PublicSalon["designers"][number];
type Service = Designer["services"][number];
type Step = { kind: "pick" } | { kind: "time"; d: Designer; s: Service } | { kind: "details"; d: Designer; s: Service; startAt: string } | { kind: "done"; appt: CustomerAppointment };

const DAYS_SHOWN = 14;

/**
 * The customer's path from menu to confirmed booking. Storefront mood: bigger
 * type, plenty of air, and every color a token so a salon's accent can take over.
 */
export function BookingFlow({ salon }: { salon: PublicSalon }) {
  const f = useFormat();
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const withServices = salon.designers.filter((d) => d.services.length > 0);

  if (step.kind === "done") return <Confirmation appt={step.appt} />;

  if (step.kind === "details") {
    return (
      <Details
        salon={salon}
        designer={step.d}
        service={step.s}
        startAt={step.startAt}
        onBack={() => setStep({ kind: "time", d: step.d, s: step.s })}
        onDone={(appt) => setStep({ kind: "done", appt })}
      />
    );
  }

  if (step.kind === "time") {
    return (
      <TimePicker
        salon={salon}
        designer={step.d}
        service={step.s}
        onBack={() => setStep({ kind: "pick" })}
        onPick={(startAt) => setStep({ kind: "details", d: step.d, s: step.s, startAt })}
      />
    );
  }

  return (
    <div className="grid gap-10">
      {withServices.length === 0 && <p className="text-muted-foreground">This salon is still setting up its menu.</p>}
      {withServices.map((d) => (
        <section key={d.id} className="grid gap-4">
          <div className="grid gap-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-2xl">{d.displayName}</h2>
              <RatingSummary rating={d.rating} />
            </div>
            {d.bio && <p className="max-w-prose text-muted-foreground">{d.bio}</p>}
          </div>
          <ul className="divide-y rounded-xl border bg-card">
            {d.services.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setStep({ kind: "time", d, s })}
                  className="flex w-full items-baseline justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                >
                  <span className="grid gap-0.5">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {f.duration(s.durationMin)}
                      {s.category ? ` · ${s.category}` : ""}
                      {s.description ? ` — ${s.description}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">{f.cents(s.priceCents)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Summary({ designer, service, startAt, timezone }: { designer: Designer; service: Service; startAt?: string; timezone: string }) {
  const f = useFormat();
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border bg-card px-5 py-4">
      <div className="grid gap-0.5">
        <span className="font-medium">
          {service.name} <span className="text-muted-foreground">with {designer.displayName}</span>
        </span>
        <span className="text-sm text-muted-foreground">
          {f.duration(service.durationMin)}
          {startAt ? ` · ${f.inTz(startAt, timezone)}` : ""}
        </span>
      </div>
      <span className="tabular-nums">{f.cents(service.priceCents)}</span>
    </div>
  );
}

function TimePicker({
  salon,
  designer,
  service,
  onBack,
  onPick,
}: {
  salon: PublicSalon;
  designer: Designer;
  service: Service;
  onBack: () => void;
  onPick: (startAt: string) => void;
}) {
  const f = useFormat();
  const from = useMemo(() => todayIn(salon.timezone), [salon.timezone]);
  const [date, setDate] = useState(from);

  const availability = useQuery({
    queryKey: ["public-availability", salon.slug, designer.id, service.id, from],
    queryFn: () =>
      api<AvailabilityResponse>(
        `/public/salons/${salon.slug}/availability?designerId=${designer.id}&serviceId=${service.id}&from=${from}&days=${DAYS_SHOWN}`,
      ),
    staleTime: 15_000,
  });

  const days = availability.data?.days ?? [];
  const selected = days.find((d) => d.date === date);
  const firstOpen = days.find((d) => d.slots.length > 0)?.date;

  return (
    <div className="grid gap-6">
      <button type="button" onClick={onBack} className="justify-self-start text-sm text-muted-foreground underline">
        ← All services
      </button>
      <Summary designer={designer} service={service} timezone={salon.timezone} />

      <div className="grid gap-3">
        <h2 className="text-xl">Pick a day</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(from, i)).map((d) => {
            const count = days.find((x) => x.date === d)?.slots.length ?? 0;
            const active = d === date;
            // Asked for as parts, never split out of a formatted string: the
            // comma the old code cut on does not exist in every language.
            const { weekday, rest } = f.localDateParts(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDate(d)}
                disabled={availability.isSuccess && count === 0}
                className={cn(
                  "grid min-w-[4.5rem] shrink-0 gap-0.5 rounded-lg border px-3 py-2 text-center text-sm transition-colors",
                  active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                )}
              >
                <span className="text-xs uppercase tracking-wide opacity-80">{weekday}</span>
                <span className="font-medium">{rest}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3">
        <h2 className="text-xl">Pick a time</h2>
        {availability.isPending && <p className="text-muted-foreground">Checking the calendar…</p>}
        {availability.isError && <p className="text-destructive">Could not load availability.</p>}
        {selected && selected.slots.length === 0 && (
          <p className="text-muted-foreground">
            Nothing open on this day.{" "}
            {firstOpen && firstOpen !== date && (
              <button type="button" className="underline" onClick={() => setDate(firstOpen)}>
                Jump to {f.localDate(firstOpen)}
              </button>
            )}
          </p>
        )}
        {selected && selected.slots.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {selected.slots.map((s) => (
              <Button key={s.startAt} variant="outline" size="lg" onClick={() => onPick(s.startAt)}>
                {f.minutes(s.startMinutes)}
              </Button>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Times shown in {f.timezone(salon.timezone)}.</p>
      </div>
    </div>
  );
}

function Details({
  salon,
  designer,
  service,
  startAt,
  onBack,
  onDone,
}: {
  salon: PublicSalon;
  designer: Designer;
  service: Service;
  startAt: string;
  onBack: () => void;
  onDone: (appt: CustomerAppointment) => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [notes, setNotes] = useState("");

  const book = useMutation({
    mutationFn: (input: BookAppointmentInput) =>
      api<CustomerAppointment>(`/public/salons/${salon.slug}/appointments`, { method: "POST", json: input }),
    onSuccess: onDone,
  });

  const err = book.error instanceof ApiError ? book.error : null;
  const fieldError = (path: string) => err?.issues.find((i) => i.path === `customer.${path}` || i.path === path)?.message;

  return (
    <div className="grid gap-6">
      <button type="button" onClick={onBack} className="justify-self-start text-sm text-muted-foreground underline">
        ← Change time
      </button>
      <Summary designer={designer} service={service} startAt={startAt} timezone={salon.timezone} />
      <Card>
        <CardHeader>
          <CardTitle>Your details</CardTitle>
          <CardDescription>
            {user ? `Booking as ${user.email}.` : "No account needed. We only use this to confirm and remind you."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              book.mutate({
                designerId: designer.id,
                serviceId: service.id,
                startAt,
                customer: {
                  name: name.trim(),
                  email: email.trim(),
                  phone: phone.trim() || undefined,
                  smsConsent: phone.trim() ? smsConsent : undefined,
                },
                notes: notes.trim() || undefined,
              });
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="bk-name">Name</Label>
              <Input id="bk-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
              <FieldError message={fieldError("name")} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="bk-email">Email</Label>
                <Input
                  id="bk-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  disabled={Boolean(user)}
                />
                <FieldError message={fieldError("email")} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="bk-phone">Phone (optional)</Label>
                <Input id="bk-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
                <FieldError message={fieldError("phone")} />
              </div>
            </div>
            {/*
              Always rendered, so the opt-in is plainly visible to anyone reading
              the page — including a carrier reviewing the A2P campaign — and only
              enabled once there is a number to send to. Never pre-ticked: consent
              has to be given, not withdrawn. The wording carries the disclosures
              US carriers expect, and must stay in step with what is filed with them.
            */}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={smsConsent}
                disabled={!phone.trim()}
                onChange={(e) => setSmsConsent(e.target.checked)}
              />
              <span className={cn(!phone.trim() && "text-muted-foreground")}>
                Text me a reminder before my appointment.
                <span className="block text-xs text-muted-foreground">
                  {!phone.trim() && "Add a mobile number above to turn this on. "}
                  Reserivo appointment reminders only, never marketing. 1–2 messages per appointment. Message and data
                  rates may apply. Reply STOP to unsubscribe, HELP for help. See our{" "}
                  <Link href="/terms" target="_blank" className="underline">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" target="_blank" className="underline">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </span>
            </label>
            <div className="grid gap-1.5">
              <Label htmlFor="bk-notes">Anything the stylist should know? (optional)</Label>
              <Textarea id="bk-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {err && !err.issues.length && <FieldError message={err.message} />}
            <Button type="submit" size="lg" disabled={book.isPending}>
              {book.isPending ? "Booking…" : "Confirm booking"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Free cancellation online up to {salon.cancelWindowHours} hours before your appointment.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Confirmation({ appt }: { appt: CustomerAppointment }) {
  const f = useFormat();
  const { user } = useAuth();
  return (
    <Card>
      <CardHeader>
        <CardTitle>You’re booked</CardTitle>
        <CardDescription>
          {appt.serviceName} with {appt.designerName} at {appt.salon.name}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-2xl">{f.inTz(appt.startAt, appt.salon.timezone, "dateTimeLong")}</p>
        <p className="text-sm text-muted-foreground">
          {f.cents(appt.priceCents)} · pay at the salon.
          {appt.cancellableUntil && ` Cancel free online until ${f.inTz(appt.cancellableUntil, appt.salon.timezone)}.`}
        </p>
        {user ? (
          <Button nativeButton={false} render={<Link href="/appointments" />} className="justify-self-start">
            See my appointments
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link href="/register?next=/appointments" className="underline">
              Create an account
            </Link>{" "}
            with the same email to manage or cancel this booking online.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
