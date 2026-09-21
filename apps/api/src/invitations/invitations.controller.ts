import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  createInvitationSchema,
  type AcceptInvitationResponse,
  type CreateInvitationInput,
  type Invitation,
  type InvitationPreview,
} from '@reserivo/shared';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { SalonRoles, Tenant } from '../tenancy/salon-roles.decorator.js';
import type { TenantContext } from '../tenancy/tenant.types.js';
import { InvitationsService } from './invitations.service.js';

/** Manager side: issue, list and revoke invites for a salon. */
@Controller('salons/:salonId/invitations')
export class SalonInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @SalonRoles('MANAGER')
  @Post()
  create(
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(createInvitationSchema)) body: CreateInvitationInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Invitation> {
    return this.invitations.create(tenant.salonId, body, user);
  }

  @SalonRoles('MANAGER')
  @Get()
  list(@Tenant() tenant: TenantContext): Promise<Invitation[]> {
    return this.invitations.listPending(tenant.salonId);
  }

  @SalonRoles('MANAGER')
  @HttpCode(204)
  @Delete(':id')
  revoke(@Tenant() tenant: TenantContext, @Param('id') id: string): Promise<void> {
    return this.invitations.revoke(tenant.salonId, id);
  }
}

/** Invitee side: the token is the credential; accepting also needs a session. */
@Controller('invitations')
export class InviteTokenController {
  constructor(private readonly invitations: InvitationsService) {}

  @Public()
  @Get(':token')
  preview(@Param('token') token: string): Promise<InvitationPreview> {
    return this.invitations.preview(token);
  }

  @HttpCode(200)
  @Post(':token/accept')
  accept(@Param('token') token: string, @CurrentUser() user: AuthenticatedUser): Promise<AcceptInvitationResponse> {
    return this.invitations.accept(token, user);
  }
}
