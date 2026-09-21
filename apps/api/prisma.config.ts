import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * `prisma migrate deploy` opens its own connection rather than going through
 * our pool, so the TLS decision has to be made here too — see DATABASE_SSL in
 * src/config/env.ts for what the values mean. On a managed provider the
 * container runs migrations at boot, and without this it would fail to connect
 * before the app ever starts.
 *
 * Deliberately self-contained: the runtime image ships `dist/` and this file
 * but no `src/`, so importing the helper from there would work locally and
 * break in production. The mapping differs from the pool's in any case — these
 * are Prisma's query parameters, not node-postgres's options.
 */
function withPostgresSsl(url: string, mode: string | undefined): string {
  if (mode !== 'require' && mode !== 'no-verify') return url;
  const parsed = new URL(url);
  parsed.searchParams.set('sslmode', 'require');
  if (mode === 'no-verify') parsed.searchParams.set('sslaccept', 'accept_invalid_certs');
  return parsed.toString();
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: withPostgresSsl(env('DATABASE_URL'), process.env.DATABASE_SSL),
  },
});
