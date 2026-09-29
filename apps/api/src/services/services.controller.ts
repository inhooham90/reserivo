import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createServiceInputSchema,
  createServicesInputSchema,
  updateServiceSchema,
  type CreateServiceInput,
  type CreateServicesInput,
  type Service,
  type UpdateServiceInput,
} from '@reserivo/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { SalonRoles, Tenant } from '../tenancy/salon-roles.decorator.js';
import type { TenantContext } from '../tenancy/tenant.types.js';
import { ServicesService } from './services.service.js';

@Controller('salons/:salonId/services')
@SalonRoles('MANAGER', 'DESIGNER')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  @Get()
  list(@Tenant() tenant: TenantContext, @Query('designerId') designerId?: string): Promise<Service[]> {
    return this.services.list(tenant, designerId || undefined);
  }

  @Post()
  create(
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(createServiceInputSchema)) body: CreateServiceInput,
  ): Promise<Service> {
    return this.services.create(tenant, body);
  }

  /** The guided setup saves a whole menu in one request: all of it or none of it. */
  @Post('bulk')
  createMany(
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(createServicesInputSchema)) body: CreateServicesInput,
  ): Promise<Service[]> {
    return this.services.createMany(tenant, body);
  }

  @Patch(':id')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateServiceSchema)) body: UpdateServiceInput,
  ): Promise<Service> {
    return this.services.update(tenant, id, body);
  }

  @HttpCode(204)
  @Delete(':id')
  remove(@Tenant() tenant: TenantContext, @Param('id') id: string): Promise<void> {
    return this.services.remove(tenant, id);
  }
}
