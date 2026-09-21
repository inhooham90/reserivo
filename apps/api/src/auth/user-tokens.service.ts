import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { TokenPurpose } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const TOKEN_TTL_MINUTES: Record<TokenPurpose, number> = {
  EMAIL_VERIFICATION: 24 * 60,
  // Short by design: a reset link sitting in an inbox is a standing key to the account.
  PASSWORD_RESET: 60,
};

/**
 * Single-use links for verification and password reset. Same shape as
 * invitations: a high-entropy value goes in the email, only its SHA-256 is
 * stored, and issuing a new one retires any outstanding link.
 */
@Injectable()
export class UserTokensService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the raw token — the only moment it exists outside the email. */
  async issue(userId: string, purpose: TokenPurpose): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();

    await this.prisma.$transaction([
      // One live link per purpose: requesting a new one invalidates the old.
      this.prisma.userToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: now } }),
      this.prisma.userToken.create({
        data: {
          userId,
          purpose,
          tokenHash: this.hash(token),
          expiresAt: new Date(now.getTime() + TOKEN_TTL_MINUTES[purpose] * 60_000),
        },
      }),
    ]);
    return token;
  }

  /**
   * Burns the token and returns the user id, or null when it is unknown,
   * already used, or expired. Consuming is atomic, so a link cannot be
   * redeemed twice by two concurrent requests.
   */
  async consume(token: string, purpose: TokenPurpose): Promise<string | null> {
    const row = await this.prisma.userToken.findUnique({ where: { tokenHash: this.hash(token) } });
    if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt < new Date()) return null;

    const { count } = await this.prisma.userToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return count === 1 ? row.userId : null;
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
