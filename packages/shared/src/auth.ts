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
  /** Present only when a site admin is acting as this user. */
  actorUserId: z.string().nullable().optional(),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;

export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: currentUserSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
