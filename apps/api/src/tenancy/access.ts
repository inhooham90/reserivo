import { ForbiddenException } from '@nestjs/common';
import type { TenantContext } from './tenant.types.js';

/** Site admins (null membership) are treated as managers everywhere. */
export function isManager(tenant: TenantContext): boolean {
  return tenant.membership === null || tenant.membership.role === 'MANAGER';
}

/** Managers may act on any member; everyone else only on themselves. */
export function canManageMember(tenant: TenantContext, memberId: string): boolean {
  return isManager(tenant) || tenant.membership?.id === memberId;
}

export function assertCanManageMember(tenant: TenantContext, memberId: string): void {
  if (!canManageMember(tenant, memberId)) {
    throw new ForbiddenException('Only managers can change other members');
  }
}

export function assertManager(tenant: TenantContext): void {
  if (!isManager(tenant)) throw new ForbiddenException('Managers only');
}
