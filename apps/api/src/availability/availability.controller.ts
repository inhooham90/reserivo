import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import {
  createAvailabilityExceptionSchema,
  replaceAvailabilityRulesSchema,
  type Availability,
  type AvailabilityException,
  type AvailabilityRule,
  type CreateAvailabilityExceptionInput,
  type ReplaceAvailabilityRulesInput,
} from '@reserivo/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { SalonRoles, Tenant } from '../tenancy/salon-roles.decorator.js';
import type { TenantContext } from '../tenancy/tenant.types.js';
import { AvailabilityService } from './availability.service.js';

@Controller('salons/:salonId/members/:memberId/availability')
@SalonRoles('MANAGER', 'DESIGNER')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  get(@Tenant() tenant: TenantContext, @Param('memberId') memberId: string): Promise<Availability> {
    return this.availability.get(tenant, memberId);
  }

  @Put('rules')
  replaceRules(
    @Tenant() tenant: TenantContext,
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(replaceAvailabilityRulesSchema)) body: ReplaceAvailabilityRulesInput,
  ): Promise<AvailabilityRule[]> {
    return this.availability.replaceRules(tenant, memberId, body);
  }

  @Post('exceptions')
  addException(
    @Tenant() tenant: TenantContext,
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(createAvailabilityExceptionSchema)) body: CreateAvailabilityExceptionInput,
  ): Promise<AvailabilityException> {
    return this.availability.addException(tenant, memberId, body);
  }

  @HttpCode(204)
  @Delete('exceptions/:id')
  removeException(
    @Tenant() tenant: TenantContext,
    @Param('memberId') memberId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.availability.removeException(tenant, memberId, id);
  }
}
