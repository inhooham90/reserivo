/** What every authenticated request carries on req.user. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  isSiteAdmin: boolean;
  /**
   * Proof the person controls this address. Anything matched to them *by
   * email* — guest bookings, relay threads — requires it; matching by id does not.
   */
  emailVerified: boolean;
  /** See business-account.ts. */
  isBusinessAccount: boolean;
  canCreateBusiness: boolean;
  /**
   * When a site admin is acting as this user, the admin's real id.
   * The audit interceptor records it as actorUserId.
   */
  actorUserId: string | null;
}

/** Access-token claims. `act` is present only on impersonation tokens. */
export interface AccessTokenPayload {
  sub: string;
  act?: string;
  type: 'access';
}

export const REFRESH_COOKIE = 'reserivo_rt';
export const REFRESH_COOKIE_PATH = '/auth';
