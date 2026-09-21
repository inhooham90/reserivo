"use client";

import { RATING_MAX_STARS, type MyRating } from "@reserivo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { cn } from "cn";

export const myRatingsKey = ["me", "ratings"] as const;

/**
 * Five stars a client can click to rate the designer who did their service.
 *
 * One rating per designer: clicking again replaces it, which is why the
 * request is a PUT and why an existing score is shown selected rather than the
 * control disappearing once used. People change their minds about a haircut a
 * week later.
 *
 * Only ever rendered against a completed appointment. The API enforces that
 * independently — this is the affordance, not the rule.
 */
export function RateDesigner({ designerId, designerName }: { designerId: string; designerName: string }) {
  const queryClient = useQueryClient();
  const [hovered, setHovered] = useState<number | null>(null);

  const mine = useQuery({ queryKey: myRatingsKey, queryFn: () => api<MyRating[]>("/me/ratings") });
  const saved = mine.data?.find((r) => r.designerId === designerId)?.stars ?? null;

  const rate = useMutation({
    mutationFn: (stars: number) => api<MyRating>(`/me/ratings/${designerId}`, { method: "PUT", json: { stars } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myRatingsKey }),
  });

  // What the stars look like right now: the hovered value while pointing, the
  // saved one otherwise.
  const shown = hovered ?? saved ?? 0;

  return (
    <span className="flex items-center gap-1.5">
      <span
        role="radiogroup"
        aria-label={`Rate ${designerName}`}
        className="flex items-center"
        onMouseLeave={() => setHovered(null)}
      >
        {Array.from({ length: RATING_MAX_STARS }, (_, i) => i + 1).map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={saved === star}
            aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
            disabled={rate.isPending}
            onMouseEnter={() => setHovered(star)}
            onFocus={() => setHovered(star)}
            onBlur={() => setHovered(null)}
            onClick={() => rate.mutate(star)}
            className={cn(
              "px-0.5 text-base leading-none transition-colors disabled:opacity-50",
              "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              star <= shown ? "text-primary" : "text-muted-foreground/35 hover:text-primary/60",
            )}
          >
            ★
          </button>
        ))}
      </span>
      {rate.isError && (
        <span className="text-xs text-destructive">
          {rate.error instanceof ApiError ? rate.error.message : "Could not save"}
        </span>
      )}
      {!rate.isError && saved !== null && <span className="text-xs text-muted-foreground">Thanks</span>}
    </span>
  );
}
