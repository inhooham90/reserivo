import { Module } from '@nestjs/common';
import { SalonsController } from './salons.controller.js';
import { SalonsService } from './salons.service.js';

@Module({
  controllers: [SalonsController],
  providers: [SalonsService],
  exports: [SalonsService],
})
export class SalonsModule {}
