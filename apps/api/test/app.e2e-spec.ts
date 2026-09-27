import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { approveBusiness } from './business.js';

/**
 * Runs against DATABASE_URL (see apps/api/.env). Each run registers fresh users
 * so it is safe to repeat against a dev database.
 */
describe('Phase 0 (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const owner = { email: `owner-${stamp}@test.local`, password: 'correct horse battery', name: 'Owner' };
  const outsider = { email: `outsider-${stamp}@test.local`, password: 'correct horse battery', name: 'Outsider' };

  let ownerToken = '';
  let ownerCookie = '';
  let outsiderToken = '';
  let salonId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('GET /health is public', async () => {
    const res = await api().get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /auth/register issues an access token and refresh cookie', async () => {
    const res = await api().post('/auth/register').send(owner).expect(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email: owner.email, name: owner.name, isSiteAdmin: false });
    const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined;
    expect(setCookie?.[0]).toMatch(/^reserivo_rt=.*HttpOnly/);
    ownerToken = res.body.accessToken;
    ownerCookie = setCookie![0].split(';')[0];
  });

  it('POST /auth/register rejects a duplicate email', async () => {
    await api().post('/auth/register').send(owner).expect(409);
  });

  it('POST /auth/register validates the body via the shared zod schema', async () => {
    const res = await api().post('/auth/register').send({ email: 'nope', password: 'short', name: '' }).expect(400);
    expect(res.body.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'email' }), expect.objectContaining({ path: 'password' })]),
    );
  });

  it('GET /auth/me requires a token', async () => {
    await api().get('/auth/me').expect(401);
  });

  it('GET /auth/me returns the caller', async () => {
    const res = await api().get('/auth/me').set('Authorization', `Bearer ${ownerToken}`).expect(200);
    expect(res.body).toMatchObject({ email: owner.email, actorUserId: null });
  });

  it('POST /auth/login rejects a wrong password without revealing the account exists', async () => {
    const res = await api().post('/auth/login').send({ email: owner.email, password: 'wrong password' }).expect(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('POST /salons creates the salon and makes the caller its MANAGER', async () => {
    await approveBusiness(app, owner.email);
    const res = await api()
      .post('/salons')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Glow Salon', slug: `glow-${stamp}`, timezone: 'America/Los_Angeles' })
      .expect(201);
    // Creator defaults to taking appointments: manager and designer.
    expect(res.body).toMatchObject({ name: 'Glow Salon', roles: ['MANAGER', 'DESIGNER'], timezone: 'America/Los_Angeles' });
    salonId = res.body.id;
  });

  it('POST /salons rejects an invalid time zone and slug', async () => {
    const res = await api()
      .post('/salons')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Bad', slug: 'Not A Slug', timezone: 'Mars/Olympus' })
      .expect(400);
    expect(res.body.issues.map((i: { path: string }) => i.path)).toEqual(expect.arrayContaining(['slug', 'timezone']));
  });

  it('POST /salons refuses a slug that would be shadowed by one of our own pages', async () => {
    for (const slug of ['terms', 'privacy', 'login', 'admin']) {
      const res = await api()
        .post('/salons')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Shadow', slug, timezone: 'America/Los_Angeles' })
        .expect(400);
      expect(res.body.issues[0]).toMatchObject({ path: 'slug', message: expect.stringContaining('reserved') });
    }
  });

  it('GET /salons/mine lists it with the role', async () => {
    const res = await api().get('/salons/mine').set('Authorization', `Bearer ${ownerToken}`).expect(200);
    expect(res.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: salonId, roles: ['MANAGER', 'DESIGNER'] })]));
  });

  it('GET /salons/by-slug/:slug is public', async () => {
    const res = await api().get(`/salons/by-slug/glow-${stamp}`).expect(200);
    expect(res.body.id).toBe(salonId);
  });

  it('GET /salons/:salonId passes the tenancy guard for a member', async () => {
    await api().get(`/salons/${salonId}`).set('Authorization', `Bearer ${ownerToken}`).expect(200);
  });

  it('GET /salons/:salonId is forbidden for a non-member', async () => {
    const reg = await api().post('/auth/register').send(outsider).expect(201);
    outsiderToken = reg.body.accessToken;
    await api().get(`/salons/${salonId}`).set('Authorization', `Bearer ${outsiderToken}`).expect(403);
  });

  it('POST /auth/refresh rotates the refresh token', async () => {
    const first = await api().post('/auth/refresh').set('Cookie', ownerCookie).expect(200);
    expect(first.body.accessToken).toEqual(expect.any(String));
    // The old cookie is now revoked.
    await api().post('/auth/refresh').set('Cookie', ownerCookie).expect(401);
    const rotated = (first.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    await api().post('/auth/refresh').set('Cookie', rotated).expect(200);
  });

  it('POST /auth/logout clears the cookie', async () => {
    const res = await api().post('/auth/logout').set('Cookie', ownerCookie).expect(204);
    const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined;
    expect(setCookie?.[0]).toMatch(/^reserivo_rt=;/);
  });
});
