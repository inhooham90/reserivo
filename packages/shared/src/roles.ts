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

/** A member's capabilities: at least one, no duplicates. MANAGER administers; DESIGNER is bookable. */
export const salonRolesSchema = z
  .array(salonRoleSchema)
  .min(1, 'Pick at least one role')
  .refine((r) => new Set(r).size === r.length, { message: 'Duplicate role' });
export type SalonRoles = z.infer<typeof salonRolesSchema>;

export const hasRole = (roles: readonly SalonRole[], role: SalonRole): boolean => roles.includes(role);
