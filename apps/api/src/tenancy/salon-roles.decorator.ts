import { applyDecorators, createParamDecorator, ExecutionContext, SetMetadata, UseGuards } from '@nestjs/common';
import type { SalonRole } from '@reserivo/shared';
import type { Request } from 'express';
import { SalonMembershipGuard } from './salon-membership.guard.js';
import type { TenantContext } from './tenant.types.js';

export const SALON_ROLES_KEY = 'salonRoles';

/**
 * Requires the caller to hold one of the given roles in the salon at `:salonId`.
 * Site admins pass regardless. Attaches req.tenant for @Tenant().
 *
 *   @SalonRoles('MANAGER')
 *   @Patch(':salonId')
 */
export function SalonRoles(...roles: SalonRole[]) {
  return applyDecorators(SetMetadata(SALON_ROLES_KEY, roles), UseGuards(SalonMembershipGuard));
}

/** Injects the TenantContext resolved by SalonMembershipGuard. */
export const Tenant = createParamDecorator((_data: unknown, ctx: ExecutionContext): TenantContext => {
  const req = ctx.switchToHttp().getRequest<Request & { tenant: TenantContext }>();
  return req.tenant;
});
