import { mapsHref, telHref } from "@reserivo/shared";
import { MapPin, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "cn";

/**
 * A business's public phone and address, each a link: tap to call, tap for
 * directions. Shown wherever a client might need to reach the business,
 * above all to change a booking they can no longer cancel online. Renders
 * nothing when the business has filled in neither.
 *
 * No hooks beyond translations, so it renders in server components (the
 * booking page) and client ones (the booking flow, My appointments) alike.
 */
export function BusinessContact({
  phone,
  address,
  className,
}: {
  phone: string | null;
  address: string | null;
  className?: string;
}) {
  const t = useTranslations("contact");
  if (!phone && !address) return null;

  const link =
    "inline-flex min-h-10 items-start gap-2 rounded-sm font-medium underline decoration-border underline-offset-4 outline-none transition-colors hover:decoration-foreground focus-visible:ring-3 focus-visible:ring-ring";
  return (
    <ul data-component="BusinessContact" aria-label={t("label")} className={cn("grid gap-1", className)}>
      {phone && (
        <li>
          <a href={telHref(phone)} className={link}>
            <Phone aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="sr-only">{t("call")} </span>
              {phone}
            </span>
          </a>
        </li>
      )}
      {address && (
        <li>
          <a href={mapsHref(address)} target="_blank" rel="noopener noreferrer" className={link}>
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
            {/* Keeps the business's own line breaks. */}
            <span className="whitespace-pre-line">
              {address}
              <span className="sr-only"> ({t("directions")})</span>
            </span>
          </a>
        </li>
      )}
    </ul>
  );
}
