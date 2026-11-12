import Image from "next/image";
import type { CSSProperties } from "react";
import { ArrowRight, Bell, Link2, LockKeyhole, Mail, MessageSquareText } from "lucide-react";
import { cn } from "cn";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Wordmark } from "@/components/brand/wordmark";
import { PhotoBanner } from "@/components/home/photo-banner";
import { SiteHeader } from "@/components/home/site-header";
import { PublicFooter } from "@/components/legal/public-footer";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDuration, formatLocalDate, hourLabel, minutesLabel } from "@/lib/format";
import { LEGAL } from "@/lib/legal";
import { inkPill, softPill } from "@/lib/v3";

/**
 * Marketing landing for businesses, on the designer's website board (the
 * brand refresh; DESIGN.md still describes the v3 pages around it).
 * Customers arrive via /{slug} links instead.
 *
 * It says more than a landing page strictly needs because it is also the page
 * a carrier opens when reviewing the A2P 10DLC campaign: a reviewer who cannot
 * tell what the business does, or find the messaging program, rejects the
 * campaign for it (error 30919). Hence the plain description of the service
 * (the centred section under the hero), the text-reminder section linking to
 * /sms (#reminders), and the operator's legal name and address on the page
 * rather than only inside the legal documents. The layout can change freely;
 * those three blocks of copy should not go, and the description must keep
 * matching the campaign description in deploy/A2P-10DLC.md ("small businesses
 * that take appointments"). Reviewers read the English page at `/`, so the
 * English wording is the one that matters.
 */
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "home" });
  const loc = locale as Locale;

  const container = "mx-auto w-full max-w-[calc(1200px+5rem)] px-6 md:px-10";

  return (
    <div className="theme-morrri relative isolate flex flex-1 flex-col bg-canvas">
      {/* The board's glow behind header and hero: lavender top left, peach top right, fading into canvas. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-[820px] bg-[radial-gradient(38%_46%_at_16%_4%,color-mix(in_srgb,var(--lisa)_42%,transparent),transparent_72%),radial-gradient(34%_42%_at_86%_20%,color-mix(in_srgb,var(--peach)_55%,transparent),transparent_72%),linear-gradient(to_bottom,color-mix(in_srgb,var(--lisa-soft)_45%,var(--canvas)),var(--canvas))]"
      />
      <SiteHeader />

      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {/* Hero: centred copy, then the giant wordmark with Mona stepping out in front of it. */}
        <section aria-labelledby="hero-title" className="px-6 pt-8 pb-12 md:pt-14 md:pb-20">
          <div className="mx-auto flex max-w-[680px] flex-col items-center gap-5 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700">
            <h1
              id="hero-title"
              className="max-w-[30rem] font-brand text-[40px] leading-[1.03] font-bold tracking-[-0.01em] text-balance text-mona-ink sm:text-[52px] md:text-[64px]"
            >
              {t("hero.title")}
            </h1>
            <p className="max-w-[34rem] font-display text-lg leading-normal text-mona-ink md:text-xl">{t("hero.subtitle")}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Button nativeButton={false} className={inkPill} render={<Link href="/register" />}>
                {t("hero.cta")}
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button nativeButton={false} className={softPill} render={<a href="#how" />}>
                {t("hero.secondaryCta")}
              </Button>
            </div>
          </div>
          {/* Proportions from the board: the cat's top sits 18% down the block and it spans 41% of the width. */}
          <div className="relative mx-auto mt-14 aspect-[1120/605] w-full max-w-[1120px] md:mt-24">
            <Wordmark period decorative className="w-full text-mona-ink" />
            <Image
              src="/images/mona-stylist-solid.png"
              alt={t("hero.imageAlt")}
              width={667}
              height={720}
              priority
              sizes="(min-width: 1200px) 460px, 41vw"
              className="absolute top-[18.2%] left-[30.8%] h-[81.8%] w-auto"
            />
          </div>
        </section>

        {/* What Morrri is: carrier-facing description, keep the copy. */}
        <section aria-labelledby="what-title" className="border-t border-rule px-6 pt-16 pb-20 text-center md:pt-20 md:pb-28">
          <h2 id="what-title" className="mx-auto max-w-[36rem] text-[26px] leading-[1.25] font-normal tracking-[-0.01em] text-balance text-mona-ink md:text-[32px]">
            {t("about.title", { product: LEGAL.product })}
          </h2>
          <p className="mx-auto mt-6 max-w-[47rem] font-display text-lg leading-[1.55] text-olive md:text-xl">
            {t.rich("about.body", { product: LEGAL.product, url: (chunks) => <span className="text-mona-ink">{chunks}</span> })}
          </p>
          <hr className="mx-auto mt-10 w-full max-w-[34rem] border-rule" />
          <p className="mx-auto mt-10 max-w-[40rem] font-display text-[17px] leading-normal text-olive">{t("about.notASalon")}</p>
        </section>

        <div className={`${container} pb-12 md:pb-16`}>
          <PhotoBanner
            id="link-title"
            src="/images/home-one-link.jpg"
            title={t.rich("banners.link.title", { l: (chunks) => <span className="block">{chunks}</span> })}
            cta={t("hero.cta")}
            chips={[
              { label: t("banners.link.nearby"), x: 31, y: 57, glass: true },
              { label: t("banners.link.category"), x: 81, y: 36 },
            ]}
          />
        </div>

        <section id="how" aria-labelledby="feat-title" className={`${container} scroll-mt-28 pt-12 pb-20 md:pt-20 md:pb-28`}>
          <div className="flex flex-col items-center text-center">
            <Eyebrow>{t("howItWorks")}</Eyebrow>
            <h2 id="feat-title" className={cn(sectionTitle, "mt-6 max-w-[36rem]")}>
              {t("features.title")}
            </h2>
          </div>

          <div className="mt-10 grid gap-6 md:mt-12">
            <article className="grid items-center gap-8 rounded-2xl border border-rule bg-white p-6 md:p-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:gap-12">
              <div>
                <h3 className={cardTitle}>{t("features.calendar.title")}</h3>
                <p className={cn(cardBody, "mt-3 max-w-[30rem]")}>{t("features.calendar.body")}</p>
              </div>
              <MiniCalendar t={t} locale={loc} />
            </article>

            <div className="grid gap-6 md:grid-cols-2">
              <article className="flex flex-col rounded-2xl border border-rule bg-white p-6 md:p-10">
                <h3 className={cardTitle}>{t("features.page.title")}</h3>
                <p className={cn(cardBody, "mt-3")}>{t("features.page.body")}</p>
                <div aria-hidden className="mt-8 rounded-xl border border-rule p-6">
                  <span className="flex items-center gap-2 text-sm font-semibold text-olive">
                    <Link2 className="size-4" />
                    morrri.com/mona-salone
                  </span>
                  <span className="mt-2 mb-4 block text-[22px] font-semibold text-mona-ink">Mona Salone</span>
                  <ServiceRow name={t("features.preview.cutAndStyle")} duration={formatDuration(60, loc)} />
                  <ServiceRow name={t("features.preview.gelManicure")} duration={formatDuration(45, loc)} last />
                  <span className="mt-5 grid h-12 place-items-center rounded-full bg-mona-ink text-base font-semibold text-white">
                    {t("features.preview.pickTime")}
                  </span>
                </div>
              </article>

              <article className="flex flex-col rounded-2xl border border-rule bg-white p-6 md:p-10">
                <h3 className={cardTitle}>{t("features.clients.title")}</h3>
                <p className={cn(cardBody, "mt-3")}>{t("features.clients.body")}</p>
                <div aria-hidden className="mt-8 rounded-xl border border-rule p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-mona-butter text-sm font-semibold text-mona-ink">
                      DW
                    </span>
                    <span>
                      <span className="block text-[17px] leading-tight font-semibold text-mona-ink">Dana Whitfield</span>
                      <span className="text-base text-olive">
                        {t("features.preview.lastVisit", { date: formatLocalDate("2026-09-12", loc, "monthDay") })}
                      </span>
                    </span>
                  </div>
                  <span className="mt-4 flex flex-wrap gap-2">
                    <Tag>{t("features.preview.prefers", { name: "Emma" })}</Tag>
                    <Tag>{t("features.preview.colorClient")}</Tag>
                  </span>
                  <span className="mt-4 flex items-center gap-2 text-base text-olive">
                    <LockKeyhole className="size-4 shrink-0" />
                    {t("features.preview.numberHidden", { product: LEGAL.product })}
                  </span>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Reminders: carrier-facing, links the SMS program at /sms. Keep the copy. */}
        <section id="reminders" aria-labelledby="rem-title" className="scroll-mt-28 px-6 pb-20 text-center md:pb-28">
          <h2 id="rem-title" className={cn(sectionTitle, "mx-auto max-w-[24rem]")}>
            {t("reminders.title")}
          </h2>
          <p className="mx-auto mt-6 max-w-[49rem] font-display text-lg leading-[1.55] text-mona-ink md:text-xl">
            {t.rich("reminders.body", {
              link: (chunks) => (
                <Link
                  href="/sms"
                  className="font-sans font-medium whitespace-nowrap underline decoration-olive underline-offset-4 transition-colors hover:decoration-mona-ink"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>
          <ol
            aria-label={t("reminders.steps.listLabel")}
            className="mx-auto mt-12 max-w-[51rem] divide-y divide-rule rounded-2xl border border-rule bg-white text-left md:mt-16"
          >
            <Step icon={<Mail />} title={t("reminders.steps.confirmTitle")} body={t("reminders.steps.confirmBody")} />
            <Step icon={<Bell />} title={t("reminders.steps.reminderTitle")} body={t("reminders.steps.reminderBody")} />
            <Step icon={<MessageSquareText />} title={t("reminders.steps.textTitle")} body={t("reminders.steps.textBody")} />
          </ol>
        </section>

        <section aria-labelledby="cmp-title" className={`${container} pb-20 md:pb-28`}>
          <div className="flex flex-col items-center text-center">
            <Eyebrow>{t("compare.eyebrow")}</Eyebrow>
            <h2 id="cmp-title" className={cn(sectionTitle, "mt-6 max-w-[34rem]")}>
              {t("compare.title", { product: LEGAL.product })}
            </h2>
          </div>
          <div className="mt-10 grid items-start gap-8 md:mt-14 md:grid-cols-2 md:gap-14">
            {/* Unboxed, and padded to line up with the card's rows beside it. */}
            <div className="md:pt-10">
              <h3 className={cn(cardTitle, "text-olive")}>{t("compare.before.title")}</h3>
              <ul className="mt-6">
                {COMPARE_ROWS.map((k) => (
                  <li key={k} className="border-t border-rule py-5 font-display text-lg text-olive md:text-xl">
                    {t(`compare.before.${k}`)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border-[1.5px] border-lisa bg-white p-6 md:p-10">
              <h3 className={cardTitle}>{t("compare.after.title", { product: LEGAL.product })}</h3>
              <ul className="mt-6">
                {COMPARE_ROWS.map((k) => (
                  <li key={k} className="border-t border-rule py-5 font-display text-lg text-mona-ink md:text-xl">
                    {t(`compare.after.${k}`, { product: LEGAL.product })}
                  </li>
                ))}
              </ul>
              <Button nativeButton={false} className={cn(inkPill, "mt-6 w-full")} render={<Link href="/register" />}>
                {t("hero.cta")}
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </div>
        </section>

        <div className={container}>
          <PhotoBanner
            id="setup-title"
            src="/images/home-setup.jpg"
            title={t("banners.setup.title")}
            body={t("banners.setup.body")}
            cta={t("hero.cta")}
            chips={[
              { label: "Kelly Gomez", x: 76, y: 26 },
              { label: t("banners.setup.service"), x: 73, y: 33 },
              { label: formatLocalDate("2026-12-25", loc, "dateWithYear"), x: 70, y: 40 },
            ]}
          />
        </div>

        {/* Operator: carrier-facing legal name and address. Keep the copy. */}
        <section aria-labelledby="op-title" className={`${container} pt-20 md:pt-28`}>
          <h2 id="op-title" className={cardTitle}>
            {t("operator.title", { product: LEGAL.product })}
          </h2>
          <p className="mt-3 max-w-[36rem] font-display text-lg leading-[1.55] text-mona-ink md:text-xl">
            {t.rich("operator.body", {
              product: LEGAL.product,
              legalName: LEGAL.legalName,
              address: LEGAL.address,
              supportEmail: LEGAL.supportEmail,
              email: (chunks) => (
                <a
                  href={`mailto:${LEGAL.supportEmail}`}
                  className="underline decoration-olive underline-offset-4 transition-colors hover:decoration-mona-ink"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        </section>
      </main>

      {/* The board's closing band: the same glow as the hero, warmer, under a faded wordmark. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-[860px] bg-[radial-gradient(38%_40%_at_16%_22%,color-mix(in_srgb,var(--lisa)_34%,transparent),transparent_72%),radial-gradient(36%_42%_at_86%_48%,color-mix(in_srgb,var(--peach)_50%,transparent),transparent_72%),linear-gradient(to_bottom,var(--canvas),color-mix(in_srgb,var(--mona-butter)_55%,var(--canvas))_30%)]"
      />
      <div aria-hidden className="mx-auto mt-10 w-full max-w-[calc(1200px+5rem)] px-6 md:mt-16 md:px-10">
        <Wordmark decorative className="w-full text-white/75" />
      </div>
      <PublicFooter variant="home" className="mt-6 max-w-[calc(1200px+5rem)] md:mt-8 md:px-10" />
    </div>
  );
}

const COMPARE_ROWS = ["a", "b", "c", "d", "e"] as const;

type T = Awaited<ReturnType<typeof getTranslations<"home">>>;

/* Type roles: every heading is Fredoka (section titles semibold, card titles
   and the hero bold); body copy is the serif, in olive. */
const sectionTitle =
  "font-brand text-[36px] leading-[1.1] font-semibold tracking-[-0.01em] text-balance text-mona-ink md:text-[52px]";
const cardTitle =
  "font-brand text-[26px] leading-[1.15] font-bold tracking-[-0.01em] text-mona-ink md:text-[30px]";
const cardBody = "font-display text-lg leading-[1.55] text-olive md:text-xl";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md bg-mona-butter px-2.5 py-1 font-display text-[13px] font-bold tracking-[0.04em] text-mona-ink uppercase">
      {children}
    </p>
  );
}

/** The mini schedule runs 9:00 to 16:00 at 48px an hour. */
const HOUR = 48;
const at = (h: number, m = 0) => ((h - 9) * 60 + m) * (HOUR / 60);

/** A scaled-down, decorative copy of the schedule. Hidden from assistive tech; the card's text says it. */
function MiniCalendar({ t, locale }: { t: T; locale: Locale }) {
  const hours = Array.from({ length: 8 }, (_, i) => (9 + i) * 60);
  const block = (top: number, height: number, title: string, who: React.ReactNode, walkIn = false) => (
    <div
      className={cn(
        "absolute inset-x-0 px-2 py-1 leading-[1.25]",
        walkIn ? "rounded-sm border border-dashed border-mona-ink bg-mona-butter" : "rounded-r-md border-l border-mona-ink bg-lisa-soft",
      )}
      style={{ top, height }}
    >
      <b className="block font-semibold">{title}</b>
      {who}
    </div>
  );
  const rules: CSSProperties = {
    backgroundImage: `repeating-linear-gradient(to bottom, var(--rule) 0 1px, transparent 1px ${HOUR}px)`,
    height: at(16) + 1,
  };

  return (
    <div aria-hidden className="min-w-0 overflow-x-auto text-[13px] text-mona-ink">
      <div className="min-w-[30rem]">
        <div className="grid grid-cols-[3.75rem_repeat(3,1fr)] gap-x-2 border-b border-rule pb-2.5 text-[15px] font-medium text-olive">
          <span />
          <span>Emma</span>
          <span>Rosa</span>
          <span>Theo</span>
        </div>
        <div className="relative mt-3 grid grid-cols-[3.75rem_repeat(3,1fr)] gap-x-2" style={{ height: at(16) + 24 }}>
          <div className="absolute top-0 right-0 left-[3.75rem]" style={rules} />
          <div className="relative">
            {hours.map((min, i) => (
              <span
                key={min}
                className={cn("absolute left-0 font-semibold whitespace-nowrap text-olive", i > 0 && "-translate-y-1/2")}
                style={{ top: i * HOUR }}
              >
                {hourLabel(min, locale)}
              </span>
            ))}
          </div>
          <div className="relative">
            {block(at(9, 30), HOUR, t("features.preview.womensCut"), "Dana W.")}
            {block(
              at(13),
              HOUR * 1.5,
              t("features.preview.balayage"),
              <span className="mt-0.5 inline-flex rounded-sm border border-dashed border-destructive bg-white px-1.5 font-semibold text-destructive">
                {t("features.preview.overlaps", { time: minutesLabel(13 * 60 + 30, locale) })}
              </span>,
            )}
            {block(at(15, 30), HOUR / 2, t("features.preview.trim"), "Alma R.")}
          </div>
          <div className="relative">
            {block(at(10), HOUR * 1.5, t("features.preview.rootTouchUp"), "Priya R.")}
            {block(at(14), HOUR / 2, t("features.preview.walkIn"), t("features.preview.beardTrim"), true)}
          </div>
          <div className="relative">
            {block(at(9), HOUR * 0.75, t("features.preview.gelManicure"), "Keisha B.")}
            {block(at(11), HOUR * 1.5, t("features.preview.acrylicFill"), "Jordan B.")}
            {block(at(14, 30), HOUR, t("features.preview.blowout"), "Hannah L.")}
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceRow({ name, duration, last = false }: { name: string; duration: string; last?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3 border-t border-rule py-3 text-base text-mona-ink", last && "border-b")}>
      <span>{name}</span>
      <span className="text-sm font-semibold text-olive">{duration}</span>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex h-7 items-center rounded-md bg-sfumato px-3 text-sm font-semibold text-mona-ink">{children}</span>;
}

function Step({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <li className="grid grid-cols-[44px_1fr] items-center gap-5 px-6 py-5">
      <span aria-hidden className="grid size-11 place-items-center rounded-full bg-lisa-soft text-mona-ink [&_svg]:size-5">
        {icon}
      </span>
      <span>
        <b className="block text-[17px] font-semibold text-mona-ink">{title}</b>
        <span className="text-base text-olive">{body}</span>
      </span>
    </li>
  );
}
