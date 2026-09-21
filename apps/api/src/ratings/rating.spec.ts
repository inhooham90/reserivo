import {
  bayesianStars,
  RATING_COUNT_VISIBLE_FROM,
  RATING_PRIOR_STARS,
  RATING_PRIOR_WEIGHT,
  toDesignerRating,
} from '@reserivo/shared';
import { describe, expect, it } from 'vitest';

/**
 * The scoring rule, pinned.
 *
 * Every designer starts as though they held ten 4-star ratings, so a real
 * rating has to outweigh the prior before the score moves far. These numbers
 * are the product decision, not an implementation detail — if one changes,
 * a designer's public score changes with it.
 */
describe('bayesianStars', () => {
  it('is the prior alone before anyone has rated', () => {
    expect(bayesianStars(0, 0)).toBe(RATING_PRIOR_STARS);
  });

  it('ten 5-star ratings give 4.5, not 5', () => {
    // (4 x 10 + 5 x 10) / (10 + 10)
    expect(bayesianStars(10, 50)).toBe(4.5);
  });

  it('a single rating barely moves it', () => {
    expect(bayesianStars(1, 5)).toBe(4.1);
    expect(bayesianStars(1, 1)).toBe(3.7);
  });

  it('keeps climbing towards 5 as real ratings pile up', () => {
    expect(bayesianStars(25, 125)).toBe(4.7);
    expect(bayesianStars(50, 250)).toBe(4.8);
    expect(bayesianStars(100, 500)).toBe(4.9);
  });

  it('lets a genuinely bad designer fall', () => {
    expect(bayesianStars(25, 25)).toBe(1.9);
    expect(bayesianStars(50, 50)).toBe(1.5);
  });

  it('protects a good designer from one bad review', () => {
    // 24 fives and a single one.
    expect(bayesianStars(25, 24 * 5 + 1)).toBe(4.6);
  });

  it('never leaves the 1-5 range, whatever the input', () => {
    expect(bayesianStars(1000, 1000)).toBeGreaterThanOrEqual(1);
    expect(bayesianStars(1000, 5000)).toBeLessThanOrEqual(5);
  });

  it('weights the prior exactly as many ratings as RATING_PRIOR_WEIGHT', () => {
    // As many real 5s as the prior's weight lands halfway between 4 and 5.
    const halfway = (RATING_PRIOR_STARS + 5) / 2;
    expect(bayesianStars(RATING_PRIOR_WEIGHT, RATING_PRIOR_WEIGHT * 5)).toBe(halfway);
  });
});

describe('toDesignerRating', () => {
  it('hides the count until there are enough real ratings', () => {
    for (let n = 0; n < RATING_COUNT_VISIBLE_FROM; n++) {
      expect(toDesignerRating(n, n * 5).count).toBeNull();
    }
  });

  it('shows the count from the threshold onwards', () => {
    expect(toDesignerRating(RATING_COUNT_VISIBLE_FROM, RATING_COUNT_VISIBLE_FROM * 5).count).toBe(
      RATING_COUNT_VISIBLE_FROM,
    );
    expect(toDesignerRating(12, 60).count).toBe(12);
  });

  it('always carries a score, even with nothing behind it', () => {
    expect(toDesignerRating(0, 0)).toEqual({ stars: RATING_PRIOR_STARS, count: null });
  });
});
