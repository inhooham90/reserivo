import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono, Noto_Sans_KR, Noto_Sans_SC } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Providers } from "@/components/providers";
import { LOCALES, type Locale } from "@/i18n/routing";
import "../globals.css";

// Body and UI copy: Geist. Headings: Fraunces, a warm editorial serif. Both are
// exposed as CSS variables and mapped to Tailwind's font tokens in globals.css.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
});

/**
 * Geist and Fraunces carry no Korean or Chinese glyphs, so without these the
 * browser silently falls back to whatever system font it has and the page
 * stops looking designed. They are `preload: false` and applied only on the
 * locales that need them, so an English or Spanish visitor never downloads a
 * CJK face — they are large.
 */
const notoKR = Noto_Sans_KR({ variable: "--font-cjk", subsets: ["latin"], preload: false, weight: ["400", "500", "600"] });
const notoSC = Noto_Sans_SC({ variable: "--font-cjk", subsets: ["latin"], preload: false, weight: ["400", "500", "600"] });

const CJK_FONT: Partial<Record<Locale, string>> = {
  ko: notoKR.variable,
  zh: notoSC.variable,
};

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("title"), description: t("description") };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // The middleware only ever routes known locales here, but a hand-typed URL
  // can still reach it and must 404 rather than render an empty message table.
  if (!hasLocale(LOCALES, locale)) notFound();
  setRequestLocale(locale);
  const common = await getTranslations("common");

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${CJK_FONT[locale] ?? ""} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* WCAG 2.4.1: the first Tab stop on every page jumps past the header.
            Every page's <main> carries id="main" and tabIndex={-1} to receive it. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:ring-3 focus:ring-ring"
        >
          {common("skipToContent")}
        </a>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
