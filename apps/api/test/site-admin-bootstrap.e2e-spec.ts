import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { SiteAdminBootstrap } from '../src/admin/site-admin-bootstrap.service.js';
import { AppModule } from '../src/app.module.js';
import type { Env } from '../src/config/env.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * SITE_ADMIN_EMAILS grants site admin without anyone touching the database:
 * on boot for accounts that already exist, at registration for newcomers.
 *
 * The configured list cannot be varied through process.env here — apps/api/.env
 * wins over real environment variables in this ConfigModule setup — so the
 * bootstrap is driven directly and registration is exercised with the lookup
 * stubbed. Both run against the real database.
 */
describe('Site admin bootstrap (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let config: ConfigService<Env, true>;
  const stamp = Date.now();
  const pw = 'correct horse battery';
  const existing = `boot-existing-${stamp}@test.local`;
  const configured = `boot-configured-${stamp}@test.local`;
  const bystander = `boot-bystander-${stamp}@test.local`;

  const api = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const register = (email: string, name: string) => api().post('/auth/register').send({ email, password: pw, name }).expect(201);
  /** Runs the startup hook as if this list had been configured. */
  const runBootstrap = (list: string) =>
    new SiteAdminBootstrap(prisma, { get: () => list } as unknown as ConfigService<Env, true>).onModuleInit();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
    config = app.get(ConfigService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('promotes a configured account that already exists, whatever its spacing or case', async () => {
    const signup = await register(existing, 'Boot Existing');
    expect(signup.body.user.isSiteAdmin).toBe(false);
    const token = signup.body.accessToken;
    await api().get('/admin/stats').set(auth(token)).expect(403);

    await runBootstrap(`  ${existing.toUpperCase()} , `);

    // JwtStrategy re-reads the user each request, so the same token now works.
    const me = await api().get('/auth/me').set(auth(token)).expect(200);
    expect(me.body.isSiteAdmin).toBe(true);
    await api().get('/admin/stats').set(auth(token)).expect(200);
  });

  it('never demotes: running with nobody configured leaves the flag in place', async () => {
    await runBootstrap('');
    const back = await api().post('/auth/login').send({ email: existing, password: pw }).expect(200);
    expect(back.body.user.isSiteAdmin).toBe(true);
  });

  it('creates a configured newcomer as an admin, and nobody else', async () => {
    const real = config.get.bind(config);
    const spy = vi
      .spyOn(config, 'get')
      .mockImplementation(((key: string, ...rest: unknown[]) =>
        key === 'SITE_ADMIN_EMAILS' ? configured : (real as (...a: unknown[]) => unknown)(key, ...rest)) as never);

    try {
      const fresh = await register(configured, 'Boot Configured');
      expect(fresh.body.user.isSiteAdmin).toBe(true);
      await api().get('/admin/stats').set(auth(fresh.body.accessToken)).expect(200);

      const other = await register(bystander, 'Boot Bystander');
      expect(other.body.user.isSiteAdmin).toBe(false);
      await api().get('/admin/stats').set(auth(other.body.accessToken)).expect(403);
    } finally {
      spy.mockRestore();
    }
  });
});
