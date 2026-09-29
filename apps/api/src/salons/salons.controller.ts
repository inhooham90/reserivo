import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  createSalonSchema,
  updateSalonSchema,
  type CreateSalonInput,
  type MySalon,
  type PublicSalon,
  type Salon,
  type UpdateSalonInput,
} from '@reserivo/shared';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { SalonRoles, Tenant } from '../tenancy/salon-roles.decorator.js';
import type { TenantContext } from '../tenancy/tenant.types.js';
import { SalonsService } from './salons.service.js';

@Controller('salons')
export class SalonsController {
  constructor(private readonly salons: SalonsService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createSalonSchema)) body: CreateSalonInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MySalon> {
    return this.salons.create(body, user);
  }

  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedUser): Promise<MySalon[]> {
    return this.salons.listMine(user.id);
  }

  /** Public: what the booking page needs before anyone logs in. */
  @Public()
  @Get('by-slug/:slug')
  getBySlug(@Param('slug') slug: string): Promise<PublicSalon> {
    return this.salons.getBySlug(slug);
  }

  /** Any active member (or a site admin) can read the salon they belong to. */
  @SalonRoles('MANAGER', 'DESIGNER')
  @Get(':salonId')
  getOne(@Tenant() tenant: TenantContext): Promise<Salon> {
    return this.salons.getById(tenant.salonId);
  }

  @SalonRoles('MANAGER')
  @Patch(':salonId')
  update(
    @Tenant() tenant: TenantContext,
    @Body(new ZodValidationPipe(updateSalonSchema)) body: UpdateSalonInput,
  ): Promise<Salon> {
    return this.salons.update(tenant.salonId, body, tenant.membership?.id);
  }
}
