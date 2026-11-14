"use client";

import { useTranslations } from "next-intl";
import { useBilling } from "@/components/settings/billing-settings";
import { Link } from "@/i18n/navigation";
import { useSalon } from "@/lib/salon-context";
import { useFormat } from "@/lib/use-format";
import { outlinePillSm } from "@/lib/v3";
import { cn } from "cn";

/**
 * On the schedule, where every sign-in lands: tells a manager when the
 * business's online booking is paused, is about to be, or the card failed.
 * Silent when billing is fine or switched off, and never shown to team
 * members, who cannot do anything about it.
 */
export function BillingNotice() {
  const { salon, isManager } = useSalon();
  const t = useTranslations("settings.billing.notice");
  const f = useFormat();
  const billing = useBilling(salon.id, isManager);
  const b = billing.data;
  if (!b?.enforced || b.state === "active") return null;

  const paused = !b.acceptingBookings;
  const key = paused ? "paused" : b.state === "pastDue" ? "pastDue" : "grace";
  return (
    <section
      data-component="BillingNotice"
      aria-labelledby="billing-notice-title"
      className={cn("flex flex-wrap items-center justify-between gap-4 rounded-lg p-5 md:px-8", paused ? "bg-destructive/10" : "bg-lavender")}
    >
      <div className="grid min-w-0 gap-1">
        <h2 id="billing-notice-title" className="font-sans text-base font-semibold tracking-normal">
          {t(`${key}.title`)}
        </h2>
        <p className="text-sm text-body">
          {t(`${key}.body`, { date: b.graceUntil ? f.inTz(b.graceUntil, salon.timezone, "dateWithYear") : "" })}
        </p>
      </div>
      <Link href={`/s/${salon.id}/settings/billing`} className={cn(outlinePillSm, "inline-flex items-center border text-sm font-medium")}>
        {t(`${key}.action`)}
      </Link>
    </section>
  );
}
