import { SetMetadata } from '@nestjs/common';

export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';
/**
 * The route works for anonymous callers, but if a valid bearer token is
 * present req.user is populated. Used by public booking so a signed-in
 * customer's appointment links to their account.
 */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
