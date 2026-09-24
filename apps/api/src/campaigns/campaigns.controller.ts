import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
  campaignAudienceSchema,
  createCampaignSchema,
  type AudiencePreview,
  type Campaign,
  type CampaignAudience,
  type CreateCampaignInput,
  setUnsubscribeScopeSchema,
  type SetUnsubscribeScopeInput,
  type UnsubscribeState,
} from '@reserivo/shared';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { SalonRoles, Tenant } from '../tenancy/salon-roles.decorator.js';
import type { TenantContext } from '../tenancy/tenant.types.js';
import { CampaignsService } from './campaigns.service.js';

/**
 * Email campaigns a salon sends to its own clients.
 *
 * Managers only, and not merely as a permission choice: the privacy policy
 * says a client's email address is visible to a salon's managers alone and
 * calls that a deliberate design decision. A campaign tool a designer could
 * reach would contradict it, so the service asserts the role as well.
 */
@Controller('salons/:salonId/campaigns')
@SalonRoles('MANAGER')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  list(@Tenant() tenant: TenantContext): Promise<Campaign[]> {
    return this.campaigns.list(tenant);
  }

  @Get('audience')
  audience(
    @Tenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(campaignAudienceSchema)) query: CampaignAudience,
  ): Promise<AudiencePreview> {
    return this.campaigns.preview(tenant, query);
  }

  @Post()
  create(
    @Tenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCampaignSchema)) body: CreateCampaignInput,
  ): Promise<Campaign> {
    return this.campaigns.create(tenant, user.id, body);
  }
}

/**
 * The unsubscribe endpoints, deliberately outside every guard.
 *
 * RFC 8058 one-click requires the List-Unsubscribe URL to accept a POST with
 * no authentication and no confirmation step — a mail client posts to it on
 * the reader's behalf, and a login wall would make the header useless. The
 * token is the only credential, which is why it is high-entropy and why these
 * responses say nothing about the person behind it.
 */
@Controller('public/unsubscribe')
export class UnsubscribeController {
  constructor(private readonly campaigns: CampaignsService) {}

  /** One-click. Stops this salon's promotions and never narrows a wider choice. */
  @Public()
  @Post(':token')
  @HttpCode(200)
  unsubscribe(@Param('token') token: string): Promise<UnsubscribeState> {
    return this.campaigns.unsubscribe(token);
  }

  /** The page's choice: this salon, every salon's promotions, everything, or NONE to undo. */
  @Public()
  @Post(':token/scope')
  @HttpCode(200)
  setScope(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(setUnsubscribeScopeSchema)) body: SetUnsubscribeScopeInput,
  ): Promise<UnsubscribeState> {
    return this.campaigns.setScope(token, body.scope);
  }
}
