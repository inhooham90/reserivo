import { z } from 'zod';
import { designerRatingSchema } from './rating';
import { salonRolesSchema } from './roles';

/**
 * Paths the web app already owns at the root. A salon taking one of these
 * would be shadowed by the static route and its booking page would never load.
 *
 * The language codes are here for the same reason: `/ko/glow-salon` puts the
 * locale in the first segment, so a salon named "ko" would be indistinguishable
 * from Korean. English is reserved too even though it is unprefixed today, so
 * switching to a prefix for every language stays a one-line change.
 */
const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'appointments',
  'dashboard',
  'en',
  'es',
  'forgot-password',
  'invite',
  'ko',
  'login',
  'messages',
  'privacy',
  'register',
  'reset-password',
  's',
  'settings',
  'sms',
  'terms',
  'verify-email',
  'zh',
]);

/** URL-safe identifier used at /{slug}. Lowercase letters, digits, single hyphens. */
export const salonSlugSchema = z
  .string()
  .min(3)
  .max(50)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens')
  .refine((slug) => !RESERVED_SLUGS.has(slug), { message: 'That address is reserved — pick another' });

/** IANA zone like "America/Los_Angeles". Validated against the runtime's zone list. */
export const timezoneSchema = z.string().refine(
  (tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Unknown time zone' },
);

/** Booking policies, editable by managers. Defaults match the Prisma schema. */
export const salonPoliciesSchema = z.object({
  /** Slot grid in minutes. */
  slotIntervalMin: z.number().int().min(5).max(60).multipleOf(5),
  /** Minimum notice for an online booking, in minutes. */
  leadTimeMin: z.number().int().min(0).max(7 * 24 * 60),
  /** How far ahead customers may book. */
  maxAdvanceDays: z.number().int().min(1).max(365),
  /** How many hours before the start a customer may still self-cancel. */
  cancelWindowHours: z.number().int().min(0).max(24 * 14),
  /** Hours before the start to remind the customer. Empty turns reminders off. */
  reminderHoursBefore: z
    .array(z.number().int().min(1).max(168))
    .max(3)
    .transform((hours) => Array.from(new Set(hours)).sort((a, b) => b - a)),
});
export type SalonPolicies = z.infer<typeof salonPoliciesSchema>;

export const createSalonSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: salonSlugSchema,
  timezone: timezoneSchema,
  /** Solo operators and owner-stylists: the creator is also a bookable designer. */
  takesAppointments: z.boolean().default(true),
});
export type CreateSalonInput = z.infer<typeof createSalonSchema>;

export const updateSalonSchema = z
  .object({ name: z.string().trim().min(1).max(120), timezone: timezoneSchema })
  .extend(salonPoliciesSchema.shape)
  .partial();
export type UpdateSalonInput = z.infer<typeof updateSalonSchema>;

/** Every salon payload carries its policies; the booking UI needs them too. */
export const salonSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    timezone: z.string(),
    createdAt: z.string(),
  })
  .extend(salonPoliciesSchema.shape);
export type Salon = z.infer<typeof salonSchema>;

export const salonMembershipSchema = z.object({
  id: z.string(),
  salonId: z.string(),
  userId: z.string(),
  roles: salonRolesSchema,
  displayName: z.string(),
});
export type SalonMembership = z.infer<typeof salonMembershipSchema>;

/** What a logged-in user sees in their salon switcher. */
export const mySalonSchema = salonSchema.extend({ roles: salonRolesSchema });
export type MySalon = z.infer<typeof mySalonSchema>;

/** The booking page payload: salon + opening hours + bookable team + their live services. No contact fields, ever. */
export const publicSalonSchema = salonSchema.extend({
  hours: z.array(z.object({ weekday: z.number().int(), startMinutes: z.number().int(), endMinutes: z.number().int() })),
  designers: z.array(
    z.object({
      id: z.string(),
      displayName: z.string(),
      bio: z.string().nullable(),
      photoUrl: z.string().nullable(),
      /// Prior-weighted score; see rating.ts. Every designer has one.
      rating: designerRatingSchema,
      services: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          category: z.string().nullable(),
          description: z.string().nullable(),
          priceCents: z.number().int(),
          durationMin: z.number().int(),
        }),
      ),
    }),
  ),
});
export type PublicSalon = z.infer<typeof publicSalonSchema>;
