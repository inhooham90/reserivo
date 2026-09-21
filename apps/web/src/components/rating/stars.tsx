"use client";

import { RATING_MAX_STARS, type DesignerRating } from "@reserivo/shared";
import { cn } from "cn";

/**
 * A score as filled stars.
 *
 * Drawn with a clipped overlay rather than rounding to the nearest half star,
 * because 4.3 and 4.7 are meaningfully different to someone choosing between
 * two designers and both would otherwise render as 4.5.
 *
 * The stars are decorative; the number beside them is what is announced.
 */
export function Stars({ value, className }: { value: number; className?: string }) {
  const filledPercent = (value / RATING_MAX_STARS) * 100;

  return (
    <span aria-hidden className={cn("relative inline-block leading-none select-none", className)}>
      <span className="text-muted-foreground/35">{"★".repeat(RATING_MAX_STARS)}</span>
      <span
        className="absolute inset-y-0 left-0 overflow-hidden text-primary"
        style={{ width: `${filledPercent}%` }}
      >
        {"★".repeat(RATING_MAX_STARS)}
      </span>
    </span>
  );
}

/**
 * The score as a client sees it on the booking page.
 *
 * `count` is null until enough clients have rated, and the API nulls it rather
 * than the UI hiding it — so "4.0" on a new designer reads as a starting point
 * rather than as a claim that someone gave them four stars.
 */
export function RatingSummary({ rating, className }: { rating: DesignerRating; className?: string }) {
  const label =
    rating.count === null
      ? `Rated ${rating.stars} out of ${RATING_MAX_STARS}`
      : `Rated ${rating.stars} out of ${RATING_MAX_STARS} from ${rating.count} ${rating.count === 1 ? "client" : "clients"}`;

  return (
    <span className={cn("flex items-center gap-1.5 text-sm", className)} title={label}>
      <Stars value={rating.stars} />
      <span className="sr-only">{label}</span>
      <span aria-hidden className="tabular-nums font-medium">
        {rating.stars.toFixed(1)}
      </span>
      {rating.count !== null && (
        <span aria-hidden className="text-muted-foreground">
          ({rating.count})
        </span>
      )}
    </span>
  );
}
