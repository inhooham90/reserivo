import { z } from 'zod';
import { salonRoleSchema } from './roles';

/** A salon team member as seen by other members. Email only for managers. */
export const memberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  role: salonRoleSchema,
  displayName: z.string(),
  bio: z.string().nullable(),
  photoUrl: z.string().nullable(),
  /** False hides this member from the public booking page (e.g. a front-desk manager). */
  acceptsBookings: z.boolean(),
  /** Present only in responses to MANAGER (or admin) callers. */
  email: z.string().optional(),
  createdAt: z.string(),
});
export type Member = z.infer<typeof memberSchema>;

export const updateMemberSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80),
    bio: z.string().trim().max(600).nullable(),
    photoUrl: z.url().max(500).nullable(),
    acceptsBookings: z.boolean(),
    /** Managers only. */
    role: salonRoleSchema,
  })
  .partial();
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

/** Public-facing designer card. Never carries user identity or contact fields. */
export const publicDesignerSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  bio: z.string().nullable(),
  photoUrl: z.string().nullable(),
});
export type PublicDesigner = z.infer<typeof publicDesignerSchema>;
