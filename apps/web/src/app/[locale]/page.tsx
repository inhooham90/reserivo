import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { PublicFooter } from "@/components/legal/public-footer";
import { Button } from "@/components/ui/button";
import { LEGAL } from "@/lib/legal";

/**
 * Marketing landing for salon owners. Customers arrive via /{slug} links instead.
 *
 * It says more than a landing page strictly needs because it is also the page
 * a carrier opens when reviewing the A2P 10DLC campaign: a reviewer who cannot
 * tell what the business does, or find the messaging program, rejects the
 * campaign for it (error 30919). Hence the plain description of the service,
 * the text-reminder section linking to /sms, and the operator's legal name and
 * address on the page rather than only inside the legal documents. The layout
 * can change freely; those three blocks of copy should not go. Reviewers read
 * the English page at `/`, so the English wording is the one that matters.
 */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "home" });

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="font-heading text-xl tracking-tight">
          {LEGAL.product}
        </Link>
        <Button variant="ghost" nativeButton={false} render={<Link href="/login" />}>
          {t("signIn")}
        </Button>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6">
        {/* Hero: copy left, photograph right. Stacks with the image second on phones. */}
        <section className="grid items-center gap-10 pt-8 pb-16 lg:grid-cols-12 lg:gap-12 lg:pt-12 lg:pb-24">
          <div className="grid gap-6 animate-in fade-in slide-in-from-bottom-3 duration-700 lg:col-span-6">
            <h1 className="max-w-[18ch] text-4xl leading-[1.08] md:text-5xl lg:text-6xl">{t("hero.title")}</h1>
            <p className="max-w-[46ch] text-lg leading-relaxed text-muted-foreground">{t("hero.subtitle")}</p>
            <div>
              <Button size="lg" className="h-11 px-5 text-base" nativeButton={false} render={<Link href="/register" />}>
                {t("hero.cta")}
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </div>
          <div className="animate-in fade-in duration-1000 lg:col-span-6">
            <Image
              src="/images/home-hero.png"
              alt={t("hero.imageAlt")}
              width={896}
              height={1120}
              priority
              sizes="(min-width: 1024px) 560px, 100vw"
              className="aspect-[4/5] max-h-[min(80dvh,700px)] w-full rounded-xl object-cover lg:ml-auto lg:w-auto"
            />
          </div>
        </section>

        <section className="grid gap-5 border-t py-16 lg:grid-cols-12 lg:py-24">
          <div className="grid gap-5 lg:col-span-8 lg:col-start-3">
            <h2 className="text-3xl md:text-4xl">{t("about.title", { product: LEGAL.product })}</h2>
            <p className="text-lg leading-relaxed text-muted-foreground">
              {t.rich("about.body", {
                product: LEGAL.product,
                url: (chunks) => (
                  <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-base text-foreground">{chunks}</span>
                ),
              })}
            </p>
            <p className="text-lg leading-relaxed text-foreground">{t("about.notASalon")}</p>
          </div>
        </section>

        {/* Three features, three cells: one carries the photograph, one is tinted,
            one takes the accent, so the grid does not read as three equal cards. */}
        <section className="grid gap-4 pb-16 md:grid-cols-12 lg:pb-24">
          <article className="grid overflow-hidden rounded-xl border bg-card md:col-span-7 md:row-span-2">
            <Image
              src="/images/home-nails.png"
              alt={t("features.page.imageAlt")}
              width={1168}
              height={880}
              sizes="(min-width: 768px) 60vw, 100vw"
              className="aspect-[4/3] h-full w-full object-cover"
            />
            <div className="grid gap-2 p-6 md:p-8">
              <h3 className="text-2xl">{t("features.page.title")}</h3>
              <p className="max-w-[48ch] leading-relaxed text-muted-foreground">{t("features.page.body")}</p>
            </div>
          </article>
          <article className="grid content-end gap-2 rounded-xl bg-secondary p-6 text-secondary-foreground md:col-span-5 md:p-8">
            <h3 className="text-2xl">{t("features.calendar.title")}</h3>
            <p className="leading-relaxed">{t("features.calendar.body")}</p>
          </article>
          <article className="grid content-end gap-2 rounded-xl bg-primary p-6 text-primary-foreground md:col-span-5 md:p-8">
            <h3 className="text-2xl">{t("features.clients.title")}</h3>
            <p className="leading-relaxed">{t("features.clients.body")}</p>
          </article>
        </section>

        <section className="rounded-xl bg-muted px-6 py-10 md:px-12 md:py-14">
          <div className="grid max-w-[65ch] gap-4">
            <h2 className="text-3xl">{t("reminders.title")}</h2>
            <p className="leading-relaxed text-muted-foreground">
              {t.rich("reminders.body", {
                link: (chunks) => (
                  <Link href="/sms" className="text-foreground underline underline-offset-4">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </div>
        </section>

        <section className="grid gap-3 py-16 lg:grid-cols-12 lg:py-24">
          <div className="grid gap-3 lg:col-span-8 lg:col-start-3">
            <h2 className="text-2xl">{t("operator.title", { product: LEGAL.product })}</h2>
            <p className="leading-relaxed text-muted-foreground">
              {t.rich("operator.body", {
                product: LEGAL.product,
                legalName: LEGAL.legalName,
                address: LEGAL.address,
                supportEmail: LEGAL.supportEmail,
                email: (chunks) => (
                  <a href={`mailto:${LEGAL.supportEmail}`} className="text-foreground underline underline-offset-4">
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </div>
        </section>
      </main>

      <PublicFooter className="max-w-6xl" />
    </div>
  );
}
