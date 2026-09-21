import { Global, Module } from '@nestjs/common';
import { SalonHoursController } from './salon-hours.controller.js';
import { SalonHoursService } from './salon-hours.service.js';

/** Global: salons, availability and slot computation all consult opening hours. */
@Global()
@Module({
  controllers: [SalonHoursController],
  providers: [SalonHoursService],
  exports: [SalonHoursService],
})
export class SalonHoursModule {}
