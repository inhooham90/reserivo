import Link from "next/link";
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
      <a href={`mailto:${LEGAL.supportEmail}`} className="underline">
        Contact
      </a>
    </footer>
  );
}
