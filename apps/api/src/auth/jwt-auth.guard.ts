import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_OPTIONAL_AUTH_KEY } from '../common/decorators/optional-auth.decorator.js';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator.js';
import type { AuthenticatedUser } from './auth.types.js';

/**
 * Registered globally; every route requires a bearer token unless marked
 * @Public() (never authenticates) or @OptionalAuth() (authenticates when it can).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (this.flag(IS_PUBLIC_KEY, context)) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser = AuthenticatedUser>(err: unknown, user: TUser | false, _info: unknown, context: ExecutionContext): TUser {
    if (this.flag(IS_OPTIONAL_AUTH_KEY, context)) {
      // Missing or bad token → anonymous, not an error.
      return (user || null) as TUser;
    }
    if (err || !user) throw err instanceof Error ? err : new UnauthorizedException();
    return user;
  }

  private flag(key: string, context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(key, [context.getHandler(), context.getClass()]) === true;
  }
}
