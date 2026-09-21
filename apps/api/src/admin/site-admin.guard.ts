import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types.js';

/**
 * Site-admin only. Also refuses while impersonating: an admin who is acting as
 * someone else must not be able to reach admin tools through that identity,
 * even in the unlikely case that the person they are acting as is an admin too.
 */
@Injectable()
export class SiteAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    // Checked first so an impersonating admin gets the message they can act on.
    // Only an admin can hold a token with `act` set, so this leaks nothing.
    if (user?.actorUserId) throw new ForbiddenException('Stop acting as another user first');
    if (!user?.isSiteAdmin) throw new ForbiddenException('Site admins only');
    return true;
  }
}
