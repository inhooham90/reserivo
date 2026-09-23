import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Link } from "@/i18n/navigation";
import { LEGAL } from "@/lib/legal";

/**
 * On the pages a client actually sees. Carriers reviewing an SMS campaign
 * expect Terms and a Privacy Policy reachable from the site, not only from
 * the consent checkbox.
 */
export function PublicFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-4 gap-y-1 px-6 pb-10 text-xs text-muted-foreground">
      <span>
        © {new Date().getFullYear()} {LEGAL.legalName}
      </span>
      <Link href="/terms" className="underline">
        Terms
      </Link>
      <Link href="/privacy" className="underline">
        Privacy
      </Link>
      <Link href="/sms" className="underline">
        Text reminders
      </Link>
      <a href={`mailto:${LEGAL.supportEmail}`} className="underline">
        Contact
      </a>
      {/* A client who cannot read the page needs this without signing in, so it
          lives in the footer of every public page rather than the app header. */}
      <LocaleSwitcher className="ml-auto" />
    </footer>
  );
}
