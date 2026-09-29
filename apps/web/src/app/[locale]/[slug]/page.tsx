import type { PublicSalon } from "@reserivo/shared";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BookingFlow } from "@/components/booking/booking-flow";
import { PublicFooter } from "@/components/legal/public-footer";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { serverApi } from "@/lib/api-server";
import { LEGAL } from "@/lib/legal";
import { summarizeHours } from "@/lib/format";
import { cn } from "cn";

type Props = { params: Promise<{ locale: string; slug: string }> };

const container = "mx-auto w-full max-w-[calc(1200px+5rem)] px-6 md:px-10";

/**
 * Public booking page, on the Morrri v3 design (DESIGN.md): white page, the
 * salon's name on a lavender band, the flow below. Server-rendered shell (SEO,
 * fast first paint); the flow itself is a client island. Every color is a
 * token so a salon's own accent can override --primary later, and there is no
 * stock photography: a picture that is not of this salon would misrepresent it.
 */
export default async function SalonPublicPage({ params }: Props) {
  // A server component has no hooks, so `useFormat()` is unavailable here: the
  // locale comes off the route and goes to the pure formatter explicitly.
  const { locale, slug } = await params;
  const salon = await serverApi<PublicSalon>(`/salons/by-slug/${encodeURIComponent(slug)}`);
  if (!salon) notFound();
  const t = await getTranslations({ locale, namespace: "storefront" });

  return (
    <div className="theme-morrri flex flex-1 flex-col">
      <header className={cn(container, "flex items-center pt-8 pb-6")}>
        {/* The wordmark is artwork, never set in type. The salon is the headline; this is only the byline. */}
        <Link href="/" className="shrink-0 rounded-sm leading-none outline-none focus-visible:ring-3 focus-visible:ring-ring">
          <Image src="/images/morrri-wordmark.png" alt={LEGAL.product} width={74} height={18} priority />
        </Link>
      </header>
      <main id="main" tabIndex={-1} className={cn(container, "flex flex-1 flex-col pb-20 outline-none")}>
        <section className="grid gap-5 rounded-lg bg-lavender px-6 py-10 md:px-16 md:py-16">
          {salon.hours.length > 0 && (
            <span className="inline-flex h-8 items-center justify-self-start rounded-full bg-butter px-3.5 text-sm font-medium">
              {summarizeHours(salon.hours, locale as Locale)}
            </span>
          )}
          <h1 className="max-w-[20ch] text-[44px] leading-[1.05] text-balance animate-in fade-in slide-in-from-bottom-2 duration-700 md:text-[56px] xl:text-[64px]">
            {salon.name}
          </h1>
          <p className="max-w-[42ch] text-lg text-body">
            {/* Same test as BookingFlow's: with more than one team member the flow opens on choosing one. */}
            {t(salon.designers.filter((d) => d.services.length > 0).length > 1 ? "chooseMember" : "chooseService")}
          </p>
        </section>
        <div className="pt-10 md:pt-14">
          <BookingFlow salon={salon} />
        </div>
      </main>
      <PublicFooter className="max-w-[calc(1200px+5rem)] md:px-10" />
    </div>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "storefront" });
  const salon = await serverApi<PublicSalon>(`/salons/by-slug/${encodeURIComponent(slug)}`);
  return {
    title: salon ? t("metaTitle", { name: salon.name, product: LEGAL.product }) : LEGAL.product,
  };
}
