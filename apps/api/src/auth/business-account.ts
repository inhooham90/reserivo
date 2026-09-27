/**
 * Business accounts versus personal ones, decided in one place.
 *
 * A site admin approves an account (`User.businessApprovedAt`); only approved
 * accounts, and site admins, may create a business. Separately, belonging to
 * a business (an ACTIVE membership) makes an account a business account with
 * no approval, so a manager never has to wait on us for each person they
 * invite. Losing the last membership turns an unapproved account back into a
 * personal one.
 *
 * Spread `businessAccountSelect` into any user query whose row reaches
 * `businessFlags`.
 */
export const businessAccountSelect = {
  businessApprovedAt: true,
  _count: { select: { memberships: { where: { status: 'ACTIVE' as const } } } },
} as const;

export function businessFlags(user: {
  isSiteAdmin: boolean;
  businessApprovedAt: Date | null;
  _count: { memberships: number };
}): { isBusinessAccount: boolean; canCreateBusiness: boolean } {
  const approved = user.businessApprovedAt !== null;
  return {
    isBusinessAccount: approved || user._count.memberships > 0,
    canCreateBusiness: approved || user.isSiteAdmin,
  };
}
