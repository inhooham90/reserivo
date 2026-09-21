import { z } from 'zod';
import { salonRoleSchema } from './roles';

/** URL-safe identifier used at /{slug}. Lowercase letters, digits, single hyphens. */
export const salonSlugSchema = z
  .string()
  .min(3)
  .max(50)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens');

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

export const createSalonSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: salonSlugSchema,
  timezone: timezoneSchema,
});
export type CreateSalonInput = z.infer<typeof createSalonSchema>;

export const salonSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  timezone: z.string(),
  createdAt: z.string(),
});
export type Salon = z.infer<typeof salonSchema>;

export const salonMembershipSchema = z.object({
  id: z.string(),
  salonId: z.string(),
  userId: z.string(),
  role: salonRoleSchema,
  displayName: z.string(),
});
export type SalonMembership = z.infer<typeof salonMembershipSchema>;

/** What a logged-in user sees in their salon switcher. */
export const mySalonSchema = salonSchema.extend({ role: salonRoleSchema });
export type MySalon = z.infer<typeof mySalonSchema>;

/** The booking page payload: salon + bookable team + their live services. No contact fields, ever. */
export const publicSalonSchema = salonSchema.extend({
  designers: z.array(
    z.object({
      id: z.string(),
      displayName: z.string(),
      bio: z.string().nullable(),
      photoUrl: z.string().nullable(),
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
