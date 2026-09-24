import { Module } from '@nestjs/common';
import { CampaignsController, UnsubscribeController } from './campaigns.controller.js';
import { CampaignsScheduler } from './campaigns.scheduler.js';
import { CampaignsService } from './campaigns.service.js';
import { MarketingMailer } from './marketing-mailer.js';

@Module({
  controllers: [CampaignsController, UnsubscribeController],
  providers: [CampaignsService, CampaignsScheduler, MarketingMailer],
  exports: [CampaignsService],
})
export class CampaignsModule {}
