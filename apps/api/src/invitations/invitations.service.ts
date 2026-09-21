import { ConflictException, ForbiddenException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AcceptInvitationResponse, CreateInvitationInput, Invitation, InvitationPreview } from '@reserivo/shared';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';

const INVITE_TTL_DAYS = 7;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Issues an invite. Any earlier pending invite for the same email is revoked
   * so a resend simply replaces the old link. Returns the URL exactly once.
   */
  async create(salonId: string, input: CreateInvitationInput, inviter: AuthenticatedUser): Promise<Invitation> {
    const existingMember = await this.prisma.salonMembership.findFirst({
      where: { salonId, status: 'ACTIVE', user: { email: input.email } },
      select: { id: true },
    });
    if (existingMember) throw new ConflictException('That person is already a member of this salon');

    const token = randomBytes(32).toString('base64url');
    const now = new Date();

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.invitation.updateMany({
        where: { salonId, email: input.email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });
      return tx.invitation.create({
        data: {
          salonId,
          email: input.email,
          role: input.role,
          tokenHash: this.hash(token),
          invitedByUserId: inviter.id,
          expiresAt: new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000),
        },
      });
    });

    return { ...this.toInvitation(created), inviteUrl: `${this.config.get('WEB_URL')}/invite/${token}` };
  }

  async listPending(salonId: string): Promise<Invitation[]> {
    const rows = await this.prisma.invitation.findMany({
      where: { salonId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toInvitation(r));
  }

  async revoke(salonId: string, id: string): Promise<void> {
    const result = await this.prisma.invitation.updateMany({
      where: { id, salonId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException('Invitation not found');
  }

  /** Public: what the invitee sees before deciding. */
  async preview(token: string): Promise<InvitationPreview> {
    const inv = await this.findLive(token);
    return {
      salonName: inv.salon.name,
      salonSlug: inv.salon.slug,
      role: inv.role,
      email: inv.email,
      expiresAt: inv.expiresAt.toISOString(),
    };
  }

  /**
   * The link is the secret, but the invitee's account email must also match
   * so a forwarded link cannot enrol the wrong person.
   */
  async accept(token: string, user: AuthenticatedUser): Promise<AcceptInvitationResponse> {
    const inv = await this.findLive(token);
    if (inv.email !== user.email.toLowerCase()) {
      throw new ForbiddenException(`This invitation was sent to ${inv.email}. Sign in with that email to accept it.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.salonMembership.findUnique({
        where: { salonId_userId: { salonId: inv.salonId, userId: user.id } },
      });

      const membership = existing
        ? await tx.salonMembership.update({
            where: { id: existing.id },
            data: { status: 'ACTIVE', role: inv.role },
          })
        : await tx.salonMembership.create({
            data: { salonId: inv.salonId, userId: user.id, role: inv.role, displayName: user.name },
          });

      await tx.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
      return { salonId: inv.salonId, membershipId: membership.id, role: membership.role };
    });
  }

  private async findLive(token: string) {
    const inv = await this.prisma.invitation.findUnique({
      where: { tokenHash: this.hash(token) },
      include: { salon: { select: { name: true, slug: true } } },
    });
    if (!inv || inv.revokedAt) throw new NotFoundException('Invitation not found');
    if (inv.acceptedAt) throw new GoneException('This invitation has already been used');
    if (inv.expiresAt < new Date()) throw new GoneException('This invitation has expired');
    return inv;
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toInvitation(r: {
    id: string;
    email: string;
    role: 'MANAGER' | 'DESIGNER';
    expiresAt: Date;
    createdAt: Date;
  }): Invitation {
    return {
      id: r.id,
      email: r.email,
      role: r.role,
      expiresAt: r.expiresAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
    };
  }
}
