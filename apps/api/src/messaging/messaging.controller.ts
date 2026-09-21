import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  sendMessageSchema,
  staffStartConversationSchema,
  startConversationSchema,
  type CustomerConversation,
  type Message,
  type SendMessageInput,
  type StaffConversation,
  type StaffStartConversationInput,
  type StartConversationInput,
  type Thread,
} from '@reserivo/shared';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { SalonRoles, Tenant } from '../tenancy/salon-roles.decorator.js';
import type { TenantContext } from '../tenancy/tenant.types.js';
import { MessagingService } from './messaging.service.js';

/** The customer's inbox, across salons. */
@Controller('me/conversations')
export class MyConversationsController {
  constructor(private readonly messaging: MessagingService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<CustomerConversation[]> {
    return this.messaging.listMine(user);
  }

  @HttpCode(200)
  @Post()
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(startConversationSchema)) body: StartConversationInput,
  ): Promise<Thread> {
    return this.messaging.startMine(user, body);
  }

  /** Reading marks the thread as read for the customer. */
  @Get(':id')
  thread(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<Thread> {
    return this.messaging.threadMine(user, id);
  }

  @Post(':id/messages')
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) body: SendMessageInput,
  ): Promise<Message> {
    return this.messaging.sendMine(user, id, body.body);
  }
}

/** The salon's side of the relay. */
@Controller('salons/:salonId/conversations')
@SalonRoles('MANAGER', 'DESIGNER')
export class SalonConversationsController {
  constructor(private readonly messaging: MessagingService) {}

  @Get()
  list(@Tenant() tenant: TenantContext, @Query('designerId') designerId?: string): Promise<StaffConversation[]> {
    return this.messaging.listStaff(tenant, designerId || undefined);
  }

  @HttpCode(200)
  @Post()
  start(
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(staffStartConversationSchema)) body: StaffStartConversationInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Thread> {
    return this.messaging.startStaff(tenant, body, user);
  }

  /** Reading marks the thread as read for staff. */
  @Get(':id')
  thread(@Tenant() tenant: TenantContext, @Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<Thread> {
    return this.messaging.threadStaff(tenant, id, user);
  }

  /** Sent as the thread's designer, whoever writes it. */
  @Post(':id/messages')
  send(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) body: SendMessageInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Message> {
    return this.messaging.sendStaff(tenant, id, body.body, user);
  }
}
