import Image from "next/image";
import { CircleCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AuthNav } from "@/components/auth/auth-nav";
import { Link } from "@/i18n/navigation";
import { LEGAL } from "@/lib/legal";

/**
 * Shared frame for sign-in, registration, password reset and email
 * confirmation, on the Morrri v3 design (DESIGN.md): lavender page, the
 * page's own white form card (its <main>) on the left, the butter story panel
 * with Mona on the right. Under `md` the two stack, form first.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("auth.frame");

  return (
    <div className="theme-morrri flex flex-1 flex-col bg-lavender">
      <header className="mx-auto flex w-full max-w-[calc(1200px+5rem)] px-6 items-center justify-between gap-4 pt-8 pb-6 md:px-10">
        {/* The wordmark is artwork, never set in type. */}
        <Link href="/" className="shrink-0 rounded-sm leading-none outline-none focus-visible:ring-3 focus-visible:ring-ring">
          <Image src="/images/morrri-wordmark.png" alt={LEGAL.product} width={74} height={18} priority />
        </Link>
        <AuthNav />
      </header>

      <div className="mx-auto grid w-full max-w-[calc(1200px+5rem)] px-6 flex-1 gap-6 pb-12 md:px-10 md:grid-cols-2">
        {children}

        <section
          aria-label={t("panelLabel", { product: LEGAL.product })}
          className="flex flex-col gap-8 rounded-lg bg-butter px-6 py-8 text-foreground md:p-16"
        >
          <div>
            <span className="inline-flex h-8 items-center rounded-full border border-border px-3.5 text-sm font-medium">
              {t("chip")}
            </span>
            <h2 className="my-4 text-4xl leading-[1.2] text-balance md:text-[44px] xl:text-5xl">{t("headline")}</h2>
            <p className="max-w-[42ch] text-lg text-body">{t("body")}</p>
          </div>
          <Image
            src="/images/mona-magnifier.png"
            alt={t("monaAlt")}
            width={720}
            height={715}
            sizes="252px"
            className="m-auto h-auto w-[182px] md:w-[252px]"
          />
          <ul className="grid gap-3">
            {[t("point1"), t("point2")].map((point) => (
              <li key={point} className="flex items-center gap-3 text-base">
                <CircleCheck aria-hidden className="size-[22px] shrink-0 fill-foreground text-butter" />
                {point}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
