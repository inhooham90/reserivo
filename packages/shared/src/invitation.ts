import { z } from 'zod';
import { emailSchema } from './auth';
import { salonRoleSchema } from './roles';

export const createInvitationSchema = z.object({
  email: emailSchema,
  role: salonRoleSchema,
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

/** Manager's view of a pending invitation. */
export const invitationSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: salonRoleSchema,
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
  role: salonRoleSchema,
  email: z.string(),
  expiresAt: z.string(),
});
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

export const acceptInvitationResponseSchema = z.object({
  salonId: z.string(),
  membershipId: z.string(),
  role: salonRoleSchema,
});
export type AcceptInvitationResponse = z.infer<typeof acceptInvitationResponseSchema>;
