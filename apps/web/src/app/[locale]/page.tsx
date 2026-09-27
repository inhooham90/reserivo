import Image from "next/image";
import type { CSSProperties } from "react";
import { ArrowRight, Bell, HandCoins, Link2, LockKeyhole, Mail, MessageSquareText, TriangleAlert } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { authLink, pillButton } from "@/components/auth/auth-card";
import { SiteHeader } from "@/components/home/site-header";
import { PublicFooter } from "@/components/legal/public-footer";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDuration, hourLabel, minutesLabel } from "@/lib/format";
import { LEGAL } from "@/lib/legal";

/**
 * Marketing landing for salon owners, on the Morrri v3 design (DESIGN.md).
 * Customers arrive via /{slug} links instead.
 *
 * It says more than a landing page strictly needs because it is also the page
 * a carrier opens when reviewing the A2P 10DLC campaign: a reviewer who cannot
 * tell what the business does, or find the messaging program, rejects the
 * campaign for it (error 30919). Hence the plain description of the service
 * (#how), the text-reminder section linking to /sms (#reminders), and the
 * operator's legal name and address on the page rather than only inside the
 * legal documents. The layout can change freely; those three blocks of copy
 * should not go, and the description must keep matching the filing in
 * deploy/A2P-10DLC.md (which says "hair and nail salons"). Reviewers read the
 * English page at `/`, so the English wording is the one that matters.
 */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "home" });
  const loc = locale as Locale;

  const container = "mx-auto w-full max-w-[calc(1200px+5rem)] px-6 md:px-10";
  const outlinePill =
    "h-12 rounded-full border-input bg-card px-6 hover:border-foreground hover:bg-card dark:border-input dark:bg-card dark:hover:bg-card hover:scale-[1.04] active:scale-[0.98] motion-reduce:hover:scale-100";

  return (
    <div className="theme-morrri flex flex-1 flex-col">
      <SiteHeader />

      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {/* Hero: copy left, Mona right on white. Stacks under md, art second. */}
        <section aria-labelledby="hero-title" className={`${container} pt-6 pb-12 md:pt-12 md:pb-16`}>
          <div className="grid items-stretch gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="flex flex-col justify-center gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 md:py-8 md:pr-6">
              <h1 id="hero-title" className="text-[44px] leading-[1.05] text-balance md:text-[56px] xl:text-[64px]">
                {t("hero.title")}
              </h1>
              <p className="max-w-[44ch] text-lg text-body">{t("hero.subtitle")}</p>
              <div className="flex flex-wrap gap-3">
                <Button nativeButton={false} className={pillButton} render={<Link href="/register" />}>
                  {t("hero.cta")}
                  <ArrowRight data-icon="inline-end" />
                </Button>
                <Button variant="outline" nativeButton={false} className={outlinePill} render={<a href="#how" />}>
                  {t("hero.secondaryCta")}
                </Button>
              </div>
            </div>
            <div className="grid place-items-center p-6 md:px-0">
              <Image
                src="/images/mona-stylist.png"
                alt={t("hero.imageAlt")}
                width={667}
                height={720}
                priority
                sizes="340px"
                className="h-auto w-full max-w-[340px]"
              />
            </div>
          </div>
        </section>

        {/* What Morrri is: carrier-facing description, keep the copy. */}
        <section id="how" aria-labelledby="what-title" className={`${container} scroll-mt-28 py-12 md:py-16`}>
          <div className="max-w-[760px]">
            <h2 id="what-title" className="mb-6 text-[28px] leading-[1.3] md:text-4xl md:leading-[1.2]">
              {t("about.title", { product: LEGAL.product })}
            </h2>
            <p className="mb-6 max-w-[62ch] text-lg text-body">
              {t.rich("about.body", {
                product: LEGAL.product,
                url: (chunks) => (
                  <span className="rounded-sm bg-surface-muted px-1.5 py-0.5 font-mono text-base text-foreground">{chunks}</span>
                ),
              })}
            </p>
            <p className="mt-8 flex max-w-[62ch] items-start gap-3 border-t border-border pt-6 text-lg font-medium">
              <HandCoins aria-hidden className="mt-0.5 size-6 shrink-0" />
              <span>{t("about.notASalon")}</span>
            </p>
          </div>
        </section>

        <section aria-labelledby="feat-title" className={`${container} pb-12 md:pb-16`}>
          <h2 id="feat-title" className="mb-8 max-w-[16ch] text-4xl leading-[1.2] text-balance md:text-[44px] xl:text-5xl">
            {t("features.title")}
          </h2>
          <div className="grid gap-6 lg:grid-cols-12">
            <article className="flex min-w-0 flex-col gap-4 rounded-lg bg-muted p-6 shadow-[inset_0_0_0_1px_var(--border)] md:p-8 lg:col-span-7 lg:row-span-2">
              <h3 className="text-[28px] leading-[1.3]">{t("features.calendar.title")}</h3>
              <p className="max-w-[48ch] text-base text-body">{t("features.calendar.body")}</p>
              <MiniCalendar t={t} locale={loc} />
            </article>

            <article className="flex min-w-0 flex-col gap-4 rounded-lg bg-butter p-6 md:p-8 lg:col-span-5">
              <h3 className="text-[28px] leading-[1.3]">{t("features.page.title")}</h3>
              <p className="max-w-[48ch] text-base text-body">{t("features.page.body")}</p>
              <div aria-hidden className="mt-auto grid gap-3 rounded-lg bg-card p-6 shadow-[inset_0_0_0_1px_var(--border)]">
                <span className="flex items-center gap-1.5 text-[13px] text-body tabular-nums">
                  <Link2 className="size-3.5" />
                  morrri.com/mona-salone
                </span>
                <span className="text-base font-semibold">Mona Salone</span>
                <ServiceRow name={t("features.preview.cutAndStyle")} duration={formatDuration(60, loc)} />
                <ServiceRow name={t("features.preview.gelManicure")} duration={formatDuration(45, loc)} />
                <span className="grid h-10 place-items-center rounded-full bg-lavender text-sm font-medium">
                  {t("features.preview.pickTime")}
                </span>
              </div>
            </article>

            <article className="flex min-w-0 flex-col gap-4 rounded-lg bg-lavender p-6 md:p-8 lg:col-span-5">
              <h3 className="text-[28px] leading-[1.3]">{t("features.clients.title")}</h3>
              <p className="max-w-[48ch] text-base text-body">{t("features.clients.body")}</p>
              <div aria-hidden className="mt-auto grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 rounded-lg bg-card p-4 shadow-[inset_0_0_0_1px_var(--border)]">
                <span className="grid size-8 place-items-center rounded-full bg-lavender text-xs font-semibold shadow-[inset_0_0_0_1px_var(--border)]">
                  DW
                </span>
                <span>
                  <span className="block text-base font-semibold">Dana Whitfield</span>
                  <span className="text-sm text-muted-foreground">{t("features.preview.visits", { count: 12 })}</span>
                </span>
                <span className="col-start-2 flex flex-wrap gap-1.5">
                  <Tag>{t("features.preview.prefers", { name: "Kim" })}</Tag>
                  <Tag>{t("features.preview.colorClient")}</Tag>
                </span>
                <span className="col-start-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <LockKeyhole className="size-3.5 shrink-0" />
                  {t("features.preview.numberHidden", { product: LEGAL.product })}
                </span>
              </div>
            </article>

            {/* Reminders: carrier-facing, links the SMS program at /sms. Keep the copy. */}
            <article
              id="reminders"
              className="grid scroll-mt-28 items-center gap-8 rounded-lg bg-muted p-6 shadow-[inset_0_0_0_1px_var(--border)] md:p-8 lg:col-span-12 lg:grid-cols-2"
            >
              <div>
                <h3 className="text-[28px] leading-[1.3]">{t("reminders.title")}</h3>
                <p className="mt-4 max-w-[62ch] text-base text-body">
                  {t.rich("reminders.body", {
                    link: (chunks) => (
                      <Link href="/sms" className={authLink}>
                        {chunks}
                      </Link>
                    ),
                  })}
                </p>
              </div>
              <ol aria-label={t("reminders.steps.listLabel")} className="grid gap-3">
                <Step icon={<Mail />} title={t("reminders.steps.confirmTitle")} body={t("reminders.steps.confirmBody")} />
                <Step icon={<Bell />} title={t("reminders.steps.reminderTitle")} body={t("reminders.steps.reminderBody")} />
                <Step icon={<MessageSquareText />} title={t("reminders.steps.textTitle")} body={t("reminders.steps.textBody")} />
              </ol>
            </article>
          </div>
        </section>

        {/* Operator: carrier-facing legal name and address. Keep the copy. */}
        <section aria-labelledby="op-title" className={`${container} pb-12 md:pb-16`}>
          <div className="grid items-center gap-8 rounded-lg bg-lavender p-8 md:grid-cols-[200px_minmax(0,1fr)_auto] md:px-12">
            <Image src="/images/mona-baker.png" alt="" width={708} height={720} className="h-auto w-40 md:w-[200px]" />
            <div>
              <h2 id="op-title" className="text-[28px] leading-[1.3]">
                {t("operator.title", { product: LEGAL.product })}
              </h2>
              <p className="mt-3 max-w-[60ch] text-base text-body">
                {t.rich("operator.body", {
                  product: LEGAL.product,
                  legalName: LEGAL.legalName,
                  address: LEGAL.address,
                  supportEmail: LEGAL.supportEmail,
                  email: (chunks) => (
                    <a href={`mailto:${LEGAL.supportEmail}`} className={authLink}>
                      {chunks}
                    </a>
                  ),
                })}
              </p>
            </div>
            <div>
              <Button nativeButton={false} className={pillButton} render={<Link href="/register" />}>
                {t("hero.cta")}
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter className="max-w-[calc(1200px+5rem)] md:px-10" />
    </div>
  );
}

type T = Awaited<ReturnType<typeof getTranslations<"home">>>;

/** A scaled-down, decorative copy of the schedule. Hidden from assistive tech; the card's text says it. */
function MiniCalendar({ t, locale }: { t: T; locale: Locale }) {
  const hours = Array.from({ length: 9 }, (_, i) => hourLabel((9 + i) * 60, locale));
  const block = (top: number, height: number, title: string, who: string, walkIn = false) => (
    <div
      className={`absolute inset-x-1 overflow-hidden rounded-sm px-1.5 py-1 leading-[1.3] ${walkIn ? "bg-butter shadow-[inset_0_0_0_1px_var(--border)]" : "bg-lavender"}`}
      style={{ top, height }}
    >
      <b className="block font-medium">{title}</b>
      {who}
    </div>
  );
  const rules: CSSProperties = {
    backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 43px, var(--hour-rule) 43px 44px)",
  };

  return (
    <div aria-hidden className="mt-3 flex flex-1 flex-col overflow-hidden rounded-lg bg-card text-xs shadow-[inset_0_0_0_1px_var(--border)]">
      <div className="grid grid-cols-[3.25rem_repeat(3,1fr)] border-b border-border font-medium">
        <span />
        <span className="px-2.5 py-2">Kim</span>
        <span className="px-2.5 py-2">Rosa</span>
        <span className="px-2.5 py-2">Theo</span>
      </div>
      <div className="relative grid min-h-[396px] flex-1 grid-cols-[3.25rem_repeat(3,1fr)]" style={rules}>
        <div className="grid grid-rows-[repeat(9,44px)] text-[11px] text-muted-foreground">
          {hours.map((h) => (
            <span key={h} className="px-1.5 pt-0.5">
              {h}
            </span>
          ))}
        </div>
        <div className="relative border-l border-border">
          {block(4, 80, t("features.preview.womensCut"), "Dana W.")}
          {block(136, 58, t("features.preview.rootTouchUp"), "Priya R.")}
          {block(268, 44, t("features.preview.blowout"), "Hannah L.")}
          {block(356, 36, t("features.preview.trim"), "Alma R.")}
        </div>
        <div className="relative border-l border-border">
          {block(48, 124, t("features.preview.balayage"), "Marisol O.")}
          <div
            className="absolute inset-x-1 flex items-center gap-1 rounded-sm border-[1.5px] border-dashed border-destructive bg-card px-1.5 py-1 font-medium text-destructive"
            style={{ top: 180, height: 40 }}
          >
            <TriangleAlert className="size-3 shrink-0" />
            {t("features.preview.overlaps", { time: minutesLabel(13 * 60 + 30, locale) })}
          </div>
        </div>
        <div className="relative border-l border-border">
          {block(26, 40, t("features.preview.walkIn"), t("features.preview.beardTrim"), true)}
          {block(92, 58, t("features.preview.gelManicure"), "Keisha B.")}
          {block(268, 66, t("features.preview.acrylicFill"), "Jordan B.")}
        </div>
      </div>
    </div>
  );
}

function ServiceRow({ name, duration }: { name: string; duration: string }) {
  return (
    <div className="flex justify-between gap-3 border-t border-border pt-2 text-sm">
      <span>{name}</span>
      <span className="text-body">{duration}</span>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-6 items-center rounded-full bg-butter px-2.5 text-xs font-medium">{children}</span>;
}

function Step({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <li className="grid grid-cols-[40px_1fr] items-center gap-4 rounded-lg bg-card p-4">
      <span aria-hidden className="grid size-10 place-items-center rounded-full bg-lavender [&_svg]:size-5">
        {icon}
      </span>
      <span>
        <b className="block text-sm font-semibold">{title}</b>
        <span className="text-sm text-body">{body}</span>
      </span>
    </li>
  );
}
