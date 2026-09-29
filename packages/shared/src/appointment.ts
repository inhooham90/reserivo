import { z } from 'zod';
import { emailSchema } from './auth';
import { localDateSchema } from './availability';

export const AppointmentStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];
export const appointmentStatusSchema = z.enum([
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
]);

/** Statuses that occupy the designer's time. Mirrors the DB exclusion constraint's WHERE clause. */
export const BLOCKING_STATUSES: readonly AppointmentStatus[] = ['PENDING', 'CONFIRMED'];

/**
 * How long after the start time staff may call an appointment a no-show.
 * Before that the customer is merely late, not absent.
 */
export const NO_SHOW_GRACE_MIN = 15;

/** The instant from which this appointment may be marked a no-show. */
export function noShowMarkableFrom(startAt: string | Date): Date {
  return new Date(new Date(startAt).getTime() + NO_SHOW_GRACE_MIN * 60_000);
}

/**
 * How the customer paid, recorded when staff complete an appointment. Optional
 * throughout: null means nobody wrote it down, not that the bill is unpaid.
 */
export const PaymentMethod = {
  CARD: 'CARD',
  CASH: 'CASH',
  GIFT_CARD: 'GIFT_CARD',
  MOBILE_PAY: 'MOBILE_PAY',
  OTHER: 'OTHER',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];
export const paymentMethodSchema = z.enum([
  PaymentMethod.CARD,
  PaymentMethod.CASH,
  PaymentMethod.GIFT_CARD,
  PaymentMethod.MOBILE_PAY,
  PaymentMethod.OTHER,
]);

/** Display order is how often a salon reaches for each one. */
export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  PaymentMethod.CARD,
  PaymentMethod.CASH,
  PaymentMethod.GIFT_CARD,
  PaymentMethod.MOBILE_PAY,
  PaymentMethod.OTHER,
];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CARD: 'Card',
  CASH: 'Cash',
  GIFT_CARD: 'Gift card',
  MOBILE_PAY: 'Mobile pay',
  OTHER: 'Other',
};

/**
 * The instant from which this appointment may be marked complete. A service
 * that has not started cannot have been delivered, so the gate is the start
 * time itself — no grace, unlike a no-show.
 */
export function completableFrom(startAt: string | Date): Date {
  return new Date(startAt);
}

// ---------- Availability queries ----------

export const availabilityQuerySchema = z.object({
  designerId: z.uuid(),
  serviceId: z.uuid(),
  from: localDateSchema,
  /** How many days from `from`, inclusive. */
  days: z.coerce.number().int().min(1).max(31).default(7),
  /**
   * Staff only: leave this appointment out of the busy set. Rescheduling asks
   * "where could this go?", and an appointment always collides with itself —
   * without this you could not nudge one by fifteen minutes. The public route
   * ignores it, so it can never be used to surface someone else's slot.
   */
  excludeAppointmentId: z.uuid().optional(),
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const slotSchema = z.object({
  /** ISO-8601 UTC instant. Send this back verbatim when booking. */
  startAt: z.string(),
  /** Local minutes from midnight, for display without another conversion. */
  startMinutes: z.number().int(),
});
export type Slot = z.infer<typeof slotSchema>;

export const daySlotsSchema = z.object({ date: localDateSchema, slots: z.array(slotSchema) });
export type DaySlots = z.infer<typeof daySlotsSchema>;

export const availabilityResponseSchema = z.object({
  timezone: z.string(),
  durationMin: z.number().int(),
  days: z.array(daySlotsSchema),
});
export type AvailabilityResponse = z.infer<typeof availabilityResponseSchema>;

// ---------- Public booking ----------

/** Lenient on formatting — "(555) 010-2020", "+1 555 010 2020", "555.010.2020" all pass. Normalisation is Phase 3's job. */
export const phoneSchema = z
  .string()
  .trim()
  .min(7)
  .max(25)
  .regex(/^\+?[\d(][\d\s().-]*\d$/, 'Enter a valid phone number');

export const bookAppointmentSchema = z.object({
  designerId: z.uuid(),
  serviceId: z.uuid(),
  startAt: z.iso.datetime(),
  customer: z.object({
    name: z.string().trim().min(1).max(100),
    email: emailSchema,
    phone: phoneSchema.optional(),
    /** Express consent to be texted. Required by the TCPA before any automated SMS. */
    smsConsent: z.boolean().optional(),
  }),
  notes: z.string().trim().max(500).optional(),
});
export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;

/**
 * "Anyone available". Every team member owns their own copy of a service, so
 * the booking page sends the same service as each of them offers it, one id
 * per person, and the server picks who is free. Twenty is more team members
 * than any business on the page would list.
 */
export const MAX_ANYONE_SERVICES = 20;
const anyServiceIdsSchema = z.array(z.uuid()).min(1).max(MAX_ANYONE_SERVICES);

export const anyAvailabilityQuerySchema = availabilityQuerySchema
  .omit({ designerId: true, serviceId: true, excludeAppointmentId: true })
  .extend({
    // A query string carries a list as "a,b,c".
    serviceIds: z.preprocess((v) => (typeof v === 'string' ? v.split(',').filter(Boolean) : v), anyServiceIdsSchema),
  });
export type AnyAvailabilityQuery = z.infer<typeof anyAvailabilityQuerySchema>;

export const bookAnyAppointmentSchema = bookAppointmentSchema
  .omit({ designerId: true, serviceId: true })
  .extend({ serviceIds: anyServiceIdsSchema });
export type BookAnyAppointmentInput = z.infer<typeof bookAnyAppointmentSchema>;

/** What a customer sees about their own booking. Designer is shown by display name only. */
export const customerAppointmentSchema = z.object({
  id: z.string(),
  status: appointmentStatusSchema,
  startAt: z.string(),
  endAt: z.string(),
  serviceName: z.string(),
  priceCents: z.number().int(),
  designerId: z.string(),
  designerName: z.string(),
  salon: z.object({ id: z.string(), name: z.string(), slug: z.string(), timezone: z.string() }),
  /** Latest instant the customer may still self-cancel; null when the window has passed. */
  cancellableUntil: z.string().nullable(),
  notes: z.string().nullable(),
});
export type CustomerAppointment = z.infer<typeof customerAppointmentSchema>;

// ---------- Staff ----------

export const staffAppointmentsQuerySchema = z.object({
  from: localDateSchema,
  to: localDateSchema,
  designerId: z.uuid().optional(),
});
export type StaffAppointmentsQuery = z.infer<typeof staffAppointmentsQuerySchema>;

/** Either pick an existing customer or describe a new one. */
export const staffBookAppointmentSchema = z
  .object({
    designerId: z.uuid(),
    serviceId: z.uuid(),
    startAt: z.iso.datetime(),
    customerId: z.uuid().optional(),
    customer: z
      .object({
        name: z.string().trim().min(1).max(100),
        email: emailSchema.optional(),
        phone: phoneSchema.optional(),
      })
      .optional(),
    internalNotes: z.string().trim().max(1000).optional(),
  })
  .refine((v) => Boolean(v.customerId) !== Boolean(v.customer), {
    message: 'Provide customerId or customer, not both',
    path: ['customerId'],
  });
export type StaffBookAppointmentInput = z.infer<typeof staffBookAppointmentSchema>;

export const updateAppointmentSchema = z
  .object({
    /** CONFIRMED is only accepted to undo a no-show; other final states stay final. */
    status: z.enum(['COMPLETED', 'NO_SHOW', 'CANCELLED', 'CONFIRMED']),
    cancelReason: z.string().trim().max(300),
    internalNotes: z.string().trim().max(1000).nullable(),
    /** Reschedule. Re-checked against the exclusion constraint. */
    startAt: z.iso.datetime(),
    /** Accepted when completing, or afterwards to correct the record. Null clears it. */
    paymentMethod: paymentMethodSchema.nullable(),
    /** Tip in cents, same rules as paymentMethod. Null clears it; 0 records "no tip". */
    tipCents: z.number().int().min(0).max(1_000_000).nullable(),
  })
  .partial();
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

/** Staff view. `customer.email`/`phone` are present only for managers. */
export const staffAppointmentSchema = z.object({
  id: z.string(),
  designerId: z.string(),
  status: appointmentStatusSchema,
  source: z.enum(['ONLINE', 'STAFF']),
  startAt: z.string(),
  endAt: z.string(),
  bufferMin: z.number().int(),
  serviceId: z.string().nullable(),
  serviceName: z.string(),
  priceCents: z.number().int(),
  durationMin: z.number().int(),
  /** Snapshot: other appointments may overlap this one. */
  allowsDoubleBooking: z.boolean(),
  /** How the customer paid. Null when nobody recorded it. */
  paymentMethod: paymentMethodSchema.nullable(),
  /** Tip in cents. Null when nobody recorded one, 0 when they recorded none. */
  tipCents: z.number().int().nullable(),
  customer: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
  }),
  notes: z.string().nullable(),
  internalNotes: z.string().nullable(),
  cancelReason: z.string().nullable(),
  createdAt: z.string(),
});
export type StaffAppointment = z.infer<typeof staffAppointmentSchema>;
