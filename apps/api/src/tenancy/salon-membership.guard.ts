import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { SalonRole } from '@reserivo/shared';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SALON_ROLES_KEY } from './salon-roles.decorator.js';
import type { TenantContext } from './tenant.types.js';

type TenantRequest = Request & { user: AuthenticatedUser; tenant?: TenantContext };

/** Express 5 types route params as string | string[]; we only ever declare single segments. */
export function paramString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The tenancy boundary. Resolves the caller's ACTIVE membership in `:salonId`
 * and checks that it holds at least one of the required roles. Services must
 * take salonId from req.tenant, never from the body, so a caller can only ever
 * touch the salon the guard approved.
 */
@Injectable()
export class SalonMembershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<TenantRequest>();
    const salonId = paramString(req.params.salonId);
    if (!salonId) throw new BadRequestException('Route is missing :salonId');

    const required = this.reflector.getAllAndOverride<SalonRole[]>(SALON_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? [];

    const membership = await this.prisma.salonMembership.findFirst({
      where: { salonId, userId: req.user.id, status: 'ACTIVE' },
      select: { id: true, roles: true, displayName: true },
    });

    if (membership) {
      if (required.length && !required.some((r) => membership.roles.includes(r))) {
        throw new ForbiddenException('Your role in this salon does not allow that');
      }
      req.tenant = { salonId, membership };
      return true;
    }

    // Site admins may work in any salon; the audit log still records them as the actor.
    if (req.user.isSiteAdmin) {
      const exists = await this.prisma.salon.count({ where: { id: salonId } });
      if (!exists) throw new ForbiddenException('Salon not found');
      req.tenant = { salonId, membership: null };
      return true;
    }

    throw new ForbiddenException('You are not a member of this salon');
  }
}
