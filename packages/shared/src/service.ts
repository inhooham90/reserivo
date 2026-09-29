import { z } from 'zod';

/**
 * A service has to be longer than this before it can be marked
 * double-bookable. The point of the flag is processing time — colour
 * developing, a perm setting — and a short service has none.
 */
export const DOUBLE_BOOKING_MIN_DURATION_MIN = 35;

export const canAllowDoubleBooking = (durationMin: number): boolean => durationMin > DOUBLE_BOOKING_MIN_DURATION_MIN;

/** Prices are integer cents (USD for now); durations are whole minutes. */
export const serviceSchema = z.object({
  id: z.string(),
  salonId: z.string(),
  designerId: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  description: z.string().nullable(),
  priceCents: z.number().int(),
  durationMin: z.number().int(),
  bufferMin: z.number().int(),
  active: z.boolean(),
  /** Another appointment may share this time — the designer is not hands-on throughout. */
  allowsDoubleBooking: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Service = z.infer<typeof serviceSchema>;

export const createServiceSchema = z.object({
  /** Managers set this to create on a designer's behalf; designers may omit it. */
  designerId: z.string().optional(),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(60).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  priceCents: z.number().int().min(0).max(1_000_000),
  /** 5-minute steps keep slot math sane and match how salons actually book. */
  durationMin: z.number().int().min(5).max(600).multipleOf(5),
  bufferMin: z.number().int().min(0).max(120).multipleOf(5).default(0),
  active: z.boolean().default(true),
  allowsDoubleBooking: z.boolean().default(false),
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

/** Rejects the flag on a service too short to have any downtime in it. */
export function assertDoubleBookingAllowed(durationMin: number, allowsDoubleBooking: boolean | undefined): string | null {
  if (!allowsDoubleBooking || canAllowDoubleBooking(durationMin)) return null;
  return `Only services longer than ${DOUBLE_BOOKING_MIN_DURATION_MIN} minutes can be double booked`;
}

export const createServiceInputSchema = createServiceSchema.superRefine((v, ctx) => {
  const problem = assertDoubleBookingAllowed(v.durationMin, v.allowsDoubleBooking);
  if (problem) ctx.addIssue({ code: 'custom', message: problem, path: ['allowsDoubleBooking'] });
});

/** A whole menu at once, from the guided setup. Enough for any real menu, small enough to review on one screen. */
export const MAX_SERVICES_PER_BATCH = 50;

export const createServicesInputSchema = z.object({
  designerId: z.string().optional(),
  services: z
    .array(
      createServiceSchema.omit({ designerId: true }).superRefine((v, ctx) => {
        const problem = assertDoubleBookingAllowed(v.durationMin, v.allowsDoubleBooking);
        if (problem) ctx.addIssue({ code: 'custom', message: problem, path: ['allowsDoubleBooking'] });
      }),
    )
    .min(1)
    .max(MAX_SERVICES_PER_BATCH),
});
export type CreateServicesInput = z.infer<typeof createServicesInputSchema>;

export const updateServiceSchema =createServiceSchema.omit({ designerId: true }).partial().extend({
  sortOrder: z.number().int().min(0).optional(),
});
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

/** What a customer sees on the booking page. */
export const publicServiceSchema = serviceSchema.pick({
  id: true,
  designerId: true,
  name: true,
  category: true,
  description: true,
  priceCents: true,
  durationMin: true,
});
export type PublicService = z.infer<typeof publicServiceSchema>;
