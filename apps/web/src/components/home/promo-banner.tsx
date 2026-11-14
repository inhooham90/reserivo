import { INTRO_MONTHS, INTRO_OFFER_ADVERTISED, INTRO_PRICE_CENTS, PLAN_PRICE_CENTS } from "@reserivo/shared";
import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatPrice } from "@/lib/format";

/**
 * The launch-offer strip above the site header on the marketing pages. It
 * scrolls away with the page (the header below it is the sticky part), and
 * goes entirely when INTRO_OFFER_ADVERTISED is switched off. `linkToPricing`
 * is false on the pricing page itself, where the link would point at itself.
 */
export function PromoBanner({ linkToPricing = true }: { linkToPricing?: boolean }) {
  const t = useTranslations("promo");
  const locale = useLocale() as Locale;
  if (!INTRO_OFFER_ADVERTISED) return null;

  const values = {
    intro: formatPrice(INTRO_PRICE_CENTS, locale),
    months: INTRO_MONTHS,
    price: formatPrice(PLAN_PRICE_CENTS, locale),
  };
  return (
    <aside
      data-component="PromoBanner"
      aria-label={t("label")}
      className="relative z-30 bg-mona-ink px-6 py-2.5 text-center text-sm text-white"
    >
      <span className="font-semibold">{t("badge")}</span> <span>{t("text", values)}</span>
      {linkToPricing && (
        <>
          {" "}
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1 rounded-sm font-semibold whitespace-nowrap underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {t("link")}
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </>
      )}
    </aside>
  );
}
