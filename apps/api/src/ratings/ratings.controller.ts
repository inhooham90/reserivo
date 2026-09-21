import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { rateDesignerSchema, type MyRating, type RateDesignerInput } from '@reserivo/shared';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { RatingsService } from './ratings.service.js';

/**
 * A client rating their own designers.
 *
 * Deliberately not under `/salons/:salonId` — that tree runs through the
 * tenancy guard, which answers "is this person staff here?". A client rating a
 * designer is never staff, so the route hangs off `me/` like their appointments
 * do, and the service works out which salon from the designer.
 *
 * `PUT` rather than `POST`: there is one rating per client per designer, and
 * sending it again replaces it.
 */
@Controller('me/ratings')
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser): Promise<MyRating[]> {
    return this.ratings.listMine(user);
  }

  @Put(':designerId')
  rate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('designerId') designerId: string,
    @Body(new ZodValidationPipe(rateDesignerSchema)) body: RateDesignerInput,
  ): Promise<MyRating> {
    return this.ratings.rate(user, designerId, body.stars);
  }
}
