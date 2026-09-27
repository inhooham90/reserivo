import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  addDays,
  bayesianStars,
  localToUtc,
  RATING_COUNT_VISIBLE_FROM,
  RATING_PRIOR_STARS,
  todayIn,
  type AvailabilityResponse,
} from '@reserivo/shared';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { approveBusiness } from './business.js';

const LA = 'America/Los_Angeles';

/**
 * Client ratings of designers.
 *
 * The scoring maths is pinned in src/ratings/rating.spec.ts; what matters here
 * is who is allowed to rate at all. A rating is a public number on someone's
 * livelihood, so the rule — you may rate a designer once they have finished a
 * service for you, and you get one voice — is checked end to end rather than
 * trusted to the service layer.
 */
describe('Designer ratings (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const pw = 'correct horse battery';
  const owner = { email: `rate-owner-${stamp}@test.local`, password: pw, name: 'Ora Owner' };

  let ownerToken = '';
  let salonId = '';
  let slug = '';
  let designerId = '';
  let serviceId = '';

  const api = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const at = (date: string, minutes: number) => localToUtc(date, minutes, LA).toISOString();

  /** A signed-in client booking themselves, which is what links them to the salon's customer record. */
  const bookAsClient = async (token: string, name: string, email: string, date: string, minutes: number) => {
    const res = await api()
      .post(`/public/salons/${slug}/appointments`)
      .set(auth(token))
      .send({ designerId, serviceId, startAt: at(date, minutes), customer: { name, email } })
      .expect(201);
    return res.body.id as string;
  };

  /**
   * Walks an appointment into the past and marks it done. Public booking will
   * not create a past appointment and an appointment cannot be completed before
   * it starts, so this is the only honest way to produce a finished visit.
   */
  const completeIt = async (appointmentId: string) => {
    const yesterday = addDays(todayIn(LA), -1);
    await api()
      .patch(`/salons/${salonId}/appointments/${appointmentId}`)
      .set(auth(ownerToken))
      .send({ startAt: at(yesterday, 600) })
      .expect(200);
    await api()
      .patch(`/salons/${salonId}/appointments/${appointmentId}`)
      .set(auth(ownerToken))
      .send({ status: 'COMPLETED' })
      .expect(200);
  };

  /** Registers a client, books them a visit and completes it. Returns their token. */
  const clientWhoHasVisited = async (label: string, date: string, minutes: number) => {
    const email = `rate-${label}-${stamp}@test.local`;
    const token = (await api().post('/auth/register').send({ email, password: pw, name: label }).expect(201)).body
      .accessToken as string;
    const appointmentId = await bookAsClient(token, label, email, date, minutes);
    await completeIt(appointmentId);
    return token;
  };

  const publicDesigner = async () => {
    const res = await api().get(`/salons/by-slug/${slug}`).expect(200);
    return res.body.designers.find((d: { id: string }) => d.id === designerId) as {
      rating: { stars: number; count: number | null };
    };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    ownerToken = (await api().post('/auth/register').send(owner).expect(201)).body.accessToken;
    await approveBusiness(app, owner.email);
    slug = `ratings-${stamp}`;
    salonId = (
      await api().post('/salons').set(auth(ownerToken)).send({ name: 'Rated Salon', slug, timezone: LA }).expect(201)
    ).body.id;
    designerId = (await api().get(`/salons/${salonId}/members`).set(auth(ownerToken)).expect(200)).body[0].id;

    await api().patch(`/salons/${salonId}`).set(auth(ownerToken)).send({ slotIntervalMin: 60 }).expect(200);
    const allWeek = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinutes: 540, endMinutes: 1020 }));
    await api().put(`/salons/${salonId}/hours/rules`).set(auth(ownerToken)).send({ rules: allWeek }).expect(200);
    await api()
      .put(`/salons/${salonId}/members/${designerId}/availability/rules`)
      .set(auth(ownerToken))
      .send({ rules: allWeek })
      .expect(200);

    serviceId = (
      await api()
        .post(`/salons/${salonId}/services`)
        .set(auth(ownerToken))
        .send({ designerId, name: 'Cut', priceCents: 5000, durationMin: 60 })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------- Before anyone has rated ----------

  it('gives a designer the prior score and no count before anyone has rated', async () => {
    const designer = await publicDesigner();
    expect(designer.rating).toEqual({ stars: RATING_PRIOR_STARS, count: null });
  });

  // ---------- Who may rate ----------

  it('refuses a client who has never booked with the designer', async () => {
    const stranger = (
      await api()
        .post('/auth/register')
        .send({ email: `rate-stranger-${stamp}@test.local`, password: pw, name: 'Stranger' })
        .expect(201)
    ).body.accessToken;

    const res = await api().put(`/me/ratings/${designerId}`).set(auth(stranger)).send({ stars: 5 }).expect(403);
    expect(res.body.message).toMatch(/finished a service for you/i);
  });

  it('refuses a client whose appointment has not been completed yet', async () => {
    const email = `rate-pending-${stamp}@test.local`;
    const token = (
      await api().post('/auth/register').send({ email, password: pw, name: 'Pending' }).expect(201)
    ).body.accessToken;
    // Booked, but the visit has not happened.
    await bookAsClient(token, 'Pending', email, addDays(todayIn(LA), 3), 600);

    await api().put(`/me/ratings/${designerId}`).set(auth(token)).send({ stars: 5 }).expect(403);
  });

  it('refuses an unknown designer', async () => {
    await api()
      .put(`/me/ratings/11111111-1111-4111-8111-111111111111`)
      .set(auth(ownerToken))
      .send({ stars: 5 })
      .expect(404);
  });

  it('requires a signed-in client', async () => {
    await api().put(`/me/ratings/${designerId}`).send({ stars: 5 }).expect(401);
  });

  // ---------- Rating ----------

  it('accepts a rating once the visit is finished, and moves the score by the prior-weighted amount', async () => {
    const token = await clientWhoHasVisited('first', addDays(todayIn(LA), 4), 600);

    const res = await api().put(`/me/ratings/${designerId}`).set(auth(token)).send({ stars: 5 }).expect(200);
    expect(res.body).toMatchObject({ designerId, stars: 5 });

    // One 5 against a prior of ten 4s.
    const designer = await publicDesigner();
    expect(designer.rating.stars).toBe(bayesianStars(1, 5));
    expect(designer.rating.count).toBeNull();
  });

  it('replaces rather than stacks when the same client rates again', async () => {
    const token = await clientWhoHasVisited('repeat', addDays(todayIn(LA), 5), 600);

    await api().put(`/me/ratings/${designerId}`).set(auth(token)).send({ stars: 1 }).expect(200);
    const afterOne = await publicDesigner();
    await api().put(`/me/ratings/${designerId}`).set(auth(token)).send({ stars: 5 }).expect(200);
    const afterFive = await publicDesigner();

    // Two clients have rated: the first a 5, this one now a 5 as well. If the
    // second rating had stacked instead of replacing, the count would be three.
    expect(afterFive.rating.stars).toBe(bayesianStars(2, 10));
    expect(afterFive.rating.stars).toBeGreaterThan(afterOne.rating.stars);

    const mine = await api().get('/me/ratings').set(auth(token)).expect(200);
    expect(mine.body.filter((r: { designerId: string }) => r.designerId === designerId)).toHaveLength(1);
  });

  it('rejects stars outside one to five', async () => {
    const token = await clientWhoHasVisited('range', addDays(todayIn(LA), 6), 600);
    for (const stars of [0, 6, 2.5, -1]) {
      await api().put(`/me/ratings/${designerId}`).set(auth(token)).send({ stars }).expect(400);
    }
  });

  // ---------- What the booking page shows ----------

  it('reveals the count once enough clients have rated', async () => {
    // Two have rated already; top up to the threshold.
    const before = await publicDesigner();
    expect(before.rating.count).toBeNull();

    for (let i = 0; i < RATING_COUNT_VISIBLE_FROM - 2; i++) {
      const token = await clientWhoHasVisited(`bulk${i}`, addDays(todayIn(LA), 7 + i), 600);
      await api().put(`/me/ratings/${designerId}`).set(auth(token)).send({ stars: 5 }).expect(200);
    }

    const after = await publicDesigner();
    expect(after.rating.count).toBe(RATING_COUNT_VISIBLE_FROM);
    expect(after.rating.stars).toBe(bayesianStars(RATING_COUNT_VISIBLE_FROM, RATING_COUNT_VISIBLE_FROM * 5));
  });

  it('never exposes who rated what', async () => {
    const res = await api().get(`/salons/by-slug/${slug}`).expect(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('customerId');
    expect(body).not.toContain('@test.local');
  });
});
