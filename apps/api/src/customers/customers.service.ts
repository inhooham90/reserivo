import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BLOCKING_STATUSES, type CreateCustomerInput, type Customer, type CustomerDetail, type CustomersQuery, type UpdateCustomerInput } from '@reserivo/shared';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { isManager } from '../tenancy/access.js';
import type { TenantContext } from '../tenancy/tenant.types.js';

type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  tags: string[];
  userId: string | null;
  smsConsentAt: Date | null;
  createdAt: Date;
};

const CONTACT_FIELDS = ['name', 'email', 'phone'] as const;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds or creates the salon's record for whoever is booking online.
   * Signed-in users are matched by account; guests by email within the salon.
   * Details supplied at booking time refresh the record.
   */
  async resolveForBooking(
    salonId: string,
    user: AuthenticatedUser | null,
    details: { name: string; email: string; phone?: string; smsConsent?: boolean },
  ): Promise<CustomerRow> {
    // Consent is only recorded when explicitly given, and withdrawing it here
    // takes effect immediately — the TCPA treats an opt-out as binding.
    const smsConsentAt = details.smsConsent === undefined ? undefined : details.smsConsent ? new Date() : null;

    if (user) {
      return this.prisma.customer.upsert({
        where: { salonId_userId: { salonId, userId: user.id } },
        update: { name: details.name, email: user.email, phone: details.phone ?? undefined, smsConsentAt },
        create: { salonId, userId: user.id, name: details.name, email: user.email, phone: details.phone, smsConsentAt },
      });
    }

    const existing = await this.prisma.customer.findFirst({ where: { salonId, email: details.email, userId: null } });
    if (existing) {
      return this.prisma.customer.update({
        where: { id: existing.id },
        data: { name: details.name, phone: details.phone ?? existing.phone, smsConsentAt },
      });
    }
    const { smsConsent: _consent, ...fields } = details;
    return this.prisma.customer.create({ data: { salonId, ...fields, smsConsentAt } });
  }

  async search(tenant: TenantContext, query: CustomersQuery): Promise<Customer[]> {
    const q = query.q?.trim();
    const rows = await this.prisma.customer.findMany({
      where: {
        salonId: tenant.salonId,
        ...(query.tag ? { tags: { has: query.tag } } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: query.limit,
    });
    return rows.map((r) => this.toCustomer(r, isManager(tenant)));
  }

  /** The record plus the relationship: visit stats and history. Designers see names, not contact fields. */
  async detail(tenant: TenantContext, id: string): Promise<CustomerDetail> {
    const row = await this.findInSalon(tenant.salonId, id);
    const appts = await this.prisma.appointment.findMany({
      where: { customerId: id },
      orderBy: { startAt: 'desc' },
      take: 100,
      select: {
        id: true,
        startAt: true,
        status: true,
        serviceNameSnapshot: true,
        priceCentsSnapshot: true,
        designerId: true,
        designer: { select: { displayName: true } },
      },
    });

    const now = Date.now();
    const completed = appts.filter((a) => a.status === 'COMPLETED');
    const past = appts.filter((a) => a.startAt.getTime() < now);
    return {
      ...this.toCustomer(row, isManager(tenant)),
      stats: {
        visits: completed.length,
        noShows: appts.filter((a) => a.status === 'NO_SHOW').length,
        cancellations: appts.filter((a) => a.status === 'CANCELLED').length,
        upcoming: appts.filter((a) => a.startAt.getTime() >= now && BLOCKING_STATUSES.includes(a.status)).length,
        spentCents: completed.reduce((sum, a) => sum + a.priceCentsSnapshot, 0),
        firstVisitAt: completed.at(-1)?.startAt.toISOString() ?? null,
        lastVisitAt: past.find((a) => a.status === 'COMPLETED')?.startAt.toISOString() ?? null,
      },
      history: appts.map((a) => ({
        id: a.id,
        startAt: a.startAt.toISOString(),
        status: a.status,
        serviceName: a.serviceNameSnapshot,
        priceCents: a.priceCentsSnapshot,
        designerId: a.designerId,
        designerName: a.designer.displayName,
      })),
    };
  }

  /** Managers may change anything; designers only notes and tags. */
  async update(tenant: TenantContext, id: string, input: UpdateCustomerInput): Promise<Customer> {
    await this.findInSalon(tenant.salonId, id);
    if (!isManager(tenant) && CONTACT_FIELDS.some((f) => input[f] !== undefined)) {
      throw new ForbiddenException('Only managers can edit a customer’s name or contact details');
    }
    const row = await this.prisma.customer.update({ where: { id }, data: input });
    return this.toCustomer(row, isManager(tenant));
  }

  /** Staff-created record. An exact email match returns the existing customer instead of a duplicate. */
  async create(tenant: TenantContext, input: CreateCustomerInput): Promise<Customer> {
    if (input.email) {
      const dup = await this.prisma.customer.findFirst({ where: { salonId: tenant.salonId, email: input.email } });
      if (dup) return this.toCustomer(dup, isManager(tenant));
    }
    const row = await this.prisma.customer.create({ data: { salonId: tenant.salonId, ...input } });
    return this.toCustomer(row, isManager(tenant));
  }

  async findInSalon(salonId: string, id: string): Promise<CustomerRow> {
    const row = await this.prisma.customer.findFirst({ where: { id, salonId } });
    if (!row) throw new NotFoundException('Customer not found');
    return row;
  }

  /** Notes and tags are the salon's shared knowledge and every staff member sees them; contact fields are managers-only. */
  toCustomer(r: CustomerRow, includeContact: boolean): Customer {
    return {
      id: r.id,
      name: r.name,
      hasAccount: r.userId !== null,
      notes: r.notes,
      tags: r.tags,
      createdAt: r.createdAt.toISOString(),
      ...(includeContact ? { email: r.email, phone: r.phone } : {}),
    };
  }
}
