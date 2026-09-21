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

// ---------- Availability queries ----------

export const availabilityQuerySchema = z.object({
  designerId: z.uuid(),
  serviceId: z.uuid(),
  from: localDateSchema,
  /** How many days from `from`, inclusive. */
  days: z.coerce.number().int().min(1).max(31).default(7),
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
