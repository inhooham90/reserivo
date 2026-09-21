import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import {
  createAvailabilityExceptionSchema,
  replaceAvailabilityRulesSchema,
  type AvailabilityException,
  type AvailabilityRule,
  type CreateAvailabilityExceptionInput,
  type ReplaceAvailabilityRulesInput,
  type SalonHours,
} from '@reserivo/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { SalonRoles, Tenant } from '../tenancy/salon-roles.decorator.js';
import type { TenantContext } from '../tenancy/tenant.types.js';
import { SalonHoursService } from './salon-hours.service.js';

/** Opening hours: every member may read them; managers edit them. */
@Controller('salons/:salonId/hours')
export class SalonHoursController {
  constructor(private readonly hours: SalonHoursService) {}

  @SalonRoles('MANAGER', 'DESIGNER')
  @Get()
  get(@Tenant() tenant: TenantContext): Promise<SalonHours> {
    return this.hours.get(tenant.salonId);
  }

  @SalonRoles('MANAGER')
  @Put('rules')
  replaceRules(
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(replaceAvailabilityRulesSchema)) body: ReplaceAvailabilityRulesInput,
  ): Promise<AvailabilityRule[]> {
    return this.hours.replaceRules(tenant.salonId, body);
  }

  @SalonRoles('MANAGER')
  @Post('exceptions')
  addException(
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(createAvailabilityExceptionSchema)) body: CreateAvailabilityExceptionInput,
  ): Promise<AvailabilityException> {
    return this.hours.addException(tenant.salonId, body);
  }

  @SalonRoles('MANAGER')
  @HttpCode(204)
  @Delete('exceptions/:id')
  removeException(@Tenant() tenant: TenantContext, @Param('id') id: string): Promise<void> {
    return this.hours.removeException(tenant.salonId, id);
  }
}
