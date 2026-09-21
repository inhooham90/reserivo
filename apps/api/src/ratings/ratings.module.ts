import { Module } from '@nestjs/common';
import { RatingsController } from './ratings.controller.js';
import { RatingsService } from './ratings.service.js';

@Module({
  controllers: [RatingsController],
  providers: [RatingsService],
  // SalonsService uses it to put a score on each designer in the public
  // booking payload.
  exports: [RatingsService],
})
export class RatingsModule {}
