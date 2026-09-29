"use client";

import type { SetupStep } from "@reserivo/shared";
import { ChevronRight, ListChecks } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { useSettingsDialog } from "@/components/settings/settings-dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { useSalon } from "@/lib/salon-context";
import { CONFIRMABLE, nextOpenStep, STEP_ANCHOR, stepHref, useSetupProgress, useUpdateSetup } from "@/lib/setup-guide";
import { ghostPillSm, pillButtonSm } from "@/lib/v3";
import { cn } from "cn";

/**
 * The way back to a guide someone put away, in the settings rail rather than
 * the salon header: businesses that were running before the guide existed
 * start with it hidden, and a header badge would nag them on every page.
 * Hidden once every step is done.
 */
export function SetupReopen({ className }: { className: string }) {
  const { salon, me } = useSalon();
  const { close } = useSettingsDialog();
  const t = useTranslations("setup");
  const progress = useSetupProgress(salon.id, Boolean(me));
  const update = useUpdateSetup(salon.id);

  const data = progress.data;
  if (!data || !data.hidden) return null;
  const done = data.steps.filter((s) => s.done).length;
  if (data.steps.length === 0 || done === data.steps.length) return null;

  return (
    <div className="md:grid md:gap-1">
      <p className="mb-1 hidden px-3 text-xs font-medium text-muted-foreground md:block">{t("reopenGroup")}</p>
      <button
        type="button"
        className={className}
        disabled={update.isPending}
        onClick={async () => {
          await update.mutateAsync({ hidden: false });
          close();
        }}
      >
        <ListChecks aria-hidden className="size-[18px] shrink-0" />
        {t("reopen")}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{t("progressShort", { done, total: data.steps.length })}</span>
      </button>
    </div>
  );
}

/**
 * Shown at the top of a settings section opened from the setup guide
 * (`?guide=<step>`): which step this is, what to do here, and a Next that
 * carries on to the following section. Next on a step with seeded values
 * (business details, hours) also confirms it; on the others it only moves on,
 * so skipping services does not pretend they were added.
 *
 * Moving on replaces the history entry, like the rail, so one Back still
 * closes the dialog.
 */
export function GuideBanner() {
  const { salonId } = useParams<{ salonId: string }>();
  const step = useSearchParams().get("guide") as SetupStep | null;
  const { close } = useSettingsDialog();
  const router = useRouter();
  const t = useTranslations("setup");
  const progress = useSetupProgress(salonId, Boolean(step));
  const update = useUpdateSetup(salonId);
  const ref = useRef<HTMLDivElement>(null);

  const steps = progress.data?.steps ?? [];
  const index = steps.findIndex((s) => s.key === step);
  const known = step !== null && index >= 0;

  // Where a section holds more than this step (the hours pane opens on the
  // business's week), bring the person's own part into view once it renders.
  // Otherwise announce the banner to a screen reader by focusing it.
  useEffect(() => {
    if (!known) return;
    const anchor = STEP_ANCHOR[step];
    if (!anchor) {
      ref.current?.focus({ preventScroll: true });
      return;
    }
    let tries = 0;
    const timer = setInterval(() => {
      const el = document.getElementById(anchor);
      if (el || ++tries > 30) {
        clearInterval(timer);
        const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el?.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
      }
    }, 100);
    return () => clearInterval(timer);
  }, [known, step]);

  if (!known || !progress.data) return null;

  const following = nextOpenStep(progress.data, step);
  const followingHref = following ? stepHref(salonId, following) : null;

  const next = async () => {
    const after =
      CONFIRMABLE.includes(step) && !steps[index].done
        ? await update.mutateAsync({ done: [step as "business" | "businessHours" | "myHours"] })
        : progress.data!;
    const target = nextOpenStep(after, step);
    const href = target ? stepHref(salonId, target) : null;
    // `share` happens on the schedule's card, so the walk ends there too.
    if (href) router.replace(href);
    else close();
  };

  return (
    // Sticky, because the step may scroll the pane down to the person's own
    // part (their hours, their row) and Next has to stay in reach; the anchors
    // carry a matching scroll margin so they land below it. The white strip
    // above it covers the pane's top padding, which sticky would leave open.
    <div className="sticky -top-2 z-10 mb-8 bg-card pt-2">
      <div
        ref={ref}
        tabIndex={-1}
        role="region"
        aria-label={t("banner.label")}
        className="grid gap-3 rounded-lg bg-butter p-4 shadow-[0_8px_16px_-12px_var(--scrim)] outline-none md:flex md:items-center md:justify-between md:gap-6 md:p-5"
      >
        <div className="grid min-w-0 gap-1">
          <p className="text-sm font-medium text-body tabular-nums">{t("banner.step", { n: index + 1, total: steps.length })}</p>
          <p className="font-semibold">{t(`steps.${step}.title`)}</p>
          <p className="max-w-[60ch] text-sm text-body">{t(`steps.${step}.hint`)}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {/* On a phone the dialog is full screen and its own close button does the same, one thumb away. */}
          <Button variant="ghost" className={cn(ghostPillSm, "hidden md:inline-flex")} onClick={close}>
            {t("banner.backToSchedule")}
          </Button>
          <Button className={pillButtonSm} onClick={next} disabled={update.isPending}>
            {followingHref && following ? t("banner.next", { title: t(`steps.${following}.short`) }) : t("banner.finish")}
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
