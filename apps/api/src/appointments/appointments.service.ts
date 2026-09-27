import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BLOCKING_STATUSES,
  localToUtc,
  completableFrom,
  noShowMarkableFrom,
  NO_SHOW_GRACE_MIN,
  utcToLocal,
  type AvailabilityQuery,
  type AvailabilityResponse,
  type BookAppointmentInput,
  type CustomerAppointment,
  type StaffAppointment,
  type StaffAppointmentsQuery,
  type StaffBookAppointmentInput,
  type UpdateAppointmentInput,
} from '@reserivo/shared';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { SlotsService } from '../availability/slots.service.js';
import { CustomersService } from '../customers/customers.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertCanManageMember, isManager } from '../tenancy/access.js';
import type { TenantContext } from '../tenancy/tenant.types.js';

const DOUBLE_BOOKING_CONSTRAINT = 'appointments_no_double_booking';

/**
 * Which customer records belong to this person. Matching by email requires a
 * confirmed address — otherwise signing up as someone@example.com would hand
 * over that person's guest bookings.
 */
/** Wall-clock time in the salon's zone, for messages staff will read. */
function formatLocalTime(at: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(at);
}

export function ownedBy(user: AuthenticatedUser) {
  return user.emailVerified ? { OR: [{ userId: user.id }, { email: user.email }] } : { userId: user.id };
}

/** The DB refused an overlapping PENDING/CONFIRMED appointment for the same designer. */
function isDoubleBooking(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes(DOUBLE_BOOKING_CONSTRAINT) || msg.includes('23P01');
}

type ApptRow = {
  id: string;
  salonId: string;
  designerId: string;
  serviceId: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  source: 'ONLINE' | 'STAFF';
  startAt: Date;
  endAt: Date;
  bufferMin: number;
  serviceNameSnapshot: string;
  priceCentsSnapshot: number;
  durationMinSnapshot: number;
  allowsDoubleBooking: boolean;
  paymentMethod: 'CARD' | 'CASH' | 'GIFT_CARD' | 'MOBILE_PAY' | 'OTHER' | null;
  tipCents: number | null;
  notes: string | null;
  internalNotes: string | null;
  cancelReason: string | null;
  createdAt: Date;
  customer: { id: string; name: string; email: string | null; phone: string | null; userId: string | null };
  designer: { displayName: string };
  salon: { id: string; name: string; slug: string; timezone: string; cancelWindowHours: number };
};

const APPT_INCLUDE = {
  customer: { select: { id: true, name: true, email: true, phone: true, userId: true } },
  designer: { select: { displayName: true } },
  salon: { select: { id: true, name: true, slug: true, timezone: true, cancelWindowHours: true } },
} as const;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slots: SlotsService,
    private readonly customers: CustomersService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------- Public ----------

  async publicAvailability(slug: string, query: AvailabilityQuery): Promise<AvailabilityResponse> {
    const salon = await this.salonBySlug(slug);
    const service = await this.bookableService(salon.id, query.serviceId, query.designerId);
    return this.slots.compute({ salon, designerId: query.designerId, service, from: query.from, days: query.days, mode: 'public' });
  }

  /**
   * Online booking. The requested start must be one of the slots the engine
   * would offer right now — that single check enforces hours, exceptions,
   * lead time, max advance, grid alignment and known conflicts. The DB
   * constraint then catches anything that slipped in concurrently.
   */
  async bookPublic(slug: string, input: BookAppointmentInput, user: AuthenticatedUser | null): Promise<CustomerAppointment> {
    const salon = await this.salonBySlug(slug);
    const service = await this.bookableService(salon.id, input.serviceId, input.designerId);
    const startAt = new Date(input.startAt);
    const local = utcToLocal(startAt, salon.timezone);

    const offered = await this.slots.compute({
      salon,
      designerId: input.designerId,
      service,
      from: local.date,
      days: 1,
      mode: 'public',
    });
    const iso = startAt.toISOString();
    if (!offered.days[0]?.slots.some((s) => s.startAt === iso)) {
      throw new ConflictException('That time is no longer available. Please pick another slot.');
    }

    const customer = await this.customers.resolveForBooking(salon.id, user, input.customer);
    const row = await this.insert({
      salonId: salon.id,
      designerId: input.designerId,
      customerId: customer.id,
      service,
      startAt,
      source: 'ONLINE',
      notes: input.notes ?? null,
      createdByUserId: user?.id ?? null,
    });

    this.notify('appointment.booked', row);
    return this.toCustomerView(row);
  }

  // ---------- Customer (signed in) ----------

  /** Bookings made with this account, plus guest bookings on a *confirmed* address. */
  async listMine(user: AuthenticatedUser): Promise<CustomerAppointment[]> {
    const rows = await this.prisma.appointment.findMany({
      where: { customer: ownedBy(user) },
      include: APPT_INCLUDE,
      orderBy: { startAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => this.toCustomerView(r));
  }

  async cancelMine(user: AuthenticatedUser, id: string): Promise<CustomerAppointment> {
    const row = await this.prisma.appointment.findFirst({
      where: { id, customer: ownedBy(user) },
      include: APPT_INCLUDE,
    });
    if (!row) throw new NotFoundException('Appointment not found');
    if (!BLOCKING_STATUSES.includes(row.status)) throw new ConflictException('This appointment cannot be cancelled');

    const until = this.cancellableUntil(row);
    if (!until || until < new Date()) {
      throw new ConflictException(
        `Online cancellation closes ${row.salon.cancelWindowHours} hours before the appointment. Please contact the business.`,
      );
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledByUserId: user.id, cancelReason: 'Cancelled by customer' },
      include: APPT_INCLUDE,
    });
    this.notify('appointment.cancelled', updated);
    return this.toCustomerView(updated);
  }

  // ---------- Staff ----------

  async staffAvailability(tenant: TenantContext, query: AvailabilityQuery): Promise<AvailabilityResponse> {
    const salon = await this.salonById(tenant.salonId);
    const service = await this.serviceInSalon(salon.id, query.serviceId, query.designerId);
    return this.slots.compute({
      salon,
      designerId: query.designerId,
      service,
      from: query.from,
      days: query.days,
      mode: 'staff',
      excludeAppointmentId: query.excludeAppointmentId,
    });
  }

  /** Everyone on the team sees the calendar; only managers see contact fields. */
  async listStaff(tenant: TenantContext, query: StaffAppointmentsQuery): Promise<StaffAppointment[]> {
    const salon = await this.salonById(tenant.salonId);
    const rows = await this.prisma.appointment.findMany({
      where: {
        salonId: tenant.salonId,
        ...(query.designerId ? { designerId: query.designerId } : {}),
        startAt: { gte: localToUtc(query.from, 0, salon.timezone), lt: localToUtc(query.to, 1440, salon.timezone) },
      },
      include: APPT_INCLUDE,
      orderBy: { startAt: 'asc' },
    });
    return rows.map((r) => this.toStaffView(r, isManager(tenant)));
  }

  /**
   * Book on behalf of a customer. Staff are trusted to book outside published
   * hours (walk-ins, favours), so only the double-booking constraint applies.
   */
  async bookStaff(tenant: TenantContext, input: StaffBookAppointmentInput, user: AuthenticatedUser): Promise<StaffAppointment> {
    assertCanManageMember(tenant, input.designerId);
    const service = await this.serviceInSalon(tenant.salonId, input.serviceId, input.designerId);

    const customer = input.customerId
      ? await this.customers.findInSalon(tenant.salonId, input.customerId)
      : await this.customers.create(tenant, input.customer!).then((c) => this.customers.findInSalon(tenant.salonId, c.id));

    const row = await this.insert({
      salonId: tenant.salonId,
      designerId: input.designerId,
      customerId: customer.id,
      service,
      startAt: new Date(input.startAt),
      source: 'STAFF',
      internalNotes: input.internalNotes ?? null,
      createdByUserId: user.id,
    });
    this.notify('appointment.booked', row);
    return this.toStaffView(row, isManager(tenant));
  }

  async updateStaff(
    tenant: TenantContext,
    id: string,
    input: UpdateAppointmentInput,
    user: AuthenticatedUser,
  ): Promise<StaffAppointment> {
    const row = await this.prisma.appointment.findFirst({ where: { id, salonId: tenant.salonId }, include: APPT_INCLUDE });
    if (!row) throw new NotFoundException('Appointment not found');
    assertCanManageMember(tenant, row.designerId);

    const isOpen = BLOCKING_STATUSES.includes(row.status);
    // A no-show is a judgement call made minutes after the fact and staff get it
    // wrong, so it is the one final state that can be walked back. Reverting is
    // status-only; reschedule it afterwards if the time also needs to move.
    const undoingNoShow = row.status === 'NO_SHOW' && input.status === 'CONFIRMED' && !input.startAt;
    if ((input.status || input.startAt) && !isOpen && !undoingNoShow) {
      throw new ConflictException(`A ${row.status.toLowerCase().replace('_', '-')} appointment cannot be changed`);
    }
    if (input.status === 'CONFIRMED' && !undoingNoShow) {
      throw new ConflictException('An appointment can only be set back to confirmed to undo a no-show');
    }

    // You cannot have finished a haircut that has not started.
    if (input.status === 'COMPLETED') {
      const completeFrom = completableFrom(row.startAt);
      if (new Date() < completeFrom) {
        throw new ConflictException(
          `This appointment starts at ${formatLocalTime(completeFrom, row.salon.timezone)} — it cannot be completed before then.`,
        );
      }
    }

    // Someone ten minutes late has not missed their appointment.
    if (input.status === 'NO_SHOW') {
      const markableFrom = noShowMarkableFrom(row.startAt);
      if (new Date() < markableFrom) {
        const at = formatLocalTime(markableFrom, row.salon.timezone);
        throw new ConflictException(
          `Too early to call this a no-show — you can from ${at}, ${NO_SHOW_GRACE_MIN} minutes after the start time.`,
        );
      }
    }

    // What they paid and tipped are notes on a finished appointment, so they
    // only make sense once it is one. Null clears a mistaken entry.
    if (input.paymentMethod !== undefined || input.tipCents !== undefined) {
      const completed = input.status === 'COMPLETED' || (!input.status && row.status === 'COMPLETED');
      if (!completed) {
        const what = input.paymentMethod !== undefined ? 'A payment method' : 'A tip';
        throw new ConflictException(`${what} can only be recorded on a completed appointment`);
      }
    }

    const data: Record<string, unknown> = {};
    if (input.internalNotes !== undefined) data.internalNotes = input.internalNotes;
    if (input.paymentMethod !== undefined) data.paymentMethod = input.paymentMethod;
    if (input.tipCents !== undefined) data.tipCents = input.tipCents;
    if (input.startAt) {
      const startAt = new Date(input.startAt);
      data.startAt = startAt;
      data.endAt = new Date(startAt.getTime() + row.durationMinSnapshot * 60_000);
      data.blockEndAt = new Date(startAt.getTime() + (row.durationMinSnapshot + row.bufferMin) * 60_000);
    }
    if (input.status) {
      data.status = input.status;
      if (input.status === 'CANCELLED') {
        data.cancelledAt = new Date();
        data.cancelledByUserId = user.id;
        data.cancelReason = input.cancelReason ?? 'Cancelled by the business';
      }
    }

    let updated: ApptRow;
    try {
      updated = await this.prisma.appointment.update({ where: { id }, data, include: APPT_INCLUDE });
    } catch (err) {
      if (isDoubleBooking(err)) throw new ConflictException('That time overlaps another appointment');
      throw err;
    }

    if (input.status === 'CANCELLED') this.notify('appointment.cancelled', updated);
    else if (input.startAt) this.notify('appointment.rescheduled', updated);
    return this.toStaffView(updated, isManager(tenant));
  }

  // ---------- Internals ----------

  private async insert(args: {
    salonId: string;
    designerId: string;
    customerId: string;
    service: {
      id: string;
      name: string;
      priceCents: number;
      durationMin: number;
      bufferMin: number;
      allowsDoubleBooking: boolean;
    };
    startAt: Date;
    source: 'ONLINE' | 'STAFF';
    notes?: string | null;
    internalNotes?: string | null;
    createdByUserId: string | null;
  }): Promise<ApptRow> {
    try {
      return await this.prisma.appointment.create({
        data: {
          salonId: args.salonId,
          designerId: args.designerId,
          customerId: args.customerId,
          serviceId: args.service.id,
          startAt: args.startAt,
          endAt: new Date(args.startAt.getTime() + args.service.durationMin * 60_000),
          blockEndAt: new Date(args.startAt.getTime() + (args.service.durationMin + args.service.bufferMin) * 60_000),
          bufferMin: args.service.bufferMin,
          status: 'CONFIRMED',
          source: args.source,
          serviceNameSnapshot: args.service.name,
          priceCentsSnapshot: args.service.priceCents,
          durationMinSnapshot: args.service.durationMin,
          // Snapshotted like the price: changing the service later must not
          // silently move an existing appointment in or out of the constraint.
          allowsDoubleBooking: args.service.allowsDoubleBooking,
          notes: args.notes ?? null,
          internalNotes: args.internalNotes ?? null,
          createdByUserId: args.createdByUserId,
        },
        include: APPT_INCLUDE,
      });
    } catch (err) {
      if (isDoubleBooking(err)) throw new ConflictException('That time was just taken. Please pick another slot.');
      throw err;
    }
  }

  private async salonBySlug(slug: string) {
    const salon = await this.prisma.salon.findUnique({ where: { slug } });
    if (!salon) throw new NotFoundException('Business not found');
    return salon;
  }

  private async salonById(id: string) {
    const salon = await this.prisma.salon.findUnique({ where: { id } });
    if (!salon) throw new NotFoundException('Business not found');
    return salon;
  }

  /** Public path: the service must be live and its owner bookable. */
  private async bookableService(salonId: string, serviceId: string, designerId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, salonId, designerId, active: true, designer: { status: 'ACTIVE', roles: { has: 'DESIGNER' } } },
    });
    if (!service) throw new NotFoundException('That service is not available for online booking');
    return service;
  }

  /** Staff path: any service of that designer in this salon, active or not. */
  private async serviceInSalon(salonId: string, serviceId: string, designerId: string) {
    const service = await this.prisma.service.findFirst({ where: { id: serviceId, salonId, designerId } });
    if (!service) throw new BadRequestException('That service does not belong to this team member');
    return service;
  }

  private cancellableUntil(row: ApptRow): Date | null {
    if (!BLOCKING_STATUSES.includes(row.status)) return null;
    return new Date(row.startAt.getTime() - row.salon.cancelWindowHours * 3_600_000);
  }

  private notify(type: 'appointment.booked' | 'appointment.cancelled' | 'appointment.rescheduled', row: ApptRow) {
    this.notifications.emit({
      type,
      to: { email: row.customer.email, name: row.customer.name },
      data: {
        appointmentId: row.id,
        salonName: row.salon.name,
        designerName: row.designer.displayName,
        serviceName: row.serviceNameSnapshot,
        startAt: row.startAt.toISOString(),
        timezone: row.salon.timezone,
      },
    });
  }

  private toCustomerView(r: ApptRow): CustomerAppointment {
    const until = this.cancellableUntil(r);
    return {
      id: r.id,
      status: r.status,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt.toISOString(),
      serviceName: r.serviceNameSnapshot,
      priceCents: r.priceCentsSnapshot,
      designerId: r.designerId,
      designerName: r.designer.displayName,
      salon: { id: r.salon.id, name: r.salon.name, slug: r.salon.slug, timezone: r.salon.timezone },
      cancellableUntil: until && until > new Date() ? until.toISOString() : null,
      notes: r.notes,
    };
  }

  private toStaffView(r: ApptRow, includeContact: boolean): StaffAppointment {
    return {
      id: r.id,
      designerId: r.designerId,
      status: r.status,
      source: r.source,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt.toISOString(),
      bufferMin: r.bufferMin,
      serviceId: r.serviceId,
      serviceName: r.serviceNameSnapshot,
      priceCents: r.priceCentsSnapshot,
      durationMin: r.durationMinSnapshot,
      allowsDoubleBooking: r.allowsDoubleBooking,
      paymentMethod: r.paymentMethod,
      tipCents: r.tipCents,
      customer: {
        id: r.customer.id,
        name: r.customer.name,
        ...(includeContact ? { email: r.customer.email, phone: r.customer.phone } : {}),
      },
      notes: r.notes,
      internalNotes: r.internalNotes,
      cancelReason: r.cancelReason,
      createdAt: r.createdAt.toISOString(),
    };
  }
}

/** Re-exported for tests that need to assert on the exact refusal. */
export { ForbiddenException as _ForbiddenException };
