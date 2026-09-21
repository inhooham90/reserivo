import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import type { AuthResponse, CurrentUser, LoginInput, RegisterInput } from '@reserivo/shared';
import { createHash, randomBytes } from 'node:crypto';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AccessTokenPayload, AuthenticatedUser } from './auth.types.js';

export interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

export interface IssuedTokens extends AuthResponse {
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async register(input: RegisterInput, meta: RequestMeta): Promise<IssuedTokens> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) throw new ConflictException('An account with that email already exists');

    const user = await this.prisma.user.create({
      data: { email: input.email, name: input.name, passwordHash: await hash(input.password) },
    });
    return this.issueTokens(this.toCurrentUser(user), meta);
  }

  async login(input: LoginInput, meta: RequestMeta): Promise<IssuedTokens> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Same error either way so the response does not reveal which emails exist.
    if (!user?.passwordHash || !(await verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueTokens(this.toCurrentUser(user), meta);
  }

  /** Rotates the refresh token: the presented one is revoked and a new one issued. */
  async refresh(rawToken: string | undefined, meta: RequestMeta): Promise<IssuedTokens> {
    if (!rawToken) throw new UnauthorizedException();

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hashToken(rawToken) },
      include: { user: true },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException();
    }

    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(this.toCurrentUser(stored.user), meta);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  me(user: AuthenticatedUser): CurrentUser {
    return user;
  }

  private async issueTokens(user: CurrentUser, meta: RequestMeta): Promise<IssuedTokens> {
    const payload: AccessTokenPayload = { sub: user.id, type: 'access' };
    if (user.actorUserId) payload.act = user.actorUserId;
    const accessToken = await this.jwt.signAsync(payload);

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + this.config.get('REFRESH_TTL_DAYS') * 86_400_000);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
        userAgent: meta.userAgent,
        ip: meta.ip,
      },
    });

    return { accessToken, user, refreshToken, refreshExpiresAt };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toCurrentUser(user: { id: string; email: string; name: string; isSiteAdmin: boolean }): CurrentUser {
    return { id: user.id, email: user.email, name: user.name, isSiteAdmin: user.isSiteAdmin, actorUserId: null };
  }
}
