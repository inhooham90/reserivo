"use client";

import type { SetupProgress, SetupStep } from "@reserivo/shared";
import { Check, ChevronDown, ChevronRight, Copy, ExternalLink } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { useSalon } from "@/lib/salon-context";
import { CONFIRMABLE, nextOpenStep, stepHref, useSetupProgress, useUpdateSetup } from "@/lib/setup-guide";
import { ghostPillSm, outlinePillSm, pillButtonSm } from "@/lib/v3";
import { cn } from "cn";

/**
 * The setup guide at the top of the schedule, where every sign-in lands. It
 * lists the steps for this person's roles (see `setupStepsFor`), puts the next
 * one forward with its main action, and hands off to the settings dialog,
 * where a banner walks on from section to section. It never duplicates a
 * settings screen: the steps are the real ones, so what is set up here is
 * exactly what is edited later.
 *
 * It goes when the person hides it, and comes back from the header link.
 */
export function SetupGuide() {
  const { salon, me } = useSalon();
  const t = useTranslations("setup");
  const progress = useSetupProgress(salon.id, Boolean(me));
  const update = useUpdateSetup(salon.id);
  const [showAll, setShowAll] = useState(false);

  const data = progress.data;
  if (!me || !data || data.hidden || data.steps.length === 0) return null;

  const done = data.steps.filter((s) => s.done).length;
  const total = data.steps.length;
  const next = nextOpenStep(data);
  const hide = () => update.mutate({ hidden: true });

  if (!next) return <AllDone onClose={hide} pending={update.isPending} />;

  return (
    <section aria-labelledby="setup-title" className="grid gap-6 rounded-lg bg-butter p-5 animate-in fade-in duration-300 md:p-8">
      <div className="flex items-start justify-between gap-4 md:gap-6">
        <div className="grid min-w-0 gap-3">
          <h2 id="setup-title" className="text-[24px] leading-[1.25] md:text-[28px]">
            {me.roles.includes("MANAGER") ? t("titleManager", { business: salon.name }) : t("titleMember", { business: salon.name })}
          </h2>
          <Progress done={done} total={total} />
        </div>
        <Button variant="ghost" className={cn(ghostPillSm, "-mr-2")} onClick={hide} disabled={update.isPending}>
          {t("hide")}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] lg:gap-6">
        <NextStep key={next} step={next} progress={data} />

        <div className="grid content-start gap-2">
          <button
            type="button"
            aria-expanded={showAll}
            onClick={() => setShowAll((v) => !v)}
            className="inline-flex h-10 items-center gap-1.5 justify-self-start rounded-full px-3 text-sm font-medium text-body transition-colors hover:bg-card/60 focus-visible:outline-2 focus-visible:outline-ring lg:hidden"
          >
            {t("allSteps", { count: total })}
            <ChevronDown aria-hidden className={cn("size-4 transition-transform", showAll && "rotate-180")} />
          </button>
          <ol aria-label={t("allStepsLabel")} className={cn("gap-1", showAll ? "grid" : "hidden lg:grid")}>
            {data.steps.map((s, i) => (
              <StepRow key={s.key} step={s.key} done={s.done} index={i} current={s.key === next} />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  const t = useTranslations("setup");
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={t("progressLabel")}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={t("progress", { done, total })}
        className="h-2 w-36 overflow-hidden rounded-full bg-card shadow-[inset_0_0_0_1px_var(--input)] md:w-48"
      >
        <div className="h-full rounded-full bg-foreground transition-[width] duration-500" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <span className="text-sm whitespace-nowrap text-body tabular-nums">{t("progress", { done, total })}</span>
    </div>
  );
}

/** The one step in front of the person: why it matters, the way in, and a way past it where that is honest. */
function NextStep({ step, progress }: { step: SetupStep; progress: SetupProgress }) {
  const { salon } = useSalon();
  const t = useTranslations("setup");
  const update = useUpdateSetup(salon.id);
  const href = stepHref(salon.id, step);
  const n = progress.steps.findIndex((s) => s.key === step) + 1;

  return (
    <div className="grid content-start gap-4 self-start rounded-lg bg-card p-5 shadow-[inset_0_0_0_1px_var(--border)] md:p-6">
      <div className="grid gap-1.5">
        <p className="text-sm font-medium text-muted-foreground">{t("nextUp", { n, total: progress.steps.length })}</p>
        <h3 className="font-sans text-xl font-semibold tracking-normal">{t(`steps.${step}.title`)}</h3>
        <p className="max-w-[56ch] text-body">{t(`steps.${step}.body`)}</p>
      </div>

      {step === "share" ? (
        <ShareActions />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {href && (
            <Button className={pillButtonSm} nativeButton={false} render={<Link href={href} />}>
              {t(`steps.${step}.action`)}
              <ChevronRight aria-hidden />
            </Button>
          )}
          {/* Seeded values look finished whether or not anyone checked them, so the guide asks. */}
          {CONFIRMABLE.includes(step) && (
            <Button
              variant="outline"
              className={outlinePillSm}
              disabled={update.isPending}
              onClick={() => update.mutate({ done: [step as "business" | "businessHours" | "myHours"] })}
            >
              {t(`steps.${step}.confirm`)}
            </Button>
          )}
          {step === "team" && (
            <Button variant="ghost" className={ghostPillSm} disabled={update.isPending} onClick={() => update.mutate({ done: ["team"] })}>
              {t("steps.team.skip")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Copying or opening the link is the whole step; either one ticks it. */
function ShareActions() {
  const { salon } = useSalon();
  const t = useTranslations("setup.steps.share");
  const update = useUpdateSetup(salon.id);
  const [copied, setCopied] = useState(false);
  // Client-only: the guide renders after its query resolves, never on the server.
  const url = `${window.location.origin}/${salon.slug}`;
  const mark = () => update.mutate({ done: ["share"] });

  return (
    <div className="grid gap-3">
      <p className="truncate rounded-full bg-muted px-4 py-2.5 font-mono text-sm" title={url}>
        {url.replace(/^https?:\/\//, "")}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          className={pillButtonSm}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            } catch {
              // No clipboard (an insecure origin, a denied permission): the link is on screen to copy by hand.
            }
            mark();
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? t("copied") : t("copy")}
        </Button>
        <Button
          variant="outline"
          className={outlinePillSm}
          nativeButton={false}
          render={<a href={`/${salon.slug}`} target="_blank" rel="noreferrer" onClick={mark} />}
        >
          <ExternalLink aria-hidden />
          {t("open")}
        </Button>
      </div>
      <span aria-live="polite" className="sr-only">
        {copied ? t("copied") : ""}
      </span>
    </div>
  );
}

function StepRow({ step, done, index, current }: { step: SetupStep; done: boolean; index: number; current: boolean }) {
  const { salon } = useSalon();
  const t = useTranslations("setup");
  const href = stepHref(salon.id, step);
  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full border text-xs tabular-nums",
          // DESIGN.md: a checked state is Ink, never Navy.
          done ? "border-foreground bg-foreground text-background" : current ? "border-foreground bg-card" : "border-input bg-card",
        )}
      >
        {done ? <Check className="size-3.5" /> : index + 1}
      </span>
      <span className={cn("min-w-0 flex-1", done && "text-body line-through decoration-1")}>{t(`steps.${step}.title`)}</span>
      <span className="sr-only">{done ? t("doneLabel") : current ? t("currentLabel") : ""}</span>
    </>
  );
  const row = "flex min-h-11 items-center gap-3 rounded-full px-2 py-1.5 text-sm font-medium";
  return (
    <li aria-current={current ? "step" : undefined}>
      {href && !done ? (
        <Link href={href} className={cn(row, "transition-colors hover:bg-card/70 focus-visible:outline-2 focus-visible:outline-ring")}>
          {body}
        </Link>
      ) : (
        <span className={row}>{body}</span>
      )}
    </li>
  );
}

function AllDone({ onClose, pending }: { onClose: () => void; pending: boolean }) {
  const { salon } = useSalon();
  const t = useTranslations("setup");
  return (
    <section
      aria-labelledby="setup-done"
      className="grid items-center gap-6 rounded-lg bg-butter p-5 animate-in fade-in duration-500 md:grid-cols-[minmax(0,1fr)_auto] md:p-8"
    >
      <div className="grid gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-foreground text-background">
          <Check aria-hidden className="size-5" />
        </span>
        <h2 id="setup-done" className="text-[24px] leading-[1.25] md:text-[28px]">
          {t("doneTitle")}
        </h2>
        <p className="max-w-[56ch] text-body">{t("doneBody", { business: salon.name })}</p>
        <Button className={cn(pillButtonSm, "justify-self-start")} onClick={onClose} disabled={pending}>
          {t("close")}
        </Button>
      </div>
      <Image src="/images/mona-hairflip.png" alt="" width={720} height={715} sizes="128px" className="hidden h-auto w-32 md:block" />
    </section>
  );
}
