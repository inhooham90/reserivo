import { Body, Controller, Get, Headers, HttpCode, Post, Req, type RawBodyRequest } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { startCheckoutSchema, type BillingRedirect, type BillingStatus, type StartCheckoutInput } from '@reserivo/shared';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { SalonRoles, Tenant } from '../tenancy/salon-roles.decorator.js';
import type { TenantContext } from '../tenancy/tenant.types.js';
import { BillingService } from './billing.service.js';

/** A business's subscription. Managers only: it is the business's money. */
@Controller('salons/:salonId/billing')
export class SalonBillingController {
  constructor(private readonly billing: BillingService) {}

  @SalonRoles('MANAGER')
  @Get()
  status(@Tenant() tenant: TenantContext): Promise<BillingStatus> {
    return this.billing.status(tenant.salonId);
  }

  /** Tight budget: a promo-code box is a guessing surface. */
  @SalonRoles('MANAGER')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('checkout')
  checkout(
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(startCheckoutSchema)) body: StartCheckoutInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BillingRedirect> {
    return this.billing.startCheckout(tenant.salonId, body, user);
  }

  @SalonRoles('MANAGER')
  @HttpCode(200)
  @Post('portal')
  portal(@Tenant() tenant: TenantContext): Promise<BillingRedirect> {
    return this.billing.openPortal(tenant.salonId);
  }
}

/**
 * Stripe → us. Public because Stripe holds no token; the signature on the raw
 * body is the authentication. Skipped by the throttler (Stripe bursts on
 * retries) and by the audit interceptor (the body is Stripe's, not a user's).
 */
@Controller('billing')
export class StripeWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @Post('webhook')
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature: string | undefined): Promise<{ received: true }> {
    await this.billing.handleWebhook(req.rawBody, signature);
    return { received: true };
  }
}
