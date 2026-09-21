import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  /** Email delivery. Unset RESEND_API_KEY → notifications are logged, not sent. */
  // Compose passes an empty string when the variable is unset; treat that as absent.
  RESEND_API_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  EMAIL_FROM: z.string().default('Reserivo <onboarding@resend.dev>'),
  /** Public web origin, used to build links we hand to users (invites). */
  WEB_URL: z.url().default('http://localhost:3000'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(15 * 60),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
});

export type Env = z.infer<typeof envSchema>;

/** Used by ConfigModule.forRoot({ validate }) — throws on boot if env is malformed. */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
