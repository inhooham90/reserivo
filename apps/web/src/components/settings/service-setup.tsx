"use client";

import { canAllowDoubleBooking, MAX_SERVICES_PER_BATCH, type Member, type Service } from "@reserivo/shared";
import { useMutation } from "@tanstack/react-query";
import { Check, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FieldError } from "@/components/field-error";
import { useSettingsDialog } from "@/components/settings/settings-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { QUICK_DURATIONS, SERVICE_TEMPLATES, TEMPLATE_GROUPS, type TemplateGroup } from "@/lib/service-templates";
import { useFormat } from "@/lib/use-format";
import { ghostPillSm, pillButtonSm, pillInputSm, pillSelectSm } from "@/lib/v3";
import { cn } from "cn";

/** One service on its way in. `key` says where it came from, so a chip can tell whether it is picked. */
interface Draft {
  key: string;
  name: string;
  /** As typed, so "" (not yet entered) is different from "0" (free). */
  price: string;
  durationMin: number;
  bufferMin: number;
  category: string | null;
  description: string | null;
  allowsDoubleBooking: boolean;
}

const ALL_DURATIONS = Array.from({ length: 120 }, (_, i) => (i + 1) * 5);

const chipBase =
  "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed";
/** DESIGN.md: a selected state is Ink, never Navy; navy stays on the primary button. */
const chipOn = "border-foreground bg-foreground text-background";
const chipOff = "border-input bg-card text-foreground hover:border-foreground disabled:opacity-50 disabled:hover:border-input";

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/** Whole dollars stay whole ("45"), anything else keeps its cents ("45.50"). */
const dollars = (cents: number) => (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));

/** Accepts "45", "45.5", "$45" and the comma decimal Spanish speakers type ("45,50"). Null if it is not a price. */
function parsePrice(raw: string): number | null {
  const s = raw.trim().replace(/^\$/, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n <= 10_000 ? Math.round(n * 100) : null;
}

/**
 * Guided setup for a member's menu, replacing the one-blank-form-per-service
 * slog. Step one is tapping: a starter catalog by trade, a teammate's menu to
 * copy, or names typed straight in. Step two is only what a client needs to
 * see — price and length — for all of them on one screen, saved in a single
 * request. Descriptions, buffers and double booking stay on each service's
 * Edit form; asking for them here would put the long form back.
 *
 * Built for a phone first: chips are 40px targets, prices raise the decimal
 * keypad, and Back/Next sit in the dialog's pinned footer under the thumb.
 */
export function ServiceSetup({
  salonId,
  designerId,
  existing,
  allServices,
  members,
  onDone,
  onCancel,
}: {
  salonId: string;
  designerId: string;
  /** This member's current services, so nothing is added twice. */
  existing: Service[];
  allServices: Service[];
  members: Member[];
  onDone: (added: number) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("settings.serviceSetup");
  const { footer } = useSettingsDialog();
  const [step, setStep] = useState<"pick" | "details">("pick");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const firstRender = useRef(true);

  // Moving between steps lands at the top of the new one, with focus on its
  // heading, so a screen reader announces where it is and a phone is not left
  // scrolled halfway down the previous list.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  const save = useMutation({
    mutationFn: (services: object[]) =>
      api<Service[]>(`/salons/${salonId}/services/bulk`, { method: "POST", json: { designerId, services } }),
    onSuccess: (rows) => onDone(rows.length),
  });

  const has = (key: string) => drafts.some((d) => d.key === key);
  const toggle = (draft: Draft) =>
    setDrafts((ds) => (ds.some((d) => d.key === draft.key) ? ds.filter((d) => d.key !== draft.key) : [...ds, draft]));
  const patch = (key: string, change: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...change } : d)));
  const remove = (key: string) => {
    const rest = drafts.filter((d) => d.key !== key);
    setDrafts(rest);
    if (rest.length === 0) setStep("pick");
  };

  const problems = (d: Draft) => ({
    name: !d.name.trim() ? t("nameRequired") : undefined,
    price: !d.price.trim() ? t("priceRequired") : parsePrice(d.price) === null ? t("priceInvalid") : undefined,
  });
  const invalid = drafts.some((d) => {
    const p = problems(d);
    return p.name || p.price;
  });
  const tooMany = drafts.length > MAX_SERVICES_PER_BATCH;

  const submit = () => {
    setShowErrors(true);
    if (invalid || tooMany) {
      // The first missing price may be a long way down on a phone; take the person to it.
      requestAnimationFrame(() => list.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    save.mutate(
      drafts.map((d) => ({
        name: d.name.trim(),
        priceCents: parsePrice(d.price)!,
        durationMin: d.durationMin,
        bufferMin: d.bufferMin,
        category: d.category,
        description: d.description,
        // A copied long service may have been shortened here.
        allowsDoubleBooking: d.allowsDoubleBooking && canAllowDoubleBooking(d.durationMin),
      })),
    );
  };

  const bar = (
    // On a phone the status takes its own line so the two buttons always stay side by side.
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border px-4 py-3 md:flex-nowrap md:px-8 md:py-4">
      <div aria-live="polite" className="w-full min-w-0 text-sm text-body md:mr-auto md:w-auto">
        {step === "details" && showErrors && (invalid || tooMany) ? (
          <FieldError message={tooMany ? t("tooMany", { max: MAX_SERVICES_PER_BATCH }) : t("fixErrors")} />
        ) : save.error ? (
          <FieldError message={save.error instanceof ApiError ? save.error.message : t("saveFailed")} />
        ) : (
          t("selected", { count: drafts.length })
        )}
      </div>
      <div className="ml-auto flex shrink-0 gap-2">
        {step === "pick" ? (
          <>
            <Button variant="ghost" className={ghostPillSm} onClick={onCancel}>
              {t("cancel")}
            </Button>
            <Button className={pillButtonSm} disabled={drafts.length === 0} onClick={() => setStep("details")}>
              {t("next")}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" className={ghostPillSm} onClick={() => setStep("pick")}>
              {t("back")}
            </Button>
            <Button className={pillButtonSm} disabled={save.isPending} onClick={submit}>
              {save.isPending ? t("saving") : t("save", { count: drafts.length })}
            </Button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <p className="text-sm text-muted-foreground">{t("step", { n: step === "pick" ? 1 : 2, total: 2 })}</p>
        <h3 ref={heading} tabIndex={-1} className="font-sans text-xl font-semibold tracking-normal outline-none">
          {step === "pick" ? t("pickTitle") : t("detailsTitle")}
        </h3>
        <p className="max-w-[62ch] text-sm text-body">{step === "pick" ? t("pickHint") : t("detailsHint")}</p>
      </div>

      {step === "pick" ? (
        <Pick
          designerId={designerId}
          drafts={drafts}
          existing={existing}
          allServices={allServices}
          members={members}
          has={has}
          toggle={toggle}
          add={(d) => setDrafts((ds) => [...ds, d])}
        />
      ) : (
        <ul ref={list} className="grid gap-3">
          {drafts.map((d) => (
            <DraftCard
              key={d.key}
              draft={d}
              errors={showErrors ? problems(d) : {}}
              onChange={(change) => patch(d.key, change)}
              onRemove={() => remove(d.key)}
            />
          ))}
        </ul>
      )}

      {footer ? createPortal(bar, footer) : bar}
    </div>
  );
}

function Pick({
  designerId,
  drafts,
  existing,
  allServices,
  members,
  has,
  toggle,
  add,
}: {
  designerId: string;
  drafts: Draft[];
  existing: Service[];
  allServices: Service[];
  members: Member[];
  has: (key: string) => boolean;
  toggle: (d: Draft) => void;
  add: (d: Draft) => void;
}) {
  const t = useTranslations("settings.serviceSetup");
  const f = useFormat();
  const [group, setGroup] = useState<TemplateGroup>(TEMPLATE_GROUPS[0]);
  const [own, setOwn] = useState("");
  const ownId = useId();
  const nextOwn = useRef(0);

  // Named like something already on the menu, or already picked under another key.
  const taken = (name: string, key: string) =>
    existing.some((s) => sameName(s.name, name)) || drafts.some((d) => d.key !== key && sameName(d.name, name));

  const blank = (key: string, name: string, durationMin: number): Draft => ({
    key,
    name,
    price: "",
    durationMin,
    bufferMin: 0,
    category: null,
    description: null,
    allowsDoubleBooking: false,
  });

  const teammates = members
    .filter((m) => m.id !== designerId && m.roles.includes("DESIGNER"))
    .map((m) => ({ member: m, services: allServices.filter((s) => s.designerId === m.id && s.active) }))
    .filter((x) => x.services.length > 0);

  const templateDraft = (g: TemplateGroup, id: string, durationMin: number) =>
    blank(`tpl:${g}.${id}`, t(`catalog.${g}.items.${id}`), durationMin);
  const copyDraft = (s: Service): Draft => ({
    key: `copy:${s.id}`,
    name: s.name,
    price: dollars(s.priceCents),
    durationMin: s.durationMin,
    bufferMin: s.bufferMin,
    category: s.category,
    description: s.description,
    allowsDoubleBooking: s.allowsDoubleBooking,
  });

  const picked = (g: TemplateGroup) => drafts.filter((d) => d.key.startsWith(`tpl:${g}.`)).length;
  const custom = drafts.filter((d) => d.key.startsWith("own:"));

  return (
    <div className="grid gap-8">
      {/* Typing a name and pressing Enter is the fastest path for anything the catalog lacks; the field keeps focus for the next one. */}
      <section className="grid gap-3">
        <label htmlFor={ownId} className="text-sm font-medium">
          {t("ownLabel")}
        </label>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = own.trim().slice(0, 120);
            if (!name || taken(name, "")) return;
            add(blank(`own:${nextOwn.current++}`, name, 60));
            setOwn("");
          }}
        >
          <Input
            id={ownId}
            value={own}
            onChange={(e) => setOwn(e.target.value)}
            placeholder={t("ownPlaceholder")}
            enterKeyHint="done"
            autoComplete="off"
            className={cn(pillInputSm, "flex-1")}
          />
          <Button type="submit" variant="outline" className="h-10 rounded-full px-4" disabled={!own.trim() || taken(own, "")}>
            <Plus aria-hidden />
            {t("ownAdd")}
          </Button>
        </form>
        {own.trim() && taken(own, "") && <p className="text-sm text-muted-foreground">{t("alreadyHave")}</p>}
        {custom.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {custom.map((d) => (
              <li key={d.key}>
                <button type="button" aria-pressed onClick={() => toggle(d)} className={cn(chipBase, chipOn)} aria-label={t("remove", { name: d.name })}>
                  <Check aria-hidden className="size-4" />
                  {d.name}
                  <X aria-hidden className="size-4 opacity-70" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {teammates.map(({ member, services }) => {
        const addable = services.filter((s) => !taken(s.name, `copy:${s.id}`));
        const allOn = addable.length > 0 && addable.every((s) => has(`copy:${s.id}`));
        return (
          <section key={member.id} className="grid gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h4 className="text-sm font-medium">{t("copyFrom", { name: member.displayName })}</h4>
                <p className="text-sm text-muted-foreground">{t("copyHint")}</p>
              </div>
              {addable.length > 1 && (
                <button
                  type="button"
                  className="text-sm font-medium underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() => addable.forEach((s) => (allOn ? has(`copy:${s.id}`) : !has(`copy:${s.id}`)) && toggle(copyDraft(s)))}
                >
                  {allOn ? t("clearAll") : t("selectAll")}
                </button>
              )}
            </div>
            <ul className="flex flex-wrap gap-2">
              {services.map((s) => {
                const key = `copy:${s.id}`;
                const on = has(key);
                const dup = !on && taken(s.name, key);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={dup}
                      title={dup ? t("alreadyHave") : undefined}
                      onClick={() => toggle(copyDraft(s))}
                      className={cn(chipBase, on ? chipOn : chipOff)}
                    >
                      {on ? <Check aria-hidden className="size-4" /> : <Plus aria-hidden className="size-4" />}
                      {s.name}
                      <span className={cn("tabular-nums", on ? "opacity-80" : "text-muted-foreground")}>
                        {f.cents(s.priceCents)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <section className="grid gap-3">
        <h4 className="text-sm font-medium">{t("starterLabel")}</h4>
        {/* Trades as a filter row: one group of chips at a time keeps the phone from scrolling past fifty. */}
        <div role="group" aria-label={t("starterLabel")} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {TEMPLATE_GROUPS.map((g) => {
            const n = picked(g);
            return (
              <button
                key={g}
                type="button"
                aria-pressed={g === group}
                onClick={() => setGroup(g)}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  g === group ? "bg-lavender" : "hover:bg-surface-muted",
                )}
              >
                {t(`catalog.${g}.label`)}
                {n > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-foreground px-1.5 text-xs text-background tabular-nums">
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <ul className="flex flex-wrap gap-2">
          {Object.entries(SERVICE_TEMPLATES[group]).map(([id, durationMin]) => {
            const d = templateDraft(group, id, durationMin);
            const on = has(d.key);
            const dup = !on && taken(d.name, d.key);
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={dup}
                  title={dup ? t("alreadyHave") : undefined}
                  onClick={() => toggle(d)}
                  className={cn(chipBase, on ? chipOn : chipOff)}
                >
                  {on || dup ? <Check aria-hidden className="size-4" /> : <Plus aria-hidden className="size-4" />}
                  {d.name}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function DraftCard({
  draft,
  errors,
  onChange,
  onRemove,
}: {
  draft: Draft;
  errors: { name?: string; price?: string };
  onChange: (change: Partial<Draft>) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("settings.serviceSetup");
  const f = useFormat();
  const id = useId();
  const quick = (QUICK_DURATIONS as readonly number[]).includes(draft.durationMin);

  return (
    <li className="grid gap-4 rounded-lg bg-muted p-4 md:p-5">
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <Input
            id={`${id}-name`}
            aria-label={t("name")}
            aria-invalid={Boolean(errors.name)}
            value={draft.name}
            maxLength={120}
            onChange={(e) => onChange({ name: e.target.value })}
            className={cn(pillInputSm, "flex-1 font-medium")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 shrink-0 rounded-full hover:bg-surface-muted"
            aria-label={t("remove", { name: draft.name || t("name") })}
            onClick={onRemove}
          >
            <X aria-hidden className="size-4" />
          </Button>
        </div>
        <FieldError message={errors.name} />
      </div>

      <div className="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <div className="grid content-start gap-1.5">
          <label htmlFor={`${id}-price`} className="text-sm font-medium">
            {t("price")}
          </label>
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              id={`${id}-price`}
              inputMode="decimal"
              enterKeyHint="next"
              autoComplete="off"
              aria-invalid={Boolean(errors.price)}
              value={draft.price}
              onChange={(e) => onChange({ price: e.target.value })}
              className={cn(pillInputSm, "pl-8 tabular-nums")}
            />
          </div>
          <FieldError message={errors.price} />
        </div>

        <fieldset className="grid content-start gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">{t("duration")}</legend>
          <div className="flex flex-wrap gap-2">
            {QUICK_DURATIONS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={draft.durationMin === m}
                onClick={() => onChange({ durationMin: m })}
                className={cn(chipBase, "px-3.5 tabular-nums", draft.durationMin === m ? chipOn : chipOff)}
              >
                {f.duration(m)}
              </button>
            ))}
            {/* The native select is a wheel on phones, which beats typing minutes. */}
            <select
              aria-label={t("otherDuration")}
              value={quick ? "" : String(draft.durationMin)}
              onChange={(e) => e.target.value && onChange({ durationMin: Number(e.target.value) })}
              className={cn(pillSelectSm, !quick && "border-foreground bg-foreground text-background")}
            >
              <option value="" disabled>
                {t("otherDuration")}
              </option>
              {ALL_DURATIONS.map((m) => (
                <option key={m} value={m}>
                  {f.duration(m)}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
      </div>
    </li>
  );
}
