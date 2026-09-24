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
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { SmsConsent } from "@/components/booking/sms-consent";
import { useFormat } from "@/lib/use-format";
import { cn } from "cn";

type Designer = PublicSalon["designers"][number];
type Service = Designer["services"][number];
type Step = { kind: "pick" } | { kind: "time"; d: Designer; s: Service } | { kind: "details"; d: Designer; s: Service; startAt: string } | { kind: "done"; appt: CustomerAppointment };

const DAYS_SHOWN = 14;

/** Keys under booking.steps. The English "Your details" is quoted on /sms, so keep that wording. */
const STEPS = ["service", "time", "details"] as const;

/**
 * The customer's path from menu to confirmed booking. Storefront mood: bigger
 * type, plenty of air, and every color a token so a salon's accent can take over.
 *
 * On wide screens the flow sits beside a sticky summary of what has been chosen
 * so far; on phones the same summary is shown inline above each step instead.
 */
export function BookingFlow({ salon }: { salon: PublicSalon }) {
  const [step, setStep] = useState<Step>({ kind: "pick" });

  if (step.kind === "done") return <Confirmation appt={step.appt} />;

  const current = step.kind === "pick" ? 0 : step.kind === "time" ? 1 : 2;
  const chosen = step.kind === "pick" ? null : step;

  let body: React.ReactNode;
  if (step.kind === "details") {
    body = (
      <Details
        salon={salon}
        designer={step.d}
        service={step.s}
        startAt={step.startAt}
        onBack={() => setStep({ kind: "time", d: step.d, s: step.s })}
        onDone={(appt) => setStep({ kind: "done", appt })}
      />
    );
  } else if (step.kind === "time") {
    body = (
      <TimePicker
        salon={salon}
        designer={step.d}
        service={step.s}
        onBack={() => setStep({ kind: "pick" })}
        onPick={(startAt) => setStep({ kind: "details", d: step.d, s: step.s, startAt })}
      />
    );
  } else {
    body = <Menu salon={salon} onPick={(d, s) => setStep({ kind: "time", d, s })} />;
  }

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
      <div className="grid content-start gap-8 lg:col-span-8">
        <Steps current={current} />
        {body}
      </div>
      <aside className="hidden lg:col-span-4 lg:block">
        <div className="sticky top-8">
          <BookingSummary
            salon={salon}
            designer={chosen?.d}
            service={chosen?.s}
            startAt={chosen && "startAt" in chosen ? chosen.startAt : undefined}
          />
        </div>
      </aside>
    </div>
  );
}

function Steps({ current }: { current: number }) {
  const t = useTranslations("booking.steps");
  return (
    <ol aria-label={t("label")} className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {STEPS.map((step, i) => (
        <li
          key={step}
          aria-current={i === current ? "step" : undefined}
          className={cn("flex items-center gap-2", i === current ? "font-medium text-foreground" : "text-muted-foreground")}
        >
          <span
            aria-hidden
            className={cn(
              "grid size-6 place-items-center rounded-full border border-input text-xs tabular-nums",
              i < current && "border-primary bg-primary text-primary-foreground",
              i === current && "border-foreground",
            )}
          >
            {i < current ? <Check className="size-3.5" /> : i + 1}
          </span>
          {t(step)}
        </li>
      ))}
    </ol>
  );
}

/** Initials stand in until a designer uploads a photo. Array.from keeps a surrogate pair whole. */
function Avatar({ designer }: { designer: Designer }) {
  if (designer.photoUrl) {
    // A salon's own upload, from wherever it is hosted; next/image would need every host allow-listed.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={designer.photoUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />;
  }
  const initials = designer.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden
      className="grid size-14 shrink-0 place-items-center rounded-full bg-accent font-heading text-lg text-accent-foreground"
    >
      {initials}
    </span>
  );
}

function Menu({ salon, onPick }: { salon: PublicSalon; onPick: (d: Designer, s: Service) => void }) {
  const f = useFormat();
  const t = useTranslations("booking");
  const withServices = salon.designers.filter((d) => d.services.length > 0);

  if (withServices.length === 0) {
    return (
      <div className="rounded-xl bg-muted px-6 py-10 text-center">
        <p className="text-lg">{t("settingUp")}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-14">
      {withServices.map((d) => (
        <section key={d.id} className="grid gap-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex items-start gap-4">
            <Avatar designer={d} />
            <div className="grid gap-1 pt-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="text-2xl md:text-3xl">{d.displayName}</h2>
                <RatingSummary rating={d.rating} />
              </div>
              {d.bio && <p className="max-w-prose text-muted-foreground">{d.bio}</p>}
            </div>
          </div>
          <ul className="divide-y border-y">
            {d.services.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onPick(d, s)}
                  className="group grid w-full grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-1 px-3 py-4 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="text-lg font-medium">{s.name}</span>
                  <span className="flex items-center gap-2 text-lg tabular-nums">
                    {f.cents(s.priceCents)}
                    <ChevronRight
                      aria-hidden
                      className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                    />
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {f.duration(s.durationMin)}
                    {s.category ? ` · ${s.category}` : ""}
                  </span>
                  {s.description && (
                    <span className="col-span-2 max-w-prose text-sm text-muted-foreground">{s.description}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** The sticky panel beside the flow on wide screens. */
function BookingSummary({
  salon,
  designer,
  service,
  startAt,
}: {
  salon: PublicSalon;
  designer?: Designer;
  service?: Service;
  startAt?: string;
}) {
  const f = useFormat();
  const t = useTranslations("booking.summary");
  return (
    <div className="grid gap-5 rounded-xl border bg-card p-6">
      <p className="font-heading text-xl">{t("title")}</p>
      {service && designer ? (
        <dl className="grid gap-4">
          <div className="grid gap-0.5">
            <dt className="text-sm text-muted-foreground">{t("service")}</dt>
            <dd className="font-medium">{service.name}</dd>
            <dd className="text-sm text-muted-foreground">{f.duration(service.durationMin)}</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-sm text-muted-foreground">{t("with")}</dt>
            <dd className="font-medium">{designer.displayName}</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-sm text-muted-foreground">{t("when")}</dt>
            <dd className={cn(startAt ? "font-medium" : "text-muted-foreground")}>
              {startAt ? f.inTz(startAt, salon.timezone, "dateTimeLong") : t("chooseTime")}
            </dd>
          </div>
          <div className="flex items-baseline justify-between border-t pt-4">
            <dt className="text-sm text-muted-foreground">{t("price")}</dt>
            <dd className="text-lg tabular-nums">{f.cents(service.priceCents)}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-muted-foreground">{t("nothing")}</p>
      )}
      <ul className="grid gap-2 border-t pt-4 text-sm text-muted-foreground">
        {/* Node and the browser ship different ICU data, so the zone's name can
            differ by a word ("북미 동부" vs "미 동부"). Only this text may differ. */}
        <li suppressHydrationWarning>{t("timezone", { tz: f.timezone(salon.timezone) })}</li>
        <li>{t("cancellation", { hours: salon.cancelWindowHours })}</li>
        <li>{t("payAtSalon")}</li>
      </ul>
    </div>
  );
}

/** The inline summary on phones, where there is no room for the side panel. */
function Summary({ designer, service, startAt, timezone }: { designer: Designer; service: Service; startAt?: string; timezone: string }) {
  const f = useFormat();
  const t = useTranslations("booking");
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border bg-card px-5 py-4 lg:hidden">
      <div className="grid gap-0.5">
        <span className="font-medium">
          {t.rich("serviceWith", {
            service: service.name,
            designer: designer.displayName,
            muted: (chunks) => <span className="text-muted-foreground">{chunks}</span>,
          })}
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

function BackButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 justify-self-start rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <ArrowLeft aria-hidden className="size-4" />
      {children}
    </button>
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
  const t = useTranslations("booking");
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
    <div className="grid gap-8 animate-in fade-in duration-300">
      <BackButton onClick={onBack}>{t("back.allServices")}</BackButton>
      <Summary designer={designer} service={service} timezone={salon.timezone} />

      <div className="grid gap-4">
        <h2 className="text-2xl">{t("time.pickDay")}</h2>
        <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
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
                aria-pressed={active}
                className={cn(
                  "grid min-w-[4.75rem] shrink-0 snap-start gap-0.5 rounded-lg border px-3 py-2.5 text-center text-sm transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
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

      <div className="grid gap-4">
        <h2 className="text-2xl">{t("time.pickTime")}</h2>
        {availability.isPending && (
          <div role="status" aria-label={t("time.checking")} className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        )}
        {availability.isError && <p className="text-destructive">{t("time.loadError")}</p>}
        {selected && selected.slots.length === 0 && (
          <div className="grid justify-items-start gap-3 rounded-xl bg-muted px-5 py-6">
            <p>{t("time.nothingOpen")}</p>
            {firstOpen && firstOpen !== date && (
              <Button variant="outline" onClick={() => setDate(firstOpen)}>
                {t("time.jumpTo", { date: f.localDate(firstOpen) })}
              </Button>
            )}
          </div>
        )}
        {selected && selected.slots.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {selected.slots.map((s) => (
              <Button
                key={s.startAt}
                variant="outline"
                size="lg"
                className="h-11 text-base tabular-nums hover:border-primary"
                onClick={() => onPick(s.startAt)}
              >
                {f.minutes(s.startMinutes)}
              </Button>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground lg:hidden">{t("summary.timezone", { tz: f.timezone(salon.timezone) })}</p>
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
  const t = useTranslations("booking");
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
    <div className="grid gap-8 animate-in fade-in duration-300">
      <BackButton onClick={onBack}>{t("back.changeTime")}</BackButton>
      <Summary designer={designer} service={service} startAt={startAt} timezone={salon.timezone} />
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">{t("details.title")}</CardTitle>
          <CardDescription>
            {user ? t("details.bookingAs", { email: user.email }) : t("details.noAccount")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-5"
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
            <div className="grid gap-2">
              <Label htmlFor="bk-name">{t("details.name")}</Label>
              <Input id="bk-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
              <FieldError message={fieldError("name")} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="bk-email">{t("details.email")}</Label>
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
              <div className="grid gap-2">
                <Label htmlFor="bk-phone">{t("details.phone")}</Label>
                <Input id="bk-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
                <FieldError message={fieldError("phone")} />
              </div>
            </div>
            <SmsConsent checked={smsConsent} onChange={setSmsConsent} hasPhone={Boolean(phone.trim())} />
            <div className="grid gap-2">
              <Label htmlFor="bk-notes">{t("details.notes")}</Label>
              <Textarea id="bk-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {err && !err.issues.length && <FieldError message={err.message} />}
            <Button type="submit" size="lg" className="h-11 text-base" disabled={book.isPending}>
              {book.isPending ? t("details.submitting") : t("details.submit")}
            </Button>
            <p className="text-xs text-muted-foreground">{t("summary.cancellation", { hours: salon.cancelWindowHours })}</p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Confirmation({ appt }: { appt: CustomerAppointment }) {
  const f = useFormat();
  const { user } = useAuth();
  const t = useTranslations("booking.done");
  return (
    <div className="grid max-w-2xl gap-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <span className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
        <Check aria-hidden className="size-6" />
      </span>
      <div className="grid gap-2">
        <h2 className="text-4xl">{t("title")}</h2>
        <p className="text-lg text-muted-foreground">
          {t("summary", { service: appt.serviceName, designer: appt.designerName, salon: appt.salon.name })}
        </p>
      </div>
      <p className="font-heading text-3xl">{f.inTz(appt.startAt, appt.salon.timezone, "dateTimeLong")}</p>
      <p className="text-muted-foreground">
        {t("payAtSalon", { price: f.cents(appt.priceCents) })}
        {appt.cancellableUntil && <> {t("cancelUntil", { time: f.inTz(appt.cancellableUntil, appt.salon.timezone) })}</>}
      </p>
      <div className="border-t pt-6">
        {user ? (
          <Button size="lg" className="h-11 px-5" nativeButton={false} render={<Link href="/appointments" />}>
            {t("seeAppointments")}
          </Button>
        ) : (
          <p className="text-muted-foreground">
            {t.rich("createAccount", {
              link: (chunks) => (
                <Link href="/register?next=/appointments" className="text-foreground underline underline-offset-4">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        )}
      </div>
    </div>
  );
}
