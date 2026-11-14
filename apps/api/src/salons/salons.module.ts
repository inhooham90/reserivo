import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module.js';
import { RatingsModule } from '../ratings/ratings.module.js';
import { SalonsController } from './salons.controller.js';
import { SalonsService } from './salons.service.js';

@Module({
  // The public booking payload carries each designer's score.
  // …and whether it is taking online bookings at all.
  imports: [RatingsModule, BillingModule],
  controllers: [SalonsController],
  providers: [SalonsService],
  exports: [SalonsService],
})
export class SalonsModule {}
