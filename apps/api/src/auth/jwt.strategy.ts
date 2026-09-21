import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AccessTokenPayload, AuthenticatedUser } from './auth.types.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_ACCESS_SECRET'),
      ignoreExpiration: false,
    });
  }

  /** Runs on every authenticated request. Hits the DB so deleted users drop out immediately. */
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') throw new UnauthorizedException();

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, isSiteAdmin: true, emailVerifiedAt: true },
    });
    if (!user) throw new UnauthorizedException();

    if (payload.act) {
      const actor = await this.prisma.user.findUnique({
        where: { id: payload.act },
        select: { isSiteAdmin: true },
      });
      // An impersonation token from someone who is no longer admin is dead.
      if (!actor?.isSiteAdmin) throw new UnauthorizedException();
    }

    const { emailVerifiedAt, ...rest } = user;
    return { ...rest, emailVerified: emailVerifiedAt !== null, actorUserId: payload.act ?? null };
  }
}
