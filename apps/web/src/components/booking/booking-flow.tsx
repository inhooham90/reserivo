"use client";

import {
  addDays,
  todayIn,
  type AvailabilityResponse,
  type BookAnyAppointmentInput,
  type BookAppointmentInput,
  type CustomerAppointment,
  type PublicSalon,
} from "@reserivo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronRight, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useMemo, useState } from "react";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { RatingSummary } from "@/components/rating/stars";
import { SmsConsent } from "@/components/booking/sms-consent";
import { useFormat } from "@/lib/use-format";
import { outlinePillSm, pillButton, pillInput, textLink } from "@/lib/v3";
import { cn } from "cn";

type Designer = PublicSalon["designers"][number];
type Service = Designer["services"][number];
/** Who the booking is with: a named team member, or whoever is free. */
type Who = Designer | "anyone";
/**
 * One thing on the menu. Every team member owns their own copy of a service,
 * so "Anyone available" merges copies that share a name into one line, with
 * one option per person; a named team member's service has one option.
 */
interface Offer {
  key: string;
  name: string;
  category: string | null;
  description: string | null;
  options: { designer: Designer; service: Service }[];
}
type Step =
  | { kind: "member" }
  | { kind: "pick"; who?: Who }
  | { kind: "time"; who?: Who; offer: Offer }
  | { kind: "details"; who?: Who; offer: Offer; startAt: string }
  | { kind: "done"; appt: CustomerAppointment };

const offerOf = (designer: Designer, service: Service): Offer => ({
  key: service.id,
  name: service.name,
  category: service.category,
  description: service.description,
  options: [{ designer, service }],
});

/** Merged by name, ignoring case and spacing, in the order they first appear on the page. */
function anyoneOffers(designers: Designer[]): Offer[] {
  const byName = new Map<string, Offer>();
  for (const designer of designers) {
    for (const service of designer.services) {
      const key = service.name.trim().toLocaleLowerCase().replace(/\s+/g, " ");
      const offer = byName.get(key);
      if (offer) offer.options.push({ designer, service });
      else byName.set(key, { ...offerOf(designer, service), key });
    }
  }
  return [...byName.values()];
}

const range = (values: number[]) => ({ min: Math.min(...values), max: Math.max(...values) });

/** "$45.00", or "$45.00–$65.00" when the team members price it differently. The same for length. */
function useOfferText() {
  const f = useFormat();
  const t = useTranslations("booking.anyone");
  return {
    price: (offer: Offer) => {
      const { min, max } = range(offer.options.map((o) => o.service.priceCents));
      return min === max ? f.cents(min) : t("range", { min: f.cents(min), max: f.cents(max) });
    },
    duration: (offer: Offer) => {
      const { min, max } = range(offer.options.map((o) => o.service.durationMin));
      return min === max ? f.duration(min) : t("range", { min: f.duration(min), max: f.duration(max) });
    },
  };
}

const DAYS_SHOWN = 14;

/** Keys under booking.steps. The English "Your details" is quoted on /sms, so keep that wording. */
const STEPS = ["service", "time", "details"] as const;
/** With more than one bookable team member the flow opens on choosing one, so nobody scrolls past everyone else's menu. */
const STEPS_WITH_MEMBER = ["member", ...STEPS] as const;
type StepKey = (typeof STEPS_WITH_MEMBER)[number];

/**
 * The customer's path from menu to confirmed booking, on the Morrri v3 design
 * (DESIGN.md): pill controls, containers told apart by tone rather than
 * borders, navy only on the primary action and the selected day. Every color
 * is a token so a salon's accent can take over.
 *
 * On wide screens the flow sits beside a sticky summary of what has been chosen
 * so far; on phones the same summary is shown inline above each step instead.
 *
 * A business with more than one bookable team member gets a first step for
 * choosing one, and the menu then lists only that person's services. A solo
 * business goes straight to its menu. "Anyone available" heads that first
 * step: the menu merges everyone's services, the times are everyone's free
 * times, and the server picks who when the booking is made.
 */
export function BookingFlow({ salon }: { salon: PublicSalon }) {
  const withServices = salon.designers.filter((d) => d.services.length > 0);
  const pickMember = withServices.length > 1;
  const steps: readonly StepKey[] = pickMember ? STEPS_WITH_MEMBER : STEPS;
  const [step, setStep] = useState<Step>(pickMember ? { kind: "member" } : { kind: "pick" });

  if (step.kind === "done") return <Confirmation appt={step.appt} />;

  const current = steps.indexOf(step.kind === "member" ? "member" : step.kind === "pick" ? "service" : step.kind);
  const chosen = step.kind === "member" ? null : step;

  let body: React.ReactNode;
  if (step.kind === "details") {
    body = (
      <Details
        salon={salon}
        who={step.who}
        offer={step.offer}
        startAt={step.startAt}
        onBack={() => setStep({ kind: "time", who: step.who, offer: step.offer })}
        onDone={(appt) => setStep({ kind: "done", appt })}
      />
    );
  } else if (step.kind === "time") {
    body = (
      <TimePicker
        salon={salon}
        who={step.who}
        offer={step.offer}
        onBack={() => setStep({ kind: "pick", who: step.who })}
        onPick={(startAt) => setStep({ kind: "details", who: step.who, offer: step.offer, startAt })}
      />
    );
  } else if (step.kind === "member") {
    body = <MemberPicker designers={withServices} onPick={(who) => setStep({ kind: "pick", who })} />;
  } else {
    body = (
      <Menu
        who={step.who}
        designers={step.who && step.who !== "anyone" ? [step.who] : withServices}
        onBack={pickMember ? () => setStep({ kind: "member" }) : undefined}
        onPick={(offer) => setStep({ kind: "time", who: step.who, offer })}
      />
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
      <div className="grid content-start gap-8 lg:col-span-8">
        <Steps steps={steps} current={current} />
        {body}
      </div>
      <aside className="hidden lg:col-span-4 lg:block">
        <div className="sticky top-8">
          <BookingSummary
            salon={salon}
            who={chosen?.who}
            offer={chosen && "offer" in chosen ? chosen.offer : undefined}
            startAt={chosen && "startAt" in chosen ? chosen.startAt : undefined}
          />
        </div>
      </aside>
    </div>
  );
}

function Steps({ steps, current }: { steps: readonly StepKey[]; current: number }) {
  const t = useTranslations("booking.steps");
  return (
    <ol aria-label={t("label")} className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {steps.map((step, i) => (
        <li
          key={step}
          aria-current={i === current ? "step" : undefined}
          className={cn("flex items-center gap-2", i === current ? "font-medium text-foreground" : "text-muted-foreground")}
        >
          <span
            aria-hidden
            className={cn(
              "grid size-7 place-items-center rounded-full border border-input text-xs tabular-nums",
              // DESIGN.md: a checked state is Ink, never Navy; navy stays on the primary button.
              i < current && "border-foreground bg-foreground text-background",
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
      className="grid size-14 shrink-0 place-items-center rounded-full bg-lavender font-display text-lg text-foreground"
    >
      {initials}
    </span>
  );
}

const memberCard =
  "group flex items-start gap-4 rounded-lg p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * The first step at a business with several team members: one card each,
 * their menu behind it, and "Anyone available" first for the client who just
 * wants a time. It spans the row and sits on lavender so it reads as the
 * other kind of answer, not as one more person.
 */
function MemberPicker({ designers, onPick }: { designers: Designer[]; onPick: (who: Who) => void }) {
  const f = useFormat();
  const t = useTranslations("booking.member");
  const anyone = useTranslations("booking.anyone");
  const offers = anyoneOffers(designers);
  return (
    <div className="grid gap-5 animate-in fade-in duration-300">
      <h2 className="text-2xl md:text-3xl">{t("title")}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        <li className="grid sm:col-span-2">
          <button type="button" onClick={() => onPick("anyone")} className={cn(memberCard, "bg-lavender hover:bg-lavender/70")}>
            <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-card text-foreground">
              <UsersRound className="size-6" />
            </span>
            <span className="grid min-w-0 flex-1 gap-1 pt-1">
              <span className="text-lg font-medium">{anyone("title")}</span>
              <span className="text-sm text-body">{anyone("body")}</span>
              <span className="text-sm text-body tabular-nums">
                {t("services", {
                  count: offers.length,
                  price: f.cents(Math.min(...designers.flatMap((d) => d.services.map((s) => s.priceCents)))),
                })}
              </span>
            </span>
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center self-center rounded-full bg-card transition-transform group-hover:translate-x-0.5"
            >
              <ChevronRight className="size-4" />
            </span>
          </button>
        </li>
        {designers.map((d) => (
          <li key={d.id} className="grid">
            <button
              type="button"
              onClick={() => onPick(d)}
              className={cn(memberCard, "bg-muted hover:bg-surface-muted focus-visible:bg-surface-muted")}
            >
              <Avatar designer={d} />
              <span className="grid min-w-0 flex-1 gap-1 pt-1">
                <span className="text-lg font-medium">{d.displayName}</span>
                <RatingSummary rating={d.rating} />
                {d.bio && <span className="line-clamp-2 text-sm text-muted-foreground">{d.bio}</span>}
                <span className="text-sm text-muted-foreground tabular-nums">
                  {t("services", {
                    count: d.services.length,
                    price: f.cents(Math.min(...d.services.map((s) => s.priceCents))),
                  })}
                </span>
              </span>
              <span
                aria-hidden
                className="grid size-8 shrink-0 place-items-center self-center rounded-full bg-card transition-transform group-hover:translate-x-0.5"
              >
                <ChevronRight className="size-4" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Menu({
  who,
  designers: withServices,
  onBack,
  onPick,
}: {
  who?: Who;
  designers: Designer[];
  onBack?: () => void;
  onPick: (offer: Offer) => void;
}) {
  const f = useFormat();
  const t = useTranslations("booking");
  const text = useOfferText();

  if (who === "anyone") {
    return (
      <div className="grid gap-8">
        {onBack && <BackButton onClick={onBack}>{t("back.allMembers")}</BackButton>}
        <section className="grid gap-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="flex items-start gap-4">
            <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-lavender text-foreground">
              <UsersRound className="size-6" />
            </span>
            <div className="grid gap-1 pt-1">
              <h2 className="text-2xl md:text-3xl">{t("anyone.title")}</h2>
              <p className="max-w-prose text-muted-foreground">{t("anyone.menuHint")}</p>
            </div>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-lg bg-muted">
            {anyoneOffers(withServices).map((offer) => (
              <li key={offer.key}>
                <MenuItem
                  name={offer.name}
                  price={text.price(offer)}
                  meta={[
                    text.duration(offer),
                    offer.category,
                    t("anyone.teamCount", { count: offer.options.length }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  description={offer.description}
                  onClick={() => onPick(offer)}
                />
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  if (withServices.length === 0) {
    return (
      <div className="grid justify-items-center gap-4 rounded-lg bg-muted px-6 py-10 text-center">
        <Image src="/images/mona-binoculars.png" alt="" width={720} height={715} sizes="160px" className="h-auto w-40" />
        <p className="text-lg">{t("settingUp")}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      {onBack && <BackButton onClick={onBack}>{t("back.allMembers")}</BackButton>}
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
            <ul className="divide-y divide-border overflow-hidden rounded-lg bg-muted">
              {d.services.map((s) => (
                <li key={s.id}>
                  <MenuItem
                    name={s.name}
                    price={f.cents(s.priceCents)}
                    meta={`${f.duration(s.durationMin)}${s.category ? ` · ${s.category}` : ""}`}
                    description={s.description}
                    onClick={() => onPick(offerOf(d, s))}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function MenuItem({
  name,
  price,
  meta,
  description,
  onClick,
}: {
  name: string;
  price: string;
  meta: string;
  description: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group grid w-full grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-1 px-6 py-5 text-left transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      <span className="text-lg font-medium">{name}</span>
      <span className="flex items-center gap-3 text-lg tabular-nums">
        {price}
        <span
          aria-hidden
          className="grid size-8 place-items-center self-center rounded-full bg-card transition-transform group-hover:translate-x-0.5"
        >
          <ChevronRight className="size-4" />
        </span>
      </span>
      <span className="text-sm text-muted-foreground">{meta}</span>
      {description && <span className="col-span-2 max-w-prose text-sm text-muted-foreground">{description}</span>}
    </button>
  );
}

/** The sticky panel beside the flow on wide screens. */
/** The team member named on a choice: the one picked, or the only one offering it. Null for "anyone". */
function namedDesigner(who: Who | undefined, offer: Offer | undefined): Designer | null {
  if (who && who !== "anyone") return who;
  if (!who && offer?.options.length === 1) return offer.options[0].designer;
  return null;
}

function BookingSummary({
  salon,
  who,
  offer,
  startAt,
}: {
  salon: PublicSalon;
  who?: Who;
  offer?: Offer;
  startAt?: string;
}) {
  const f = useFormat();
  const t = useTranslations("booking.summary");
  const anyone = useTranslations("booking.anyone");
  const text = useOfferText();
  const designer = namedDesigner(who, offer);
  return (
    <div className="grid gap-5 rounded-lg bg-butter p-8">
      <p className="font-display text-[28px] leading-[1.3] font-medium tracking-[-0.01em]">{t("title")}</p>
      {who || offer ? (
        <dl className="grid gap-4">
          <div className="grid gap-0.5">
            <dt className="text-sm text-muted-foreground">{t("service")}</dt>
            {offer ? (
              <>
                <dd className="font-medium">{offer.name}</dd>
                <dd className="text-sm text-muted-foreground">{text.duration(offer)}</dd>
              </>
            ) : (
              <dd className="text-muted-foreground">{t("chooseService")}</dd>
            )}
          </div>
          <div className="grid gap-0.5">
            <dt className="text-sm text-muted-foreground">{t("with")}</dt>
            <dd className="font-medium">{designer ? designer.displayName : anyone("title")}</dd>
            {!designer && <dd className="text-sm text-muted-foreground">{anyone("assigned")}</dd>}
          </div>
          {offer && (
            <>
              <div className="grid gap-0.5">
                <dt className="text-sm text-muted-foreground">{t("when")}</dt>
                <dd className={cn(startAt ? "font-medium" : "text-muted-foreground")}>
                  {startAt ? f.inTz(startAt, salon.timezone, "dateTimeLong") : t("chooseTime")}
                </dd>
              </div>
              <div className="flex items-baseline justify-between border-t pt-4">
                <dt className="text-sm text-muted-foreground">{t("price")}</dt>
                <dd className="text-lg tabular-nums">{text.price(offer)}</dd>
              </div>
            </>
          )}
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
function Summary({ who, offer, startAt, timezone }: { who?: Who; offer: Offer; startAt?: string; timezone: string }) {
  const f = useFormat();
  const t = useTranslations("booking");
  const text = useOfferText();
  const designer = namedDesigner(who, offer);
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-butter px-5 py-4 lg:hidden">
      <div className="grid gap-0.5">
        <span className="font-medium">
          {t.rich("serviceWith", {
            service: offer.name,
            designer: designer ? designer.displayName : t("anyone.short"),
            muted: (chunks) => <span className="text-muted-foreground">{chunks}</span>,
          })}
        </span>
        <span className="text-sm text-muted-foreground">
          {text.duration(offer)}
          {startAt ? ` · ${f.inTz(startAt, timezone)}` : ""}
        </span>
      </div>
      <span className="tabular-nums">{text.price(offer)}</span>
    </div>
  );
}

function BackButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-3 inline-flex h-10 items-center gap-1.5 justify-self-start rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <ArrowLeft aria-hidden className="size-4" />
      {children}
    </button>
  );
}

/** The options a choice can be booked through: one named person, or everyone in the merged line. */
const serviceIdsOf = (offer: Offer) => offer.options.map((o) => o.service.id);

function TimePicker({
  salon,
  who,
  offer,
  onBack,
  onPick,
}: {
  salon: PublicSalon;
  who?: Who;
  offer: Offer;
  onBack: () => void;
  onPick: (startAt: string) => void;
}) {
  const f = useFormat();
  const t = useTranslations("booking");
  const from = useMemo(() => todayIn(salon.timezone), [salon.timezone]);
  const [date, setDate] = useState(from);
  const [only] = offer.options;

  const availability = useQuery({
    queryKey: ["public-availability", salon.slug, ...serviceIdsOf(offer), from],
    queryFn: () =>
      api<AvailabilityResponse>(
        offer.options.length === 1
          ? `/public/salons/${salon.slug}/availability?designerId=${only.designer.id}&serviceId=${only.service.id}&from=${from}&days=${DAYS_SHOWN}`
          : `/public/salons/${salon.slug}/availability/any?serviceIds=${serviceIdsOf(offer).join(",")}&from=${from}&days=${DAYS_SHOWN}`,
      ),
    staleTime: 15_000,
  });

  const days = availability.data?.days ?? [];
  const selected = days.find((d) => d.date === date);
  const firstOpen = days.find((d) => d.slots.length > 0)?.date;

  return (
    <div className="grid gap-8 animate-in fade-in duration-300">
      <BackButton onClick={onBack}>{t("back.allServices")}</BackButton>
      <Summary who={who} offer={offer} timezone={salon.timezone} />

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
                  "grid min-w-[4.75rem] shrink-0 snap-start gap-0.5 rounded-2xl border px-3 py-3 text-center text-sm transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  // The selected day is a pill toggle, so it takes the navy pair (DESIGN.md "Primary").
                  // A selected day stays solid even when closed (today after hours): faded navy reads as grey mush.
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-card hover:border-foreground disabled:opacity-40 disabled:hover:border-input",
                  "disabled:cursor-not-allowed",
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
              <div key={i} className="h-12 animate-pulse rounded-full bg-muted" />
            ))}
          </div>
        )}
        {availability.isError && <p className="text-destructive">{t("time.loadError")}</p>}
        {selected && selected.slots.length === 0 && (
          <div className="grid justify-items-start gap-4 rounded-lg bg-lavender px-6 py-6">
            <p>{t("time.nothingOpen")}</p>
            {firstOpen && firstOpen !== date && (
              <Button variant="outline" className={outlinePillSm} onClick={() => setDate(firstOpen)}>
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
                className={cn(outlinePillSm, "h-12 border-input text-base tabular-nums dark:border-input")}
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
  who,
  offer,
  startAt,
  onBack,
  onDone,
}: {
  salon: PublicSalon;
  who?: Who;
  offer: Offer;
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

  // One option books that person; several ask the server to pick whoever is free.
  const book = useMutation({
    mutationFn: (input: Omit<BookAppointmentInput, "designerId" | "serviceId">) => {
      const [only] = offer.options;
      return offer.options.length === 1
        ? api<CustomerAppointment>(`/public/salons/${salon.slug}/appointments`, {
            method: "POST",
            json: { ...input, designerId: only.designer.id, serviceId: only.service.id } satisfies BookAppointmentInput,
          })
        : api<CustomerAppointment>(`/public/salons/${salon.slug}/appointments/any`, {
            method: "POST",
            json: { ...input, serviceIds: serviceIdsOf(offer) } satisfies BookAnyAppointmentInput,
          });
    },
    onSuccess: onDone,
  });

  const err = book.error instanceof ApiError ? book.error : null;
  const fieldError = (path: string) => err?.issues.find((i) => i.path === `customer.${path}` || i.path === path)?.message;

  return (
    <div className="grid gap-8 animate-in fade-in duration-300">
      <BackButton onClick={onBack}>{t("back.changeTime")}</BackButton>
      <Summary who={who} offer={offer} startAt={startAt} timezone={salon.timezone} />
      <section aria-labelledby="bk-title" className="grid gap-6 rounded-lg bg-muted px-6 py-8 md:p-10">
        <div className="grid gap-1.5">
          <h2 id="bk-title" className="text-[28px] leading-[1.3]">
            {t("details.title")}
          </h2>
          <p className="text-muted-foreground">{user ? t("details.bookingAs", { email: user.email }) : t("details.noAccount")}</p>
        </div>
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            book.mutate({
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
            <Input
              id="bk-name"
              className={pillInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
            />
            <FieldError message={fieldError("name")} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="bk-email">{t("details.email")}</Label>
              <Input
                id="bk-email"
                className={pillInput}
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
              <Input
                id="bk-phone"
                className={pillInput}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
              />
              <FieldError message={fieldError("phone")} />
            </div>
          </div>
          <SmsConsent checked={smsConsent} onChange={setSmsConsent} hasPhone={Boolean(phone.trim())} />
          <div className="grid gap-2">
            <Label htmlFor="bk-notes">{t("details.notes")}</Label>
            {/* Not a pill: a multi-line field in a full capsule clips its corners. */}
            <Textarea
              id="bk-notes"
              rows={2}
              className="rounded-3xl bg-card px-6 py-3 text-base md:text-base dark:bg-card"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {err && !err.issues.length && <FieldError message={err.message} />}
          <Button type="submit" size="lg" className={cn(pillButton, "w-full text-base")} disabled={book.isPending}>
            {book.isPending ? t("details.submitting") : t("details.submit")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("summary.cancellation", { hours: salon.cancelWindowHours })}</p>
        </form>
      </section>
    </div>
  );
}

function Confirmation({ appt }: { appt: CustomerAppointment }) {
  const f = useFormat();
  const { user } = useAuth();
  const t = useTranslations("booking.done");
  return (
    <div className="grid items-center gap-6 rounded-lg bg-butter px-6 py-10 animate-in fade-in slide-in-from-bottom-3 duration-500 md:grid-cols-[minmax(0,1fr)_auto] md:gap-12 md:p-16">
      <div className="grid max-w-2xl gap-6">
        <span className="grid size-12 place-items-center rounded-full bg-foreground text-background">
          <Check aria-hidden className="size-6" />
        </span>
        <div className="grid gap-2">
          <h2 className="text-4xl leading-[1.2] md:text-5xl">{t("title")}</h2>
          <p className="text-lg text-body">
            {t("summary", {
              service: appt.serviceName,
              designer: appt.designerName,
              salon: appt.salon.name,
            })}
          </p>
        </div>
        {/* A time, so Geist: DESIGN.md keeps numbers out of the serif. */}
        <p className="text-3xl font-semibold tracking-[-0.02em]">{f.inTz(appt.startAt, appt.salon.timezone, "dateTimeLong")}</p>
        <p className="text-body">
          {t("payAtSalon", { price: f.cents(appt.priceCents) })}
          {appt.cancellableUntil && (
            <>
              {" "}
              {t("cancelUntil", {
                time: f.inTz(appt.cancellableUntil, appt.salon.timezone),
              })}
            </>
          )}
        </p>
        <div className="border-t border-border pt-6">
          {user ? (
            <Button size="lg" className={cn(pillButton, "text-base")} nativeButton={false} render={<Link href="/appointments" />}>
              {t("seeAppointments")}
            </Button>
          ) : (
            <p className="text-body">
              {t.rich("createAccount", {
                link: (chunks) => (
                  <Link href="/register?next=/appointments" className={textLink}>
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          )}
        </div>
      </div>
      <Image
        src="/images/mona-hairflip.png"
        alt=""
        width={720}
        height={715}
        sizes="(min-width: 768px) 240px, 160px"
        className="m-auto h-auto w-40 md:w-60"
      />
    </div>
  );
}
