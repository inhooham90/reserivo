import { z } from 'zod';

export const RATING_MIN_STARS = 1;
export const RATING_MAX_STARS = 5;

/**
 * Every designer starts as though they already held ten 4-star ratings.
 *
 * Without it, the first client to leave one star would put a designer on 1.0
 * and the first to leave five would put them on a perfect 5.0 — neither of
 * which anyone should believe. The prior is the claim "assume a new designer
 * is decent until there is evidence either way", and real ratings have to
 * outweigh it before the score moves far.
 *
 * Ten 5-star ratings land on 4.5, not 5.0. Twenty-five reach 4.71, fifty 4.83.
 * A genuinely bad designer still falls: twenty-five 1-star ratings give 1.86.
 * A single bad review against an otherwise perfect designer with twenty-five
 * ratings only pulls them to 4.60, which is the point.
 */
export const RATING_PRIOR_STARS = 4;
export const RATING_PRIOR_WEIGHT = 10;

/**
 * Below this many real ratings only the score is shown, with no count beside
 * it. A count of "1" invites a client to discount the score entirely, and a
 * count of "0" would advertise that the number is nothing but the prior.
 */
export const RATING_COUNT_VISIBLE_FROM = 3;

export const ratingStarsSchema = z.number().int().min(RATING_MIN_STARS).max(RATING_MAX_STARS);

export const rateDesignerSchema = z.object({ stars: ratingStarsSchema });
export type RateDesignerInput = z.infer<typeof rateDesignerSchema>;

/**
 * The prior-weighted mean, to one decimal.
 *
 * `sum` is the total of the real stars, `count` how many there are — both
 * straight from an aggregate query, so this never needs the ratings themselves.
 */
export function bayesianStars(count: number, sum: number): number {
  const weighted = RATING_PRIOR_STARS * RATING_PRIOR_WEIGHT + sum;
  const weight = RATING_PRIOR_WEIGHT + count;
  return Math.round((weighted / weight) * 10) / 10;
}

export const designerRatingSchema = z.object({
  /** Prior-weighted score, one decimal. Always present — every designer has one. */
  stars: z.number(),
  /**
   * How many real ratings are behind it, or null while there are too few to
   * show. Nulled on the server rather than hidden in the UI, so the number a
   * client is not meant to see is never sent to their browser.
   */
  count: z.number().int().nullable(),
});
export type DesignerRating = z.infer<typeof designerRatingSchema>;

export function toDesignerRating(count: number, sum: number): DesignerRating {
  return {
    stars: bayesianStars(count, sum),
    count: count >= RATING_COUNT_VISIBLE_FROM ? count : null,
  };
}

/** A client's own rating of one designer, as returned by `GET /me/ratings`. */
export const myRatingSchema = z.object({
  designerId: z.string(),
  stars: ratingStarsSchema,
});
export type MyRating = z.infer<typeof myRatingSchema>;
