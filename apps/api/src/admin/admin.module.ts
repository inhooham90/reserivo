import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { SiteAdminBootstrap } from './site-admin-bootstrap.service.js';
import { SiteAdminGuard } from './site-admin.guard.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService, SiteAdminGuard, SiteAdminBootstrap],
})
export class AdminModule {}
