import { Module } from '@nestjs/common';
import { MembersModule } from '../members/members.module.js';
import { ServicesController } from './services.controller.js';
import { ServicesService } from './services.service.js';

@Module({
  imports: [MembersModule],
  controllers: [ServicesController],
  providers: [ServicesService],
})
export class ServicesModule {}
