import type { SalonRole } from '@reserivo/shared';

/** The caller's relationship to the salon named in the route, resolved by SalonMembershipGuard. */
export interface TenantContext {
  salonId: string;
  /** Null when a site admin is accessing a salon they hold no membership in. */
  membership: {
    id: string;
    role: SalonRole;
    displayName: string;
  } | null;
}
