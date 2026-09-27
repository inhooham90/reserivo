import { z } from 'zod';

/** Trims and lowercases *before* validating, so a pasted "  Jane@Example.COM " is accepted and stored canonically. */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const passwordSchema = z.string().min(8).max(128);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1).max(100),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Shape of the authenticated user returned by GET /auth/me and login/register. */
export const currentUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  isSiteAdmin: z.boolean(),
  /**
   * Proof the person controls the address. Until it is true, nothing is
   * matched to them by email — guest bookings and conversations stay hidden.
   */
  emailVerified: z.boolean(),
  /**
   * Business accounts get business tools by default (header Schedule and
   * Messages go to the business); their personal bookings and inbox sit
   * behind the Personal menu. True when approved by a site admin or when the
   * account belongs to a business.
   */
  isBusinessAccount: z.boolean(),
  /** Approved by a site admin (or is one): may create a business. */
  canCreateBusiness: z.boolean(),
  /** Present only when a site admin is acting as this user. */
  actorUserId: z.string().nullable().optional(),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: currentUserSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

/** Emailed links carry an opaque high-entropy token; only its hash is stored. */
export const linkTokenSchema = z.string().trim().min(20).max(200);

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({ token: linkTokenSchema, password: passwordSchema });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({ token: linkTokenSchema });
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
