import { Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
  adminSearchSchema,
  auditQuerySchema,
  type AdminSalon,
  type AdminSalonDetail,
  type AdminSearch,
  type AdminUser,
  type AdminUserDetail,
  type AuditPage,
  type AuditQuery,
  type AuthResponse,
  type PlatformStats,
} from '@reserivo/shared';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { AdminService } from './admin.service.js';
import { SiteAdminGuard } from './site-admin.guard.js';

/** Everything here is site-admin only and audited. */
@Controller('admin')
@UseGuards(SiteAdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats(): Promise<PlatformStats> {
    return this.admin.stats();
  }

  @Get('users')
  users(@Query(new ZodValidationPipe(adminSearchSchema)) query: AdminSearch): Promise<AdminUser[]> {
    return this.admin.searchUsers(query);
  }

  @Get('users/:id')
  user(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string): Promise<AdminUserDetail> {
    return this.admin.userDetail(admin, id);
  }

  @Get('salons')
  salons(@Query(new ZodValidationPipe(adminSearchSchema)) query: AdminSearch): Promise<AdminSalon[]> {
    return this.admin.searchSalons(query);
  }

  @Get('salons/:id')
  salon(@Param('id') id: string): Promise<AdminSalonDetail> {
    return this.admin.salonDetail(id);
  }

  @Get('audit')
  audit(@Query(new ZodValidationPipe(auditQuerySchema)) query: AuditQuery): Promise<AuditPage> {
    return this.admin.audits(query);
  }

  /**
   * Returns an access token that acts as this user. No refresh cookie is set,
   * so the admin's own session is still underneath and `POST /auth/refresh`
   * ends the impersonation.
   */
  @HttpCode(200)
  @Post('impersonate/:id')
  impersonate(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Req() req: Request): Promise<AuthResponse> {
    return this.admin.impersonate(admin, id, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }
}
