import { z } from 'zod';
import { salonRolesSchema } from './roles';

/**
 * Site-admin surface. Everything here is readable only by users with
 * `isSiteAdmin`, and every call through it is recorded in the audit log.
 */

export const platformStatsSchema = z.object({
  users: z.number().int(),
  salons: z.number().int(),
  bookableMembers: z.number().int(),
  customers: z.number().int(),
  appointments: z.number().int(),
  upcomingAppointments: z.number().int(),
  bookedLast7Days: z.number().int(),
});
export type PlatformStats = z.infer<typeof platformStatsSchema>;

export const adminSearchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminSearch = z.infer<typeof adminSearchSchema>;

// ---------- Users ----------

export const adminUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  isSiteAdmin: z.boolean(),
  createdAt: z.string(),
  salonCount: z.number().int(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminUserDetailSchema = adminUserSchema.extend({
  memberships: z.array(
    z.object({
      id: z.string(),
      salonId: z.string(),
      salonName: z.string(),
      salonSlug: z.string(),
      roles: salonRolesSchema,
      status: z.string(),
      displayName: z.string(),
    }),
  ),
  /** Salons where this person is on file as a client. */
  customerOf: z.array(
    z.object({ id: z.string(), salonId: z.string(), salonName: z.string(), appointments: z.number().int() }),
  ),
  /** Whether a site admin may act as this user (never another admin, never themselves). */
  canImpersonate: z.boolean(),
});
export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>;

// ---------- Salons ----------

export const adminSalonSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  timezone: z.string(),
  createdAt: z.string(),
  memberCount: z.number().int(),
  customerCount: z.number().int(),
  appointmentCount: z.number().int(),
});
export type AdminSalon = z.infer<typeof adminSalonSchema>;

export const adminSalonDetailSchema = adminSalonSchema.extend({
  serviceCount: z.number().int(),
  upcomingAppointments: z.number().int(),
  policies: z.object({
    slotIntervalMin: z.number().int(),
    leadTimeMin: z.number().int(),
    maxAdvanceDays: z.number().int(),
    cancelWindowHours: z.number().int(),
  }),
  members: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      displayName: z.string(),
      email: z.string(),
      roles: salonRolesSchema,
      status: z.string(),
    }),
  ),
});
export type AdminSalonDetail = z.infer<typeof adminSalonDetailSchema>;

// ---------- Audit log ----------

export const auditQuerySchema = z.object({
  actorUserId: z.uuid().optional(),
  salonId: z.uuid().optional(),
  entityType: z.string().trim().max(50).optional(),
  /** Only actions taken while acting as somebody else. */
  impersonatedOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  /** Id of the last row of the previous page. */
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;

const auditPersonSchema = z.object({ id: z.string(), name: z.string(), email: z.string() });

export const auditEntrySchema = z.object({
  id: z.string(),
  action: z.string(),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  createdAt: z.string(),
  ip: z.string().nullable(),
  /** Whose hands were on the keyboard. */
  actor: auditPersonSchema.nullable(),
  /** Set only when the actor was acting as someone else. */
  impersonated: auditPersonSchema.nullable(),
  salon: z.object({ id: z.string(), name: z.string() }).nullable(),
  /** Redacted request payload, as stored. */
  after: z.unknown().nullable(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const auditPageSchema = z.object({
  entries: z.array(auditEntrySchema),
  /** Pass back as `cursor` for the next page; null when there are no more. */
  nextCursor: z.string().nullable(),
});
export type AuditPage = z.infer<typeof auditPageSchema>;
