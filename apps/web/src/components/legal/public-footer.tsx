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
 */
export function PublicFooter({ className }: { className?: string }) {
  const t = useTranslations("footer");
  return (
    <footer className={cn("mx-auto w-full max-w-3xl px-6 pb-10", className)}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-6 text-xs text-muted-foreground">
        <span>
          © {new Date().getFullYear()} {LEGAL.legalName}
        </span>
        <Link href="/terms" className="underline-offset-4 hover:text-foreground hover:underline">
          {t("terms")}
        </Link>
        <Link href="/privacy" className="underline-offset-4 hover:text-foreground hover:underline">
          {t("privacy")}
        </Link>
        <Link href="/accessibility" className="underline-offset-4 hover:text-foreground hover:underline">
          {t("accessibility")}
        </Link>
        <Link href="/sms" className="underline-offset-4 hover:text-foreground hover:underline">
          {t("sms")}
        </Link>
        <a href={`mailto:${LEGAL.supportEmail}`} className="underline-offset-4 hover:text-foreground hover:underline">
          {t("contact")}
        </a>
        {/* A client who cannot read the page needs this without signing in, so it
            lives in the footer of every public page rather than the app header. */}
        <LocaleSwitcher className="ml-auto" />
      </div>
    </footer>
  );
}
