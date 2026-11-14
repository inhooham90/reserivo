import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CustomerConversation,
  Message,
  StaffConversation,
  StaffStartConversationInput,
  StartConversationInput,
  Thread,
  UnreadCounts,
} from '@reserivo/shared';
import { ownedBy } from '../appointments/appointments.service.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { Env } from '../config/env.js';
import { CustomersService } from '../customers/customers.service.js';
import { LiveEventsService } from './live-events.service.js';
import { MembersService } from '../members/members.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertCanManageMember, isManager } from '../tenancy/access.js';
import type { TenantContext } from '../tenancy/tenant.types.js';

type ConvRow = {
  id: string;
  salonId: string;
  customerId: string;
  designerId: string;
  lastMessageAt: Date | null;
  customerLastReadAt: Date | null;
  staffLastReadAt: Date | null;
  salon: { id: string; name: string; slug: string };
  customer: { id: string; name: string; email: string | null; userId: string | null };
  designer: { id: string; displayName: string; photoUrl: string | null; userId: string; user: { email: string } };
};

/** How long a message may sit unread before its recipient gets an email about it. */
export const MESSAGE_NUDGE_DELAY_MIN = 5;

const CONV_INCLUDE = {
  salon: { select: { id: true, name: true, slug: true } },
  customer: { select: { id: true, name: true, email: true, userId: true } },
  designer: { select: { id: true, displayName: true, photoUrl: true, userId: true, user: { select: { email: true } } } },
} as const;

/**
 * The relay. Customers and designers talk through threads that show display
 * names only. Managers may write in any thread of their salon; the customer
 * sees the designer's name, the staff view shows who really wrote it.
 */
@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MembersService,
    private readonly customers: CustomersService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService<Env, true>,
    private readonly live: LiveEventsService,
  ) {}

  // ---------- Customer side ----------

  async listMine(user: AuthenticatedUser): Promise<CustomerConversation[]> {
    const rows = await this.prisma.conversation.findMany({
      where: { customer: this.ownedBy(user) },
      include: { ...CONV_INCLUDE, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    });
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        salon: r.salon,
        designer: { id: r.designer.id, displayName: r.designer.displayName, photoUrl: r.designer.photoUrl },
        lastMessage: this.lastOf(r.messages),
        unread: await this.unreadFor(r.id, 'STAFF', r.customerLastReadAt),
      })),
    );
  }

  /**
   * A customer may only open a thread with a designer at a salon that already
   * has them on record — i.e. they have booked there. Keeps the relay from
   * becoming a cold-outreach channel.
   */
  async startMine(user: AuthenticatedUser, input: StartConversationInput): Promise<Thread> {
    const customer = await this.prisma.customer.findFirst({ where: { salonId: input.salonId, ...this.ownedBy(user) } });
    if (!customer) throw new ForbiddenException('You can message a business once you have booked with them.');
    if (!customer.userId) await this.prisma.customer.update({ where: { id: customer.id }, data: { userId: user.id } });

    await this.members.findDesigner(input.salonId, input.designerId);
    const conv = await this.upsertConversation(customer.id, input.designerId, input.salonId);
    if (input.body) await this.postCustomerMessage(conv, user, input.body);
    return this.threadMine(user, conv.id);
  }

  async threadMine(user: AuthenticatedUser, conversationId: string): Promise<Thread> {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, customer: this.ownedBy(user) },
      include: CONV_INCLUDE,
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    await this.prisma.conversation.update({ where: { id: conv.id }, data: { customerLastReadAt: new Date() } });
    const messages = await this.prisma.message.findMany({ where: { conversationId: conv.id }, orderBy: { createdAt: 'asc' } });
    return {
      conversationId: conv.id,
      // The customer view never learns who on staff actually typed a message.
      messages: messages.map((m) => ({
        id: m.id,
        sender: m.sender,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        fromName: m.sender === 'CUSTOMER' ? conv.customer.name : conv.designer.displayName,
      })),
    };
  }

  async sendMine(user: AuthenticatedUser, conversationId: string, body: string): Promise<Message> {
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, customer: this.ownedBy(user) },
      include: CONV_INCLUDE,
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    return this.postCustomerMessage(conv, user, body);
  }

  // ---------- Staff side ----------

  /** Designers see their own threads; managers see the whole salon's, optionally filtered. */
  async listStaff(tenant: TenantContext, designerId?: string): Promise<StaffConversation[]> {
    const scope = isManager(tenant) ? designerId : tenant.membership!.id;
    const rows = await this.prisma.conversation.findMany({
      where: { salonId: tenant.salonId, ...(scope ? { designerId: scope } : {}) },
      include: { ...CONV_INCLUDE, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    });
    return Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        customer: { id: r.customer.id, name: r.customer.name },
        designer: { id: r.designer.id, displayName: r.designer.displayName },
        lastMessage: this.lastOf(r.messages),
        unread: await this.unreadFor(r.id, 'CUSTOMER', r.staffLastReadAt),
      })),
    );
  }

  /** Staff may open a thread with a customer who has an account; guests cannot be reached through the relay. */
  async startStaff(tenant: TenantContext, input: StaffStartConversationInput, user: AuthenticatedUser): Promise<Thread> {
    const designerId = input.designerId ?? tenant.membership?.id;
    if (!designerId) throw new ConflictException('Choose which team member this conversation belongs to');
    assertCanManageMember(tenant, designerId);
    await this.members.findDesigner(tenant.salonId, designerId);

    const customer = await this.customers.findInSalon(tenant.salonId, input.customerId);
    if (!customer.userId) {
      throw new ConflictException(`${customer.name} has no Morrri account yet, so the relay cannot reach them.`);
    }

    const conv = await this.upsertConversation(customer.id, designerId, tenant.salonId);
    if (input.body) await this.postStaffMessage(conv, user, input.body);
    return this.threadStaff(tenant, conv.id, user);
  }

  async threadStaff(tenant: TenantContext, conversationId: string, user: AuthenticatedUser): Promise<Thread> {
    const conv = await this.staffConversation(tenant, conversationId);
    await this.prisma.conversation.update({ where: { id: conv.id }, data: { staffLastReadAt: new Date() } });
    const messages = await this.prisma.message.findMany({ where: { conversationId: conv.id }, orderBy: { createdAt: 'asc' } });

    // Resolve who really wrote each staff message, so a manager's words are attributed internally.
    const actorIds = Array.from(new Set(messages.map((m) => m.actorUserId).filter((x): x is string => Boolean(x))));
    const actors = actorIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
      : [];
    const nameOf = new Map(actors.map((a) => [a.id, a.name]));

    return {
      conversationId: conv.id,
      messages: messages.map((m) => ({
        id: m.id,
        sender: m.sender,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        fromName: m.sender === 'CUSTOMER' ? conv.customer.name : conv.designer.displayName,
        ...(m.sender === 'STAFF' && m.actorUserId && m.actorUserId !== conv.designer.userId
          ? { writtenBy: nameOf.get(m.actorUserId) ?? 'a manager' }
          : {}),
        mine: m.sender === 'STAFF' && m.actorUserId === user.id,
      })),
    };
  }

  async sendStaff(tenant: TenantContext, conversationId: string, body: string, user: AuthenticatedUser): Promise<Message> {
    const conv = await this.staffConversation(tenant, conversationId);
    return this.postStaffMessage(conv, user, body);
  }

  // ---------- Internals ----------

  /**
   * Ownership by account, or by a *confirmed* email (guest bookings made
   * before signing up). An unconfirmed address proves nothing, so it never
   * grants access to someone else's conversations.
   */
  private ownedBy(user: AuthenticatedUser) {
    return ownedBy(user);
  }

  private async staffConversation(tenant: TenantContext, conversationId: string): Promise<ConvRow> {
    const conv = await this.prisma.conversation.findFirst({ where: { id: conversationId, salonId: tenant.salonId }, include: CONV_INCLUDE });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (!isManager(tenant) && conv.designerId !== tenant.membership?.id) {
      throw new ForbiddenException('This conversation belongs to another team member');
    }
    return conv;
  }

  private upsertConversation(customerId: string, designerId: string, salonId: string): Promise<ConvRow> {
    return this.prisma.conversation.upsert({
      where: { customerId_designerId: { customerId, designerId } },
      update: {},
      create: { customerId, designerId, salonId },
      include: CONV_INCLUDE,
    });
  }

  private async postCustomerMessage(conv: ConvRow, user: AuthenticatedUser, body: string): Promise<Message> {
    const now = new Date();
    const [m] = await this.prisma.$transaction([
      this.prisma.message.create({ data: { conversationId: conv.id, sender: 'CUSTOMER', body, actorUserId: user.id } }),
      this.prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: now, customerLastReadAt: now } }),
    ]);
    await this.announce(conv);
    return { id: m.id, sender: 'CUSTOMER', body: m.body, createdAt: m.createdAt.toISOString(), fromName: conv.customer.name };
  }

  private async postStaffMessage(conv: ConvRow, user: AuthenticatedUser, body: string): Promise<Message> {
    const now = new Date();
    const [m] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId: conv.id, sender: 'STAFF', body, actorUserId: user.id, sentAsMembershipId: conv.designerId },
      }),
      this.prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: now, staffLastReadAt: now } }),
    ]);
    await this.announce(conv);
    return {
      id: m.id,
      sender: 'STAFF',
      body: m.body,
      createdAt: m.createdAt.toISOString(),
      fromName: conv.designer.displayName,
      ...(user.id !== conv.designer.userId ? { writtenBy: user.name } : {}),
      mine: true,
    };
  }

  // ---------- Live updates, unread counts and email nudges ----------

  /**
   * Tells every open tab that can see this conversation to refetch: the
   * client side (their account) and the staff side (the team member it
   * belongs to, plus the business's managers, who see the whole inbox). Ids
   * only; see LiveEvent. Email is not sent here but by `sweepNudges`, once a
   * message has sat unread for a while.
   */
  private async announce(conv: ConvRow): Promise<void> {
    const managers = await this.prisma.salonMembership.findMany({
      where: { salonId: conv.salonId, status: 'ACTIVE', roles: { has: 'MANAGER' } },
      select: { userId: true },
    });
    this.live.publish([conv.designer.userId, ...managers.map((m) => m.userId)], {
      type: 'message',
      conversationId: conv.id,
      salonId: conv.salonId,
    });
    this.live.publish([conv.customer.userId], { type: 'message', conversationId: conv.id });
  }

  /** The header badges: the person's own inbox, and each business they work at, scoped like its inbox. */
  async unreadCounts(user: AuthenticatedUser): Promise<UnreadCounts> {
    const [customers, memberships] = await Promise.all([
      this.prisma.customer.findMany({ where: this.ownedBy(user), select: { id: true } }),
      this.prisma.salonMembership.findMany({
        where: { userId: user.id, status: 'ACTIVE' },
        select: { id: true, salonId: true, roles: true },
      }),
    ]);
    const customerIds = customers.map((c) => c.id);
    const managedSalons = memberships.filter((m) => m.roles.includes('MANAGER')).map((m) => m.salonId);
    const ownThreads = memberships.filter((m) => !m.roles.includes('MANAGER')).map((m) => m.id);

    const [personal, staff] = await Promise.all([
      customerIds.length
        ? this.prisma.$queryRaw<{ n: bigint }[]>`
            SELECT count(*) AS n FROM conversations c
            JOIN messages m ON m."conversationId" = c.id AND m.sender = 'STAFF'
              AND m."createdAt" > COALESCE(c."customerLastReadAt", '-infinity'::timestamptz)
            WHERE c."customerId" = ANY(${customerIds}::uuid[])`
        : Promise.resolve([{ n: 0n }]),
      memberships.length
        ? this.prisma.$queryRaw<{ salonId: string; n: bigint }[]>`
            SELECT c."salonId", count(*) AS n FROM conversations c
            JOIN messages m ON m."conversationId" = c.id AND m.sender = 'CUSTOMER'
              AND m."createdAt" > COALESCE(c."staffLastReadAt", '-infinity'::timestamptz)
            WHERE c."salonId" = ANY(${managedSalons}::uuid[]) OR c."designerId" = ANY(${ownThreads}::uuid[])
            GROUP BY c."salonId"`
        : Promise.resolve([] as { salonId: string; n: bigint }[]),
    ]);
    const salons: Record<string, number> = Object.fromEntries(memberships.map((m) => [m.salonId, 0]));
    for (const row of staff) salons[row.salonId] = Number(row.n);
    return { personal: Number(personal[0]?.n ?? 0), salons };
  }

  /**
   * Emails whoever has left a message unread for `delayMin` minutes: one email
   * per unread streak, not one per message, so a back-and-forth on screen
   * sends nothing and a burst of five messages sends one nudge. The next
   * streak starts once they have read the conversation.
   *
   * The UPDATE ... RETURNING is the claim: two instances sweeping at once
   * cannot both mark the same row, so nobody is emailed twice. `now` is a
   * parameter so tests can move the clock. Only the last week is considered,
   * so a quiet old thread is never dug up.
   */
  async sweepNudges(now = new Date(), delayMin = MESSAGE_NUDGE_DELAY_MIN): Promise<number> {
    const due = new Date(now.getTime() - delayMin * 60_000);
    const since = new Date(now.getTime() - 7 * 24 * 3_600_000);
    const [toStaff, toCustomers] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>`
        UPDATE conversations c SET "staffNotifiedAt" = ${now}
        WHERE c."lastMessageAt" > ${since}
          AND (c."staffNotifiedAt" IS NULL OR c."staffNotifiedAt" < COALESCE(c."staffLastReadAt", '-infinity'::timestamptz))
          AND EXISTS (
            SELECT 1 FROM messages m WHERE m."conversationId" = c.id AND m.sender = 'CUSTOMER'
              AND m."createdAt" > COALESCE(c."staffLastReadAt", '-infinity'::timestamptz)
              AND m."createdAt" <= ${due})
        RETURNING c.id`,
      this.prisma.$queryRaw<{ id: string }[]>`
        UPDATE conversations c SET "customerNotifiedAt" = ${now}
        WHERE c."lastMessageAt" > ${since}
          AND (c."customerNotifiedAt" IS NULL OR c."customerNotifiedAt" < COALESCE(c."customerLastReadAt", '-infinity'::timestamptz))
          AND EXISTS (
            SELECT 1 FROM messages m WHERE m."conversationId" = c.id AND m.sender = 'STAFF'
              AND m."createdAt" > COALESCE(c."customerLastReadAt", '-infinity'::timestamptz)
              AND m."createdAt" <= ${due})
        RETURNING c.id`,
    ]);

    const ids = [...new Set([...toStaff, ...toCustomers].map((r) => r.id))];
    if (!ids.length) return 0;
    const convs = new Map(
      (await this.prisma.conversation.findMany({ where: { id: { in: ids } }, include: CONV_INCLUDE })).map((c) => [c.id, c]),
    );
    const web = this.config.get('WEB_URL');
    for (const { id } of toStaff) {
      const conv = convs.get(id);
      if (!conv) continue;
      // The team member is told a message is waiting: never the customer's contact details, never the text.
      this.notifications.emit({
        type: 'message.received',
        to: { email: conv.designer.user.email, name: conv.designer.displayName },
        data: {
          conversationId: conv.id,
          fromName: conv.customer.name,
          salonName: conv.salon.name,
          link: `${web}/s/${conv.salonId}/messages?c=${conv.id}`,
        },
      });
    }
    for (const { id } of toCustomers) {
      const conv = convs.get(id);
      if (!conv) continue;
      this.notifications.emit({
        type: 'message.received',
        to: { email: conv.customer.email, name: conv.customer.name },
        data: {
          conversationId: conv.id,
          fromName: conv.designer.displayName,
          salonName: conv.salon.name,
          link: `${web}/messages/${conv.id}`,
        },
      });
    }
    return toStaff.length + toCustomers.length;
  }

  private lastOf(messages: { body: string; sender: 'CUSTOMER' | 'STAFF'; createdAt: Date }[]) {
    const m = messages[0];
    return m ? { body: m.body, sender: m.sender, createdAt: m.createdAt.toISOString() } : null;
  }

  /** Messages from the other side newer than the reader's last-read mark. */
  private unreadFor(conversationId: string, from: 'CUSTOMER' | 'STAFF', lastReadAt: Date | null): Promise<number> {
    return this.prisma.message.count({
      where: { conversationId, sender: from, ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}) },
    });
  }
}
