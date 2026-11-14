import { INTRO_MONTHS, INTRO_OFFER_ADVERTISED, INTRO_PRICE_CENTS, LEGAL, PLAN_PRICE_CENTS } from "@reserivo/shared";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PromoBanner } from "@/components/home/promo-banner";
import { SiteHeader } from "@/components/home/site-header";
import { PublicFooter } from "@/components/legal/public-footer";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatPrice } from "@/lib/format";
import { inkPill } from "@/lib/v3";
import { cn } from "cn";

type Props = { params: Promise<{ locale: string }> };

const FEATURES = ["page", "team", "unlimited", "reminders", "clients", "messages"] as const;
const FAQ = ["offer", "perPerson", "cancel", "ends", "clientsPay", "promo"] as const;

/**
 * The public pricing page, on the website board's type roles (Fredoka
 * headings, serif body in olive) like the home page. One plan, so one card:
 * the launch offer leads while INTRO_OFFER_ADVERTISED is on, and the regular
 * price takes over when it is switched off. The amounts come from
 * packages/shared/src/billing.ts, the same constants the billing pane uses, and
 * must match the Stripe price and coupon (the API warns at boot when they do not).
 */
export default async function PricingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "pricing" });
  const loc = locale as Locale;
  const values = {
    intro: formatPrice(INTRO_PRICE_CENTS, loc),
    price: formatPrice(PLAN_PRICE_CENTS, loc),
    months: INTRO_MONTHS,
    product: LEGAL.product,
    email: LEGAL.supportEmail,
  };

  return (
    <div className="theme-morrri relative isolate flex flex-1 flex-col bg-canvas">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[620px] bg-[radial-gradient(38%_46%_at_16%_4%,color-mix(in_srgb,var(--lisa)_42%,transparent),transparent_72%),radial-gradient(34%_42%_at_86%_20%,color-mix(in_srgb,var(--peach)_55%,transparent),transparent_72%),linear-gradient(to_bottom,color-mix(in_srgb,var(--lisa-soft)_45%,var(--canvas)),var(--canvas))]"
      />
      <PromoBanner linkToPricing={false} />
      <SiteHeader page="pricing" />

      <main id="main" tabIndex={-1} className="flex-1 px-6 pb-20 outline-none md:pb-28">
        <section aria-labelledby="pricing-title" className="mx-auto flex max-w-[680px] flex-col items-center gap-5 pt-8 text-center md:pt-14">
          <h1
            id="pricing-title"
            className="font-brand text-[40px] leading-[1.05] font-bold tracking-[-0.01em] text-balance text-mona-ink sm:text-[52px] md:text-[60px]"
          >
            {t("title")}
          </h1>
          <p className="max-w-[34rem] font-display text-lg leading-normal text-mona-ink md:text-xl">{t("subtitle")}</p>
        </section>

        {/* The plan. */}
        <section
          data-component="PlanCard"
          aria-labelledby="plan-title"
          className="mx-auto mt-12 grid max-w-[920px] overflow-hidden rounded-2xl border border-rule bg-white md:mt-16 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        >
          <div className="grid content-start gap-4 bg-mona-butter p-8 md:p-10">
            <h2 id="plan-title" className="font-brand text-2xl font-bold text-mona-ink">
              {t("planName", values)}
            </h2>
            {INTRO_OFFER_ADVERTISED ? (
              <>
                <p className="justify-self-start rounded-full bg-mona-ink px-3 py-1 text-sm font-semibold text-white">{t("offerBadge")}</p>
                <p className="flex flex-wrap items-baseline gap-x-2 text-mona-ink">
                  <span className="font-brand text-[64px] leading-none font-bold">{values.intro}</span>
                  <span className="font-display text-lg">{t("perMonthFor", values)}</span>
                </p>
                <p className="font-display text-lg text-mona-ink">{t("then", values)}</p>
              </>
            ) : (
              <p className="flex flex-wrap items-baseline gap-x-2 text-mona-ink">
                <span className="font-brand text-[64px] leading-none font-bold">{values.price}</span>
                <span className="font-display text-lg">{t("perMonth")}</span>
              </p>
            )}
            <p className="font-display text-base text-olive">{t("perBusiness")}</p>
            <div className="mt-2">
              <Button nativeButton={false} className={inkPill} render={<Link href="/register" />}>
                {t("cta")}
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
            <p className="text-sm text-olive">{t("ctaNote", values)}</p>
          </div>
          <div className="grid content-start gap-5 p-8 md:p-10">
            <h3 className="font-brand text-xl font-semibold text-mona-ink">{t("includedTitle")}</h3>
            <ul className="grid gap-3.5">
              {FEATURES.map((key) => (
                <li key={key} className="flex gap-3 font-display text-[17px] leading-snug text-mona-ink">
                  <Check aria-hidden className="mt-0.5 size-5 shrink-0" />
                  {t(`features.${key}`, values)}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Questions. Native disclosure: keyboard and screen-reader behaviour for free. */}
        <section aria-labelledby="faq-title" className="mx-auto mt-16 max-w-[760px] md:mt-24">
          <h2
            id="faq-title"
            className="text-center font-brand text-[32px] leading-[1.1] font-semibold tracking-[-0.01em] text-mona-ink md:text-[44px]"
          >
            {t("faqTitle")}
          </h2>
          <div className="mt-8 divide-y divide-rule rounded-2xl border border-rule bg-white">
            {FAQ.filter((key) => INTRO_OFFER_ADVERTISED || key !== "offer").map((key) => (
              <details key={key} className="group px-6 py-5 md:px-8">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm font-brand text-lg font-semibold text-mona-ink outline-none focus-visible:ring-3 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  {t(`faq.${key}.q`)}
                  <ChevronDown aria-hidden className="size-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                </summary>
                <p className={cn("mt-3 font-display text-[17px] leading-[1.6] text-olive")}>{t(`faq.${key}.a`, values)}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <PublicFooter variant="home" className="max-w-[calc(1200px+5rem)] md:px-10" />
    </div>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pricing" });
  const loc = locale as Locale;
  return {
    title: t("metaTitle", { product: LEGAL.product }),
    description: INTRO_OFFER_ADVERTISED
      ? t("metaOffer", { intro: formatPrice(INTRO_PRICE_CENTS, loc), months: INTRO_MONTHS, price: formatPrice(PLAN_PRICE_CENTS, loc) })
      : t("metaPlan", { price: formatPrice(PLAN_PRICE_CENTS, loc) }),
  };
}
