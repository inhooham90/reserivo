import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module.js';
import { MembersModule } from '../members/members.module.js';
import { LiveEventsService } from './live-events.service.js';
import { MessageNudgesScheduler } from './message-nudges.scheduler.js';
import { MyConversationsController, MyLiveController, SalonConversationsController } from './messaging.controller.js';
import { MessagingService } from './messaging.service.js';

@Module({
  imports: [MembersModule, CustomersModule],
  controllers: [MyConversationsController, SalonConversationsController, MyLiveController],
  providers: [MessagingService, LiveEventsService, MessageNudgesScheduler],
})
export class MessagingModule {}
