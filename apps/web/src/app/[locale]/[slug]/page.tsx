import type { PublicSalon } from "@reserivo/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BookingFlow } from "@/components/booking/booking-flow";
import { PublicFooter } from "@/components/legal/public-footer";
import type { Locale } from "@/i18n/routing";
import { serverApi } from "@/lib/api-server";
import { LEGAL } from "@/lib/legal";
import { summarizeHours } from "@/lib/format";

type Props = { params: Promise<{ locale: string; slug: string }> };

/**
 * Public booking page. Server-rendered shell (SEO, fast first paint); the
 * flow itself is a client island. Every color is a token so a salon's own
 * accent can override --primary later, and there is no stock photography:
 * a picture that is not of this salon would misrepresent it.
 */
export default async function SalonPublicPage({ params }: Props) {
  // A server component has no hooks, so `useFormat()` is unavailable here: the
  // locale comes off the route and goes to the pure formatter explicitly.
  const { locale, slug } = await params;
  const salon = await serverApi<PublicSalon>(`/salons/by-slug/${encodeURIComponent(slug)}`);
  if (!salon) notFound();
  const t = await getTranslations({ locale, namespace: "storefront" });

  return (
    <>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-20">
        <header className="grid gap-4 border-b pt-12 pb-10 md:pt-20 md:pb-14">
          <h1 className="max-w-[20ch] text-4xl leading-[1.05] animate-in fade-in slide-in-from-bottom-2 duration-700 md:text-6xl">
            {salon.name}
          </h1>
          <div className="grid gap-1">
            {salon.hours.length > 0 && <p className="text-muted-foreground">{summarizeHours(salon.hours, locale as Locale)}</p>}
            <p className="text-lg">{t("chooseService")}</p>
          </div>
        </header>
        <div className="pt-10 md:pt-14">
          <BookingFlow salon={salon} />
        </div>
      </main>
      <PublicFooter className="max-w-6xl" />
    </>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "storefront" });
  const salon = await serverApi<PublicSalon>(`/salons/by-slug/${encodeURIComponent(slug)}`);
  return { title: salon ? t("metaTitle", { name: salon.name, product: LEGAL.product }) : LEGAL.product };
}
