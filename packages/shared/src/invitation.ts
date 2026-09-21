import { z } from 'zod';
import { emailSchema } from './auth';
import { salonRolesSchema } from './roles';

export const createInvitationSchema = z.object({
  email: emailSchema,
  roles: salonRolesSchema,
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

/** Manager's view of a pending invitation. */
export const invitationSchema = z.object({
  id: z.string(),
  email: z.string(),
  roles: salonRolesSchema,
  expiresAt: z.string(),
  createdAt: z.string(),
  /** Only returned once, on creation — the raw token is never stored. */
  inviteUrl: z.string().optional(),
});
export type Invitation = z.infer<typeof invitationSchema>;

/** What the invitee sees at /invite/{token} before accepting. */
export const invitationPreviewSchema = z.object({
  salonName: z.string(),
  salonSlug: z.string(),
  roles: salonRolesSchema,
  email: z.string(),
  expiresAt: z.string(),
});
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

export const acceptInvitationResponseSchema = z.object({
  salonId: z.string(),
  membershipId: z.string(),
  roles: salonRolesSchema,
});
export type AcceptInvitationResponse = z.infer<typeof acceptInvitationResponseSchema>;
