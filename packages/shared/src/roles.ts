import { z } from 'zod';

/** Roles a user can hold *within a salon*. Stored on SalonMembership, never on User. */
export const SalonRole = {
  MANAGER: 'MANAGER',
  DESIGNER: 'DESIGNER',
} as const;
export type SalonRole = (typeof SalonRole)[keyof typeof SalonRole];
export const salonRoleSchema = z.enum([SalonRole.MANAGER, SalonRole.DESIGNER]);

export const MembershipStatus = {
  INVITED: 'INVITED',
  ACTIVE: 'ACTIVE',
  REMOVED: 'REMOVED',
} as const;
export type MembershipStatus = (typeof MembershipStatus)[keyof typeof MembershipStatus];
