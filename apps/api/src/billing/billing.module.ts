import { Module } from '@nestjs/common';
import { SalonBillingController, StripeWebhookController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { StripeClient } from './stripe.client.js';

@Module({
  controllers: [SalonBillingController, StripeWebhookController],
  providers: [BillingService, StripeClient],
  // Salons and appointments ask it whether a business takes online bookings.
  exports: [BillingService],
})
export class BillingModule {}
