import { Module } from '@nestjs/common';
import { RatingsModule } from '../ratings/ratings.module.js';
import { SalonsController } from './salons.controller.js';
import { SalonsService } from './salons.service.js';

@Module({
  // The public booking payload carries each designer's score.
  imports: [RatingsModule],
  controllers: [SalonsController],
  providers: [SalonsService],
  exports: [SalonsService],
})
export class SalonsModule {}
