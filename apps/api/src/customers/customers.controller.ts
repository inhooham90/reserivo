import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  createCustomerSchema,
  customersQuerySchema,
  updateCustomerSchema,
  type CreateCustomerInput,
  type Customer,
  type CustomerDetail,
  type CustomersQuery,
  type UpdateCustomerInput,
} from '@reserivo/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { SalonRoles, Tenant } from '../tenancy/salon-roles.decorator.js';
import type { TenantContext } from '../tenancy/tenant.types.js';
import { CustomersService } from './customers.service.js';

/** The salon's CRM. Designers may search and read (names, notes, tags) but never see contact fields. */
@Controller('salons/:salonId/customers')
@SalonRoles('MANAGER', 'DESIGNER')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  search(@Tenant() tenant: TenantContext, @Query(new ZodValidationPipe(customersQuerySchema)) query: CustomersQuery): Promise<Customer[]> {
    return this.customers.search(tenant, query);
  }

  @Post()
  create(@Tenant() tenant: TenantContext, @Body(new ZodValidationPipe(createCustomerSchema)) body: CreateCustomerInput): Promise<Customer> {
    return this.customers.create(tenant, body);
  }

  @Get(':id')
  detail(@Tenant() tenant: TenantContext, @Param('id') id: string): Promise<CustomerDetail> {
    return this.customers.detail(tenant, id);
  }

  @Patch(':id')
  update(
    @Tenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCustomerSchema)) body: UpdateCustomerInput,
  ): Promise<Customer> {
    return this.customers.update(tenant, id, body);
  }
}
