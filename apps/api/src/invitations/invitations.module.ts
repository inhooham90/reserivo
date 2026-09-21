import { Module } from '@nestjs/common';
import { InviteTokenController, SalonInvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';

@Module({
  controllers: [SalonInvitationsController, InviteTokenController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
