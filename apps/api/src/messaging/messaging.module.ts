import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module.js';
import { MembersModule } from '../members/members.module.js';
import { MyConversationsController, SalonConversationsController } from './messaging.controller.js';
import { MessagingService } from './messaging.service.js';

@Module({
  imports: [MembersModule, CustomersModule],
  controllers: [MyConversationsController, SalonConversationsController],
  providers: [MessagingService],
})
export class MessagingModule {}
