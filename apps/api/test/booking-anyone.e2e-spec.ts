import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { addDays, localToUtc, todayIn } from '@reserivo/shared';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { approveBusiness } from './business.js';

/** "Anyone available": union of everyone's slots, and the server picks who. */
describe('Booking with anyone available (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const pw = 'correct horse battery';
  const LA = 'America/Los_Angeles';
  const owner = { email: `any-own-${stamp}@test.local`, password: pw, name: 'Olive Owner' };
  const designer = { email: `any-dsg-${stamp}@test.local`, password: pw, name: 'Dee Designer' };

  let ownerToken = '';
  let dsgToken = '';
  let salonId = '';
  let slug = '';
  let ownerMemberId = '';
  let dsgMemberId = '';
  let ownerCut = '';
  let dsgCut = '';
  let ownerColor = '';
  let D = '';

  const api = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const at = (minutes: number) => localToUtc(D, minutes, LA).toISOString();
  const guest = (n: number) => ({ name: `Guest ${n}`, email: `any-guest-${n}-${stamp}@test.local` });
  const bookAny = (minutes: number, n: number, serviceIds = [ownerCut, dsgCut]) =>
    api().post(`/public/salons/${slug}/appointments/any`).send({ serviceIds, startAt: at(minutes), customer: guest(n) });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    ownerToken = (await api().post('/auth/register').send(owner).expect(201)).body.accessToken;
    dsgToken = (await api().post('/auth/register').send(designer).expect(201)).body.accessToken;
    await approveBusiness(app, owner.email);
    slug = `any-${stamp}`;
    salonId = (await api().post('/salons').set(auth(ownerToken)).send({ name: 'Anyone Salon', slug, timezone: LA }).expect(201)).body.id;
    ownerMemberId = (await api().get(`/salons/${salonId}/members`).set(auth(ownerToken)).expect(200)).body[0].id;

    const inv = await api()
      .post(`/salons/${salonId}/invitations`)
      .set(auth(ownerToken))
      .send({ email: designer.email, roles: ['DESIGNER'] })
      .expect(201);
    await api().post(`/invitations/${inv.body.inviteUrl.split('/invite/')[1]}/accept`).set(auth(dsgToken)).expect(200);
    const members = (await api().get(`/salons/${salonId}/members`).set(auth(ownerToken)).expect(200)).body;
    dsgMemberId = members.find((m: { displayName: string }) => m.displayName === designer.name).id;

    // Hourly grid, open 9–17 every day, both people working all of it.
    await api().patch(`/salons/${salonId}`).set(auth(ownerToken)).send({ slotIntervalMin: 60 }).expect(200);
    const allWeek = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinutes: 540, endMinutes: 1020 }));
    await api().put(`/salons/${salonId}/hours/rules`).set(auth(ownerToken)).send({ rules: allWeek }).expect(200);
    for (const id of [ownerMemberId, dsgMemberId]) {
      await api().put(`/salons/${salonId}/members/${id}/availability/rules`).set(auth(ownerToken)).send({ rules: allWeek }).expect(200);
    }
    const service = async (designerId: string, body: object) =>
      (await api().post(`/salons/${salonId}/services`).set(auth(ownerToken)).send({ designerId, ...body }).expect(201)).body.id;
    ownerCut = await service(ownerMemberId, { name: 'Cut', priceCents: 6000, durationMin: 60 });
    dsgCut = await service(dsgMemberId, { name: 'Cut', priceCents: 4500, durationMin: 60 });
    ownerColor = await service(ownerMemberId, { name: 'Color', priceCents: 12000, durationMin: 120 });

    D = addDays(todayIn(LA), 7);
  });

  afterAll(async () => {
    await app.close();
  });

  it('offers every hour at which anyone is free', async () => {
    // Block the owner at 10:00 by booking them directly.
    await api()
      .post(`/public/salons/${slug}/appointments`)
      .send({ designerId: ownerMemberId, serviceId: ownerCut, startAt: at(600), customer: guest(0) })
      .expect(201);

    const own = await api().get(`/public/salons/${slug}/availability`).query({ designerId: ownerMemberId, serviceId: ownerCut, from: D, days: 1 }).expect(200);
    expect(own.body.days[0].slots.map((s: { startAt: string }) => s.startAt)).not.toContain(at(600));

    const any = await api()
      .get(`/public/salons/${slug}/availability/any`)
      .query({ serviceIds: `${ownerCut},${dsgCut}`, from: D, days: 1 })
      .expect(200);
    const starts = any.body.days[0].slots.map((s: { startAt: string }) => s.startAt);
    // Dee is free at 10:00 even though Olive is not, and every hour is listed once.
    expect(starts).toContain(at(600));
    expect(new Set(starts).size).toBe(starts.length);
  });

  it('gives the booking to whoever is free, and to the lighter day when both are', async () => {
    // 10:00: only Dee is free.
    const first = await bookAny(600, 1).expect(201);
    expect(first.body).toMatchObject({ designerId: dsgMemberId, priceCents: 4500 });

    // 13:00: both free, each has one hour booked; ties keep the page's order, so Olive.
    const second = await bookAny(780, 2).expect(201);
    expect(second.body).toMatchObject({ designerId: ownerMemberId, priceCents: 6000 });

    // 15:00: both free again, Olive now has two hours to Dee's one, so Dee.
    const third = await bookAny(900, 3).expect(201);
    expect(third.body.designerId).toBe(dsgMemberId);
  });

  it('refuses a time nobody is free at', async () => {
    // 10:00: Olive booked directly, Dee booked through "anyone".
    await bookAny(600, 4).expect(409);
  });

  it('refuses two services of the same person, an unknown service, and a malformed list', async () => {
    await bookAny(660, 5, [ownerCut, ownerColor]).expect(400);
    await bookAny(660, 6, [ownerCut, '00000000-0000-4000-8000-000000000000']).expect(404);
    await api().get(`/public/salons/${slug}/availability/any`).query({ serviceIds: 'nope', from: D }).expect(400);
  });
});
