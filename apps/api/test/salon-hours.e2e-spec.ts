import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { addDays, todayIn, weekdayOf } from '@reserivo/shared';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

const LA = 'America/Los_Angeles';

/** Salon opening hours: shared by managers, a hard boundary for designers. */
describe('Salon hours (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const pw = 'correct horse battery';
  const manager = { email: `sh-mgr-${stamp}@test.local`, password: pw, name: 'Mara Manager' };
  const designer = { email: `sh-dsg-${stamp}@test.local`, password: pw, name: 'Dee Designer' };

  let mgrToken = '';
  let dsgToken = '';
  let salonId = '';
  let slug = '';
  let mgrMemberId = '';
  let dsgMemberId = '';
  let serviceId = '';
  /** The first Tuesday at least a week out, in salon time. */
  let TUE = '';

  const api = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const mins = (slots: { startMinutes: number }[]) => slots.map((s) => s.startMinutes);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    mgrToken = (await api().post('/auth/register').send(manager).expect(201)).body.accessToken;
    dsgToken = (await api().post('/auth/register').send(designer).expect(201)).body.accessToken;

    slug = `hours-${stamp}`;
    salonId = (await api().post('/salons').set(auth(mgrToken)).send({ name: 'Hours Salon', slug, timezone: LA, takesAppointments: false }).expect(201)).body.id;
    mgrMemberId = (await api().get(`/salons/${salonId}/members`).set(auth(mgrToken)).expect(200)).body[0].id;
    await api().patch(`/salons/${salonId}`).set(auth(mgrToken)).send({ slotIntervalMin: 60 }).expect(200);

    const inv = await api()
      .post(`/salons/${salonId}/invitations`)
      .set(auth(mgrToken))
      .send({ email: designer.email, roles: ['DESIGNER'] })
      .expect(201);
    dsgMemberId = (
      await api().post(`/invitations/${inv.body.inviteUrl.split('/invite/')[1]}/accept`).set(auth(dsgToken)).expect(200)
    ).body.membershipId;

    serviceId = (
      await api()
        .post(`/salons/${salonId}/services`)
        .set(auth(dsgToken))
        .send({ name: 'Cut', priceCents: 5000, durationMin: 60 })
        .expect(201)
    ).body.id;

    TUE = addDays(todayIn(LA), 7);
    while (weekdayOf(TUE) !== 2) TUE = addDays(TUE, 1);
  });

  afterAll(async () => {
    await app.close();
  });

  const designerSlots = async () =>
    mins(
      (
        await api()
          .get(`/public/salons/${slug}/availability`)
          .query({ designerId: dsgMemberId, serviceId, from: TUE, days: 1 })
          .expect(200)
      ).body.days[0].slots,
    );

  it('a new salon opens Mon–Sat 9–18 by default, visible to every member and on the public page', async () => {
    const res = await api().get(`/salons/${salonId}/hours`).set(auth(dsgToken)).expect(200);
    expect(res.body.rules).toHaveLength(6);
    expect(res.body.rules.map((r: { weekday: number }) => r.weekday)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(res.body.rules[0]).toMatchObject({ startMinutes: 540, endMinutes: 1080 });

    const pub = await api().get(`/salons/by-slug/${slug}`).expect(200);
    expect(pub.body.hours).toHaveLength(6);
  });

  it('only managers edit salon hours', async () => {
    await api()
      .put(`/salons/${salonId}/hours/rules`)
      .set(auth(dsgToken))
      .send({ rules: [{ weekday: 2, startMinutes: 540, endMinutes: 1080 }] })
      .expect(403);
  });

  it('a manager-only member has no personal schedule', async () => {
    const res = await api().get(`/salons/${salonId}/members/${mgrMemberId}/availability`).set(auth(mgrToken)).expect(409);
    expect(res.body.message).toMatch(/does not take appointments/);
    await api()
      .put(`/salons/${salonId}/members/${mgrMemberId}/availability/rules`)
      .set(auth(mgrToken))
      .send({ rules: [{ weekday: 2, startMinutes: 600, endMinutes: 900 }] })
      .expect(409);
  });

  it('a designer’s hours must fit inside the salon’s', async () => {
    const early = await api()
      .put(`/salons/${salonId}/members/${dsgMemberId}/availability/rules`)
      .set(auth(dsgToken))
      .send({ rules: [{ weekday: 2, startMinutes: 480, endMinutes: 720 }] }) // 8:00 start, salon opens 9
      .expect(400);
    expect(early.body.message).toMatch(/Tuesday 08:00–12:00 is outside salon hours \(09:00–18:00\)/);

    const sunday = await api()
      .put(`/salons/${salonId}/members/${dsgMemberId}/availability/rules`)
      .set(auth(dsgToken))
      .send({ rules: [{ weekday: 0, startMinutes: 600, endMinutes: 900 }] })
      .expect(400);
    expect(sunday.body.message).toMatch(/Sunday .* \(closed\)/);

    const ok = await api()
      .put(`/salons/${salonId}/members/${dsgMemberId}/availability/rules`)
      .set(auth(dsgToken))
      .send({ rules: [{ weekday: 2, startMinutes: 600, endMinutes: 960 }] }) // Tue 10–16
      .expect(200);
    expect(ok.body).toHaveLength(1);
    expect(await designerSlots()).toEqual([600, 660, 720, 780, 840, 900]);
  });

  it('shrinking salon hours clamps existing designer hours at booking time', async () => {
    await api()
      .put(`/salons/${salonId}/hours/rules`)
      .set(auth(mgrToken))
      .send({ rules: [{ weekday: 2, startMinutes: 660, endMinutes: 840 }] }) // Tue 11–14 only
      .expect(200);
    expect(await designerSlots()).toEqual([660, 720, 780]); // designer's 10–16 ∩ salon's 11–14

    // The owner takes the chair now: their hours are seeded from the *current* salon hours (Tue 11–14 only).
    await api().patch(`/salons/${salonId}/members/${mgrMemberId}`).set(auth(mgrToken)).send({ roles: ['MANAGER', 'DESIGNER'] }).expect(200);
    const seeded = await api().get(`/salons/${salonId}/members/${mgrMemberId}/availability`).set(auth(mgrToken)).expect(200);
    expect(seeded.body.rules).toEqual([expect.objectContaining({ weekday: 2, startMinutes: 660, endMinutes: 840 })]);
    const mgrService = (
      await api()
        .post(`/salons/${salonId}/services`)
        .set(auth(mgrToken))
        .send({ name: 'Owner cut', priceCents: 7000, durationMin: 60 })
        .expect(201)
    ).body.id;
    const res = await api()
      .get(`/public/salons/${slug}/availability`)
      .query({ designerId: mgrMemberId, serviceId: mgrService, from: TUE, days: 1 })
      .expect(200);
    expect(mins(res.body.days[0].slots)).toEqual([660, 720, 780]);
  });

  it('a salon closure empties everyone’s day; a designer custom day cannot exceed the salon’s', async () => {
    const closure = await api()
      .post(`/salons/${salonId}/hours/exceptions`)
      .set(auth(mgrToken))
      .send({ date: TUE, type: 'OFF', note: 'Inventory day' })
      .expect(201);
    expect(await designerSlots()).toEqual([]);
    await api().delete(`/salons/${salonId}/hours/exceptions/${closure.body.id}`).set(auth(mgrToken)).expect(204);
    expect(await designerSlots()).toEqual([660, 720, 780]);

    const tooLate = await api()
      .post(`/salons/${salonId}/members/${dsgMemberId}/availability/exceptions`)
      .set(auth(dsgToken))
      .send({ date: TUE, type: 'CUSTOM', startMinutes: 660, endMinutes: 1020 }) // until 17, salon closes 14
      .expect(400);
    expect(tooLate.body.message).toMatch(/outside the salon's hours/);

    await api()
      .post(`/salons/${salonId}/members/${dsgMemberId}/availability/exceptions`)
      .set(auth(dsgToken))
      .send({ date: TUE, type: 'CUSTOM', startMinutes: 720, endMinutes: 840 })
      .expect(201);
    expect(await designerSlots()).toEqual([720, 780]);
  });
});
