import { z } from 'zod';

/** Compose hands unset variables through as '', which must read as absent. */
const optionalString = z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  /** Email delivery. Unset RESEND_API_KEY → notifications are logged, not sent. */
  // Compose passes an empty string when the variable is unset; treat that as absent.
  RESEND_API_KEY: optionalString,
  /**
   * SMS delivery. All three must be set before a single text is sent; until
   * then reminders are email-only. US numbers also need A2P 10DLC
   * registration with the carrier or messages are filtered.
   */
  TWILIO_ACCOUNT_SID: optionalString,
  TWILIO_AUTH_TOKEN: optionalString,
  TWILIO_FROM_NUMBER: optionalString,
  EMAIL_FROM: z.string().default('Reserivo <onboarding@resend.dev>'),
  /**
   * Comma-separated emails that always hold site admin. Applied on boot to
   * accounts that already exist and at registration to new ones. Grant-only:
   * removing an address here never takes the flag away.
   */
  SITE_ADMIN_EMAILS: z.string().default(''),
  /** Public web origin, used to build links we hand to users (invites). */
  WEB_URL: z.url().default('http://localhost:3000'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(15 * 60),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parses SITE_ADMIN_EMAILS. Kept as a raw string in the schema and split here
 * so the value ConfigService hands back is the same shape whether it comes
 * from the validated config or straight from process.env.
 */
export function siteAdminEmails(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/** Used by ConfigModule.forRoot({ validate }) — throws on boot if env is malformed. */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
