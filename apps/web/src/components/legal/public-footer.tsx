import { SMS_PROGRAM_ENABLED } from "@reserivo/shared";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Link } from "@/i18n/navigation";
import { LEGAL } from "@/lib/legal";
import { cn } from "cn";

/**
 * On the pages a client actually sees. Carriers reviewing an SMS campaign
 * expect Terms and a Privacy Policy reachable from the site, not only from
 * the consent checkbox. `className` lets a wider page widen it to its own
 * column; the default matches the legal pages.
 *
 * `home` is the website board's footer: larger ink text, the links centred
 * between the copyright and an outlined language pill. Other pages keep the
 * small muted row until their own redesign.
 */
export function PublicFooter({ className, variant = "default" }: { className?: string; variant?: "default" | "home" }) {
  const t = useTranslations("footer");
  const home = variant === "home";
  const link = cn("underline-offset-4 hover:underline", home ? "decoration-mona-ink" : "hover:text-foreground");
  return (
    <footer className={cn("mx-auto w-full max-w-3xl px-6 pb-10", className)}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-6",
          home ? "border-rule text-base text-mona-ink md:grid md:grid-cols-[1fr_auto_1fr] md:gap-x-6" : "text-xs text-muted-foreground",
        )}
      >
        <span>
          © {new Date().getFullYear()} {LEGAL.legalName}
        </span>
        {/* `contents` keeps the default row flat; the home grid centres the links as one group. */}
        <span className={cn("contents", home && "md:flex md:flex-wrap md:justify-center md:gap-x-6")}>
          <Link href="/pricing" className={link}>
            {t("pricing")}
          </Link>
          <Link href="/terms" className={link}>
            {t("terms")}
          </Link>
          <Link href="/privacy" className={link}>
            {t("privacy")}
          </Link>
          <Link href="/accessibility" className={link}>
            {t("accessibility")}
          </Link>
          {SMS_PROGRAM_ENABLED && (
            <Link href="/sms" className={link}>
              {t("sms")}
            </Link>
          )}
          <a href={`mailto:${LEGAL.supportEmail}`} className={link}>
            {t("contact")}
          </a>
        </span>
        {/* A client who cannot read the page needs this without signing in, so it
            lives in the footer of every public page rather than the app header. */}
        <LocaleSwitcher
          globe={home}
          className={cn(
            "ml-auto",
            home &&
              "h-11 gap-2 justify-self-end rounded-full border border-mona-ink px-4 text-base font-semibold text-mona-ink hover:bg-white",
          )}
        />
      </div>
    </footer>
  );
}
