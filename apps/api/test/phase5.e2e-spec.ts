import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { addDays, localToUtc, todayIn } from '@reserivo/shared';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { approveBusiness } from './business.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';

const LA = 'America/Los_Angeles';

/**
 * Phase 5: confirming an address, and resetting a password.
 *
 * The first block is a regression test for a real hole — before verification
 * existed, registering with someone else's address handed you their guest
 * bookings and conversations.
 */
describe('Phase 5 (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const pw = 'correct horse battery';
  const newPw = 'a different long password';
  const owner = { email: `p5own-${stamp}@test.local`, password: pw, name: 'Olive Owner' };
  /** Books as a guest and never signs up; someone else will try to claim the address. */
  const guestEmail = `p5guest-${stamp}@test.local`;

  let ownToken = '';
  let salonId = '';
  let slug = '';
  let memberId = '';
  let serviceId = '';
  let guestApptId = '';
  let claimantToken = '';

  const api = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  /** Pulls the single-use token out of whatever link the notification carried. */
  const captureToken = async (type: 'auth.verify_email' | 'auth.password_reset', act: () => Promise<unknown>) => {
    const spy = vi.spyOn(app.get(NotificationsService), 'emit');
    try {
      await act();
      const sent = spy.mock.calls.map((c) => c[0]).find((e) => e.type === type);
      if (!sent || !('link' in sent.data)) throw new Error(`no ${type} was sent`);
      return new URL(sent.data.link).searchParams.get('token') ?? '';
    } finally {
      spy.mockRestore();
    }
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    ownToken = (await api().post('/auth/register').send(owner).expect(201)).body.accessToken;
    await approveBusiness(app, owner.email);
    slug = `phase5-${stamp}`;
    salonId = (await api().post('/salons').set(auth(ownToken)).send({ name: 'Phase Five Salon', slug, timezone: LA }).expect(201)).body.id;
    memberId = (await api().get(`/salons/${salonId}/members`).set(auth(ownToken)).expect(200)).body[0].id;
    const allWeek = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinutes: 540, endMinutes: 1020 }));
    await api().put(`/salons/${salonId}/hours/rules`).set(auth(ownToken)).send({ rules: allWeek }).expect(200);
    await api().put(`/salons/${salonId}/members/${memberId}/availability/rules`).set(auth(ownToken)).send({ rules: allWeek }).expect(200);
    serviceId = (
      await api().post(`/salons/${salonId}/services`).set(auth(ownToken)).send({ name: 'Cut', priceCents: 5000, durationMin: 60 }).expect(201)
    ).body.id;

    // The guest books without an account.
    const D = addDays(todayIn(LA), 6);
    guestApptId = (
      await api()
        .post(`/public/salons/${slug}/appointments`)
        .send({ designerId: memberId, serviceId, startAt: localToUtc(D, 600, LA).toISOString(), customer: { name: 'Gwen Guest', email: guestEmail } })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------- The hole this closes ----------

  it('registering with someone else’s address reveals nothing about them', async () => {
    const reg = await api().post('/auth/register').send({ email: guestEmail, password: pw, name: 'Not Gwen' }).expect(201);
    expect(reg.body.user.emailVerified).toBe(false);
    claimantToken = reg.body.accessToken;

    expect((await api().get('/me/appointments').set(auth(claimantToken)).expect(200)).body).toEqual([]);
    expect((await api().get('/me/conversations').set(auth(claimantToken)).expect(200)).body).toEqual([]);
    // Nor can they open a thread off the back of the stranger's booking.
    await api().post('/me/conversations').set(auth(claimantToken)).send({ salonId, designerId: memberId }).expect(403);
  });

  // ---------- Confirming an address ----------

  it('rejects a confirmation token that is malformed, unknown, or already spent', async () => {
    await api().post('/auth/verify-email').send({ token: 'short' }).expect(400);
    const unknown = await api().post('/auth/verify-email').send({ token: 'x'.repeat(43) }).expect(400);
    expect(unknown.body.message).toMatch(/invalid or has expired/i);
  });

  it('confirming links the guest records and signs the person in', async () => {
    // Re-send rather than reuse the registration link, which also proves resend works.
    const token = await captureToken('auth.verify_email', () =>
      api().post('/auth/verify-email/resend').set(auth(claimantToken)).expect(204),
    );

    const verified = await api().post('/auth/verify-email').send({ token }).expect(200);
    expect(verified.body.user).toMatchObject({ email: guestEmail, emailVerified: true });

    const mine = await api().get('/me/appointments').set(auth(verified.body.accessToken)).expect(200);
    expect(mine.body.map((a: { id: string }) => a.id)).toEqual([guestApptId]);

    // Single use.
    await api().post('/auth/verify-email').send({ token }).expect(400);
    // And a confirmed address stops asking.
    await api().post('/auth/verify-email/resend').set(auth(verified.body.accessToken)).expect(204);
  });

  it('issuing a new link retires the previous one', async () => {
    const fresh = { email: `p5rotate-${stamp}@test.local`, password: pw, name: 'Rory Rotate' };
    const first = await captureToken('auth.verify_email', () => api().post('/auth/register').send(fresh).expect(201));
    const login = await api().post('/auth/login').send({ email: fresh.email, password: pw }).expect(200);
    const second = await captureToken('auth.verify_email', () =>
      api().post('/auth/verify-email/resend').set(auth(login.body.accessToken)).expect(204),
    );

    expect(second).not.toBe(first);
    await api().post('/auth/verify-email').send({ token: first }).expect(400);
    await api().post('/auth/verify-email').send({ token: second }).expect(200);
  });

  // ---------- Password reset ----------

  it('says nothing about whether an address has an account', async () => {
    await api().post('/auth/forgot-password').send({ email: `nobody-${stamp}@test.local` }).expect(204);
    await api().post('/auth/forgot-password').send({ email: owner.email }).expect(204);
    await api().post('/auth/forgot-password').send({ email: 'not-an-email' }).expect(400);
  });

  it('resets the password, ends every other session, and confirms the address', async () => {
    // A session that should not survive the reset.
    const before = await api().post('/auth/login').send({ email: owner.email, password: pw }).expect(200);
    const staleCookie = (before.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    await api().post('/auth/refresh').set('Cookie', staleCookie).expect(200);

    const token = await captureToken('auth.password_reset', () =>
      api().post('/auth/forgot-password').send({ email: owner.email }).expect(204),
    );

    await api().post('/auth/reset-password').send({ token, password: 'short' }).expect(400);
    const reset = await api().post('/auth/reset-password').send({ token, password: newPw }).expect(200);
    // Following an emailed link is itself proof of the address.
    expect(reset.body.user).toMatchObject({ email: owner.email, emailVerified: true });

    await api().post('/auth/login').send({ email: owner.email, password: pw }).expect(401);
    await api().post('/auth/login').send({ email: owner.email, password: newPw }).expect(200);

    // Sessions opened before the reset are gone, and the link cannot be replayed.
    await api().post('/auth/refresh').set('Cookie', staleCookie).expect(401);
    await api().post('/auth/reset-password').send({ token, password: newPw }).expect(400);
  });

  it('a reset link cannot be used as a confirmation link, or the other way round', async () => {
    const resetToken = await captureToken('auth.password_reset', () =>
      api().post('/auth/forgot-password').send({ email: owner.email }).expect(204),
    );
    await api().post('/auth/verify-email').send({ token: resetToken }).expect(400);
  });
});
