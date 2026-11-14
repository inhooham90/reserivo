"use client";

import { INTRO_MONTHS, INTRO_PRICE_CENTS, PLAN_PRICE_CENTS, type BillingRedirect, type BillingStatus } from "@reserivo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FieldError } from "@/components/field-error";
import { SettingsRow, SettingsRows, SettingsSection } from "@/components/settings/settings-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { salonKeys, useSalon } from "@/lib/salon-context";
import { useFormat } from "@/lib/use-format";
import { outlinePillSm, pillButtonSm, pillInputSm } from "@/lib/v3";

export const billingKey = (salonId: string) => [...salonKeys.salon(salonId), "billing"] as const;

/** How long to keep re-reading after Stripe sends the manager back, waiting for the webhook. */
const AWAIT_WEBHOOK_MS = 30_000;

const isSubscribed = (b: BillingStatus | undefined) => b?.state === "active" || b?.state === "pastDue";

/** The business's billing status. Managers only, like the API route. `pollWhile` re-reads every two seconds while it holds. */
export function useBilling(salonId: string, enabled: boolean, pollWhile?: (data: BillingStatus | undefined) => boolean) {
  return useQuery({
    queryKey: billingKey(salonId),
    queryFn: () => api<BillingStatus>(`/salons/${salonId}/billing`),
    enabled,
    refetchInterval: pollWhile ? (query) => (pollWhile(query.state.data) ? 2_000 : false) : false,
  });
}

/**
 * One subscription per business, paid through Stripe. Checkout and the card
 * and invoice screens are Stripe's own hosted pages; this pane says where the
 * business stands and sends the manager there.
 *
 * The promo code is typed here, not in Checkout: Checkout cannot both apply
 * the automatic $1 offer and show its own code box, so the API swaps one
 * discount for the other.
 */
export default function BillingSettings() {
  const { salon, isManager } = useSalon();
  const t = useTranslations("settings.billing");
  const f = useFormat();
  const returned = useSearchParams().get("checkout") === "done";
  // Stripe redirects before (or just as) its webhook lands, so the status is
  // re-read every two seconds for a short while instead of asking for a reload.
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (!returned) return;
    const timer = setTimeout(() => setGaveUp(true), AWAIT_WEBHOOK_MS);
    return () => clearTimeout(timer);
  }, [returned]);
  const billing = useBilling(salon.id, isManager, (data) => returned && !gaveUp && !isSubscribed(data));
  const [promoCode, setPromoCode] = useState("");

  const redirect = (res: BillingRedirect) => window.location.assign(res.url);
  const checkout = useMutation({
    mutationFn: () => api<BillingRedirect>(`/salons/${salon.id}/billing/checkout`, { method: "POST", json: { promoCode } }),
    onSuccess: redirect,
  });
  const portal = useMutation({
    mutationFn: () => api<BillingRedirect>(`/salons/${salon.id}/billing/portal`, { method: "POST" }),
    onSuccess: redirect,
  });

  const b = billing.data;
  const subscribed = isSubscribed(b);
  const waiting = returned && !subscribed && !gaveUp;

  if (!isManager) return <p className="text-sm text-body">{t("managersOnly")}</p>;
  if (billing.isPending) return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
  if (!b) {
    return (
      <div className="grid justify-items-start gap-3">
        <FieldError message={billing.error?.message ?? t("loadFailed")} />
        <Button variant="outline" className={outlinePillSm} onClick={() => billing.refetch()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  const price = f.price(PLAN_PRICE_CENTS);
  const date = (iso: string | null) => (iso ? f.inTz(iso, salon.timezone, "dateWithYear") : "");
  const canPay = b.setup === "ready";
  const actionError = checkout.error ?? portal.error;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      {b.setup === "off" && <p className="rounded-lg bg-muted p-4 text-sm text-body">{t("notConfigured")}</p>}
      {b.setup === "unavailable" && (
        <p role="status" className="rounded-lg bg-muted p-4 text-sm text-body">
          {t("unavailable")}
        </p>
      )}
      {returned && !subscribed && (
        <p role="status" className="rounded-lg bg-lavender p-4 text-sm">
          {waiting ? t("processing") : t("processingSlow")}
        </p>
      )}

      <SettingsSection title={t("statusTitle")}>
        <SettingsRows>
          <SettingsRow
            label={t(`state.${b.state}.label`)}
            description={t(`state.${b.state}.body`, {
              price,
              date: date(b.state === "grace" ? b.graceUntil : b.currentPeriodEnd),
            })}
          />
          {subscribed && b.cancelAtPeriodEnd && b.currentPeriodEnd && (
            <SettingsRow label={t("cancelling")} description={t("cancellingBody", { date: date(b.currentPeriodEnd) })} />
          )}
          <SettingsRow label={t("onlineBooking")} description={t(b.acceptingBookings ? "bookingOn" : "bookingPaused")} />
        </SettingsRows>
      </SettingsSection>

      {subscribed ? (
        <SettingsSection title={t("manageTitle")} hint={t("manageHint")}>
          <div className="grid justify-items-start gap-2">
            <Button className={pillButtonSm} disabled={!canPay || portal.isPending} onClick={() => portal.mutate()}>
              {t("manage")}
            </Button>
            <FieldError message={portal.error?.message} />
          </div>
        </SettingsSection>
      ) : (
        <SettingsSection title={t("subscribeTitle")}>
          <form
            method="post"
            className="grid max-w-lg gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              checkout.mutate();
            }}
          >
            {/* The offer, set as a price rather than buried in a sentence. */}
            <div data-component="BillingOffer" className="grid gap-1 rounded-lg bg-butter p-5">
              {b.introOffer ? (
                <>
                  <p className="text-sm font-medium">{t("offerBadge")}</p>
                  <p className="font-heading text-[32px] leading-tight">
                    {t("offerPrice", { intro: f.price(INTRO_PRICE_CENTS), months: INTRO_MONTHS })}
                  </p>
                  <p className="text-sm text-body">{t("offerThen", { price })}</p>
                </>
              ) : (
                <p className="font-heading text-[32px] leading-tight">{t("plan", { price })}</p>
              )}
              <p className="mt-2 text-sm text-body">{t("included")}</p>
            </div>

            {b.introOffer && (
              <div className="grid gap-1.5">
                <label htmlFor="promo-code" className="text-sm font-medium">
                  {t("promoLabel")}
                </label>
                <Input
                  id="promo-code"
                  name="promoCode"
                  autoComplete="off"
                  autoCapitalize="characters"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className={pillInputSm}
                  aria-describedby="promo-hint"
                  aria-invalid={checkout.error instanceof ApiError && checkout.error.status === 400}
                />
                <p id="promo-hint" className="text-sm text-muted-foreground">
                  {t("promoHint")}
                </p>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" className={pillButtonSm} disabled={!canPay || checkout.isPending}>
                {checkout.isPending ? t("redirecting") : t("subscribe")}
              </Button>
              {b.hasBillingAccount && (
                <Button type="button" variant="outline" className={outlinePillSm} disabled={!canPay || portal.isPending} onClick={() => portal.mutate()}>
                  {t("invoices")}
                </Button>
              )}
            </div>
            {/* Auto-renewal disclosure, next to the button as US auto-renewal laws expect. */}
            <p className="text-sm text-muted-foreground">{t("renewal", { price })}</p>
            <FieldError message={actionError?.message} />
          </form>
        </SettingsSection>
      )}
    </div>
  );
}
