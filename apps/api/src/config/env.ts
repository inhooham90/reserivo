import { z } from 'zod';

/** Compose hands unset variables through as '', which must read as absent. */
const optionalString = z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.url(),
  /**
   * How to talk TLS to Postgres.
   *   off       — plaintext. Right for the local container, wrong anywhere else.
   *   require   — TLS, certificate verified against the system CA store.
   *   no-verify — TLS, certificate *not* verified.
   *
   * Managed providers (Heroku among them) require TLS but present a
   * certificate their own CA signed, which Node will not trust, so 'no-verify'
   * is the only setting that connects. It protects the traffic from passive
   * eavesdropping but not from an active machine-in-the-middle, which is the
   * accepted trade on those platforms because the hop is inside their network.
   * Never default this on: a silent downgrade is worse than a failed boot.
   */
  DATABASE_SSL: z.enum(['off', 'require', 'no-verify']).default('off'),
  REDIS_URL: z.url().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  /** Email delivery. Unset RESEND_API_KEY → notifications are logged, not sent. */
  // Compose passes an empty string when the variable is unset; treat that as absent.
  RESEND_API_KEY: optionalString,
  /**
   * Marketing email, deliberately on its own key and its own verified
   * subdomain. A salon's campaign that collects spam complaints must not be
   * able to damage the reputation carrying password resets and booking
   * confirmations. Either both unset (campaigns disabled) or both set.
   */
  RESEND_MARKETING_API_KEY: optionalString,
  EMAIL_MARKETING_FROM: optionalString,
  /**
   * SMS delivery. All three must be set before a single text is sent; until
   * then reminders are email-only. US numbers also need A2P 10DLC
   * registration with the carrier or messages are filtered.
   */
  TWILIO_ACCOUNT_SID: optionalString,
  TWILIO_AUTH_TOKEN: optionalString,
  TWILIO_FROM_NUMBER: optionalString,
  EMAIL_FROM: z.string().default('Morrri <onboarding@resend.dev>'),
  /**
   * Comma-separated emails that always hold site admin. Applied on boot to
   * accounts that already exist and at registration to new ones. Grant-only:
   * removing an address here never takes the flag away.
   */
  SITE_ADMIN_EMAILS: z.string().default(''),
  /** Public web origin, used to build links we hand to users (invites). */
  WEB_URL: z.url().default('http://localhost:3000'),
  /**
   * Public origin of this API, as a mail client reaches it. Only the campaign
   * List-Unsubscribe header needs it: RFC 8058 one-click is a POST straight
   * from Gmail or Yahoo, which a web page cannot answer.
   */
  PUBLIC_API_URL: z.url().default('http://localhost:3001'),
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

/**
 * node-postgres `ssl` option for a DATABASE_SSL setting. Returns false rather
 * than undefined for 'off' so the intent is explicit in the pool config.
 */
export function postgresSsl(mode: Env['DATABASE_SSL']): false | true | { rejectUnauthorized: false } {
  if (mode === 'off') return false;
  return mode === 'require' ? true : { rejectUnauthorized: false };
}
