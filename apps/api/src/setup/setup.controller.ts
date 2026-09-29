import { Body, Controller, Get, Patch } from '@nestjs/common';
import { updateSetupSchema, type SetupProgress, type UpdateSetupInput } from '@reserivo/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { SalonRoles, Tenant } from '../tenancy/salon-roles.decorator.js';
import type { TenantContext } from '../tenancy/tenant.types.js';
import { SetupService } from './setup.service.js';

/** The caller's own setup guide for this business. There is no route to read or change anyone else's. */
@Controller('salons/:salonId/setup')
@SalonRoles('MANAGER', 'DESIGNER')
export class SetupController {
  constructor(private readonly setup: SetupService) {}

  @Get()
  get(@Tenant() tenant: TenantContext): Promise<SetupProgress> {
    return this.setup.progress(tenant);
  }

  @Patch()
  update(
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(updateSetupSchema)) body: UpdateSetupInput,
  ): Promise<SetupProgress> {
    return this.setup.update(tenant, body);
  }
}
