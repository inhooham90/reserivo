import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import type { AuthResponse, CurrentUser, LoginInput, RegisterInput } from '@reserivo/shared';
import { createHash, randomBytes } from 'node:crypto';
import { siteAdminEmails, type Env } from '../config/env.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AccessTokenPayload, AuthenticatedUser } from './auth.types.js';
import { businessFlags } from './business-account.js';
import { TOKEN_TTL_MINUTES, UserTokensService } from './user-tokens.service.js';

export interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

export interface IssuedTokens extends AuthResponse {
  refreshToken: string;
  refreshExpiresAt: Date;
}

type UserRow = {
  id: string;
  email: string;
  name: string;
  isSiteAdmin: boolean;
  emailVerifiedAt: Date | null;
  businessApprovedAt: Date | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly tokens: UserTokensService,
    private readonly notifications: NotificationsService,
  ) {}

  async register(input: RegisterInput, meta: RequestMeta): Promise<IssuedTokens> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) throw new ConflictException('An account with that email already exists');

    const passwordHash = await hash(input.password);
    // Configured operators hold site admin from their first login, so a fresh
    // database needs no manual step. emailSchema has already lowercased this.
    const isSiteAdmin = siteAdminEmails(this.config.get('SITE_ADMIN_EMAILS')).includes(input.email);

    const user = await this.prisma.user.create({
      data: { email: input.email, name: input.name, passwordHash, isSiteAdmin },
    });
    // Nothing is claimed by email here: signing up proves nothing about the
    // address. Guest bookings are linked once the address is confirmed.
    await this.sendVerification(user);
    return this.issueTokens(await this.toCurrentUser(user), meta);
  }

  async login(input: LoginInput, meta: RequestMeta): Promise<IssuedTokens> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Same error either way so the response does not reveal which emails exist.
    if (!user?.passwordHash || !(await verify(user.passwordHash, input.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueTokens(await this.toCurrentUser(user), meta);
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
    return this.issueTokens(await this.toCurrentUser(stored.user), meta);
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

  // ---------- Email verification ----------

  /** Re-sends the link. Silent when the address is already confirmed. */
  async requestVerification(user: AuthenticatedUser): Promise<void> {
    if (user.emailVerified) return;
    const row = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (row) await this.sendVerification(row);
  }

  /**
   * Confirms the address and links any guest records that used it — the first
   * moment we have evidence they belong to this person. Signs them in, since
   * following the link already proves control of the inbox.
   */
  async verifyEmail(token: string, meta: RequestMeta): Promise<IssuedTokens> {
    const userId = await this.tokens.consume(token, 'EMAIL_VERIFICATION');
    if (!userId) throw new BadRequestException('That confirmation link is invalid or has expired.');

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
      await tx.customer.updateMany({ where: { email: updated.email, userId: null }, data: { userId: updated.id } });
      return updated;
    });
    return this.issueTokens(await this.toCurrentUser(user), meta);
  }

  // ---------- Password reset ----------

  /**
   * Always succeeds from the caller's point of view: telling someone whether
   * an address has an account is an enumeration oracle.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) return;

    const token = await this.tokens.issue(user.id, 'PASSWORD_RESET');
    this.notifications.emit({
      type: 'auth.password_reset',
      to: { email: user.email, name: user.name },
      data: {
        link: `${this.config.get('WEB_URL')}/reset-password?token=${token}`,
        expiresInMinutes: TOKEN_TTL_MINUTES.PASSWORD_RESET,
      },
    });
  }

  /**
   * Sets the new password and signs every other session out — a reset is the
   * remedy for a compromised account, so stale refresh tokens must not survive.
   * Reaching the link also proves the address, so it counts as verification.
   */
  async resetPassword(token: string, password: string, meta: RequestMeta): Promise<IssuedTokens> {
    const userId = await this.tokens.consume(token, 'PASSWORD_RESET');
    if (!userId) throw new BadRequestException('That reset link is invalid or has expired.');

    const passwordHash = await hash(password);
    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { passwordHash, emailVerifiedAt: { set: new Date() } },
      });
      await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.customer.updateMany({ where: { email: updated.email, userId: null }, data: { userId: updated.id } });
      return updated;
    });
    return this.issueTokens(await this.toCurrentUser(user), meta);
  }

  /**
   * An access token that acts as `targetId` on behalf of `actorId`.
   * Deliberately no refresh token: impersonation expires with the access
   * token, and the admin's own refresh cookie is what brings them back.
   */
  impersonationToken(targetId: string, actorId: string): Promise<string> {
    const payload: AccessTokenPayload = { sub: targetId, act: actorId, type: 'access' };
    return this.jwt.signAsync(payload);
  }

  // ---------- Internals ----------

  private async sendVerification(user: { id: string; email: string; name: string }): Promise<void> {
    const token = await this.tokens.issue(user.id, 'EMAIL_VERIFICATION');
    this.notifications.emit({
      type: 'auth.verify_email',
      to: { email: user.email, name: user.name },
      data: {
        link: `${this.config.get('WEB_URL')}/verify-email?token=${token}`,
        expiresInMinutes: TOKEN_TTL_MINUTES.EMAIL_VERIFICATION,
      },
    });
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

  private async toCurrentUser(user: UserRow): Promise<CurrentUser> {
    const memberships = await this.prisma.salonMembership.count({ where: { userId: user.id, status: 'ACTIVE' } });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isSiteAdmin: user.isSiteAdmin,
      emailVerified: user.emailVerifiedAt !== null,
      ...businessFlags({ ...user, _count: { memberships } }),
      actorUserId: null,
    };
  }
}
