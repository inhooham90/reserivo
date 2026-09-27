import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { addDays, localToUtc, todayIn } from '@reserivo/shared';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { approveBusiness } from './business.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';

const LA = 'America/Los_Angeles';

/** Phase 2: availability, online booking, customer self-service, staff calendar, double-booking guard. */
describe('Phase 2 (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const pw = 'correct horse battery';
  const manager = { email: `p2mgr-${stamp}@test.local`, password: pw, name: 'Mara Manager' };
  const designer = { email: `p2dsg-${stamp}@test.local`, password: pw, name: 'Dee Designer' };
  const client = { email: `p2cli-${stamp}@test.local`, password: pw, name: 'Cleo Client' };
  const guestEmail = `p2guest-${stamp}@test.local`;

  let mgrToken = '';
  let dsgToken = '';
  let cliToken = '';
  let salonId = '';
  let slug = '';
  let mgrMemberId = '';
  let cutId = '';
  let colorId = '';
  /** A date a week out, in salon time — far enough that lead time never interferes. */
  let D = '';
  const at = (minutes: number, date = D) => localToUtc(date, minutes, LA).toISOString();

  let guestApptId = '';
  let clientApptId = '';
  let staffApptId = '';

  const api = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    mgrToken = (await api().post('/auth/register').send(manager).expect(201)).body.accessToken;
    dsgToken = (await api().post('/auth/register').send(designer).expect(201)).body.accessToken;
    cliToken = (await api().post('/auth/register').send(client).expect(201)).body.accessToken;

    await approveBusiness(app, manager.email);
    slug = `phase2-${stamp}`;
    salonId = (
      await api().post('/salons').set(auth(mgrToken)).send({ name: 'Phase Two Salon', slug, timezone: LA }).expect(201)
    ).body.id;
    mgrMemberId = (await api().get(`/salons/${salonId}/members`).set(auth(mgrToken)).expect(200)).body[0].id;

    // Bring a designer in through the real invite flow.
    const inv = await api()
      .post(`/salons/${salonId}/invitations`)
      .set(auth(mgrToken))
      .send({ email: designer.email, roles: ['DESIGNER'] })
      .expect(201);
    const token = inv.body.inviteUrl.split('/invite/')[1];
    await api().post(`/invitations/${token}/accept`).set(auth(dsgToken)).expect(200);

    // Hourly grid keeps the slot assertions readable; the default is 15 minutes.
    await api().patch(`/salons/${salonId}`).set(auth(mgrToken)).send({ slotIntervalMin: 60 }).expect(200);

    // The salon opens 9–17 every day, and so does the owner-stylist (creator defaults to MANAGER + DESIGNER).
    const allWeek = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinutes: 540, endMinutes: 1020 }));
    await api().put(`/salons/${salonId}/hours/rules`).set(auth(mgrToken)).send({ rules: allWeek }).expect(200);
    await api().put(`/salons/${salonId}/members/${mgrMemberId}/availability/rules`).set(auth(mgrToken)).send({ rules: allWeek }).expect(200);
    cutId = (
      await api()
        .post(`/salons/${salonId}/services`)
        .set(auth(mgrToken))
        .send({ designerId: mgrMemberId, name: 'Cut', priceCents: 5000, durationMin: 60 })
        .expect(201)
    ).body.id;
    colorId = (
      await api()
        .post(`/salons/${salonId}/services`)
        .set(auth(mgrToken))
        .send({ designerId: mgrMemberId, name: 'Color', priceCents: 12000, durationMin: 120, bufferMin: 15 })
        .expect(201)
    ).body.id;

    D = addDays(todayIn(LA), 7);
  });

  afterAll(async () => {
    await app.close();
  });

  const publicSlots = async (serviceId = cutId, from = D, days = 1) =>
    (
      await api()
        .get(`/public/salons/${slug}/availability`)
        .query({ designerId: mgrMemberId, serviceId, from, days })
        .expect(200)
    ).body;

  // ---------- Availability ----------

  it('offers hourly slots 9:00–16:00 for a 60-minute service on a 9–17 day', async () => {
    const res = await publicSlots();
    expect(res.timezone).toBe(LA);
    expect(res.days).toHaveLength(1);
    expect(res.days[0].date).toBe(D);
    expect(res.days[0].slots.map((s: { startMinutes: number }) => s.startMinutes)).toEqual([540, 600, 660, 720, 780, 840, 900, 960]);
    expect(res.days[0].slots[0].startAt).toBe(at(540));
  });

  it('clamps the public range to the salon’s maxAdvanceDays', async () => {
    await api().patch(`/salons/${salonId}`).set(auth(mgrToken)).send({ maxAdvanceDays: 3 }).expect(200);
    expect((await publicSlots()).days).toEqual([]);
    await api().patch(`/salons/${salonId}`).set(auth(mgrToken)).send({ maxAdvanceDays: 60 }).expect(200);
  });

  it('rejects a bad availability query', async () => {
    await api().get(`/public/salons/${slug}/availability`).query({ designerId: 'nope', serviceId: cutId, from: D }).expect(400);
    await api().get(`/public/salons/nosuchsalon/availability`).query({ designerId: mgrMemberId, serviceId: cutId, from: D }).expect(404);
  });

  // ---------- Online booking ----------

  it('a guest books 10:00 and the slot disappears', async () => {
    const res = await api()
      .post(`/public/salons/${slug}/appointments`)
      .send({
        designerId: mgrMemberId,
        serviceId: cutId,
        startAt: at(600),
        customer: { name: 'Gia Guest', email: guestEmail.toUpperCase(), phone: '(555) 010-2020' },
        notes: 'First visit',
      })
      .expect(201);
    expect(res.body).toMatchObject({
      status: 'CONFIRMED',
      startAt: at(600),
      endAt: at(660),
      serviceName: 'Cut',
      priceCents: 5000,
      designerName: manager.name,
      salon: { slug, timezone: LA },
      notes: 'First visit',
    });
    expect(res.body.cancellableUntil).toEqual(expect.any(String));
    guestApptId = res.body.id;

    const slots = (await publicSlots()).days[0].slots.map((s: { startMinutes: number }) => s.startMinutes);
    expect(slots).not.toContain(600);
    expect(slots).toContain(540); // 9:00–10:00 touches but does not overlap
  });

  it('refuses the same slot again, and any start not on the offered grid', async () => {
    const body = (startAt: string) => ({
      designerId: mgrMemberId,
      serviceId: cutId,
      startAt,
      customer: { name: 'Second', email: `second-${stamp}@test.local` },
    });
    await api().post(`/public/salons/${slug}/appointments`).send(body(at(600))).expect(409);
    await api().post(`/public/salons/${slug}/appointments`).send(body(at(607))).expect(409);
    await api().post(`/public/salons/${slug}/appointments`).send(body(at(1200))).expect(409); // after hours
  });

  it('a 2-hour service with buffer is offered only where it fits', async () => {
    // 10:00–11:00 is taken. Color is 120 + 15 buffer, so 8:00 is not a slot (before open),
    // 9:00 would run to 11:00 and clash with 10:00, 11:00 → 13:15 is fine.
    const slots = (await publicSlots(colorId)).days[0].slots.map((s: { startMinutes: number }) => s.startMinutes);
    expect(slots).not.toContain(540);
    expect(slots).toContain(660);
    expect(slots.at(-1)).toBe(900); // 15:00 → 17:00 fits; buffer to 17:15 may spill past close
  });

  it('a signed-in customer’s booking links to their account', async () => {
    const res = await api()
      .post(`/public/salons/${slug}/appointments`)
      .set(auth(cliToken))
      .send({ designerId: mgrMemberId, serviceId: cutId, startAt: at(720), customer: { name: client.name, email: client.email } })
      .expect(201);
    clientApptId = res.body.id;

    const mine = await api().get('/me/appointments').set(auth(cliToken)).expect(200);
    expect(mine.body.map((a: { id: string }) => a.id)).toEqual([clientApptId]);
  });

  it('a guest who registers must confirm the address before their booking appears', async () => {
    const spy = vi.spyOn(app.get(NotificationsService), 'emit');
    const reg = await api().post('/auth/register').send({ email: guestEmail, password: pw, name: 'Gia Guest' }).expect(201);
    expect(reg.body.user.emailVerified).toBe(false);

    // Signing up with an address proves nothing about owning it, so nothing is linked yet.
    const before = await api().get('/me/appointments').set(auth(reg.body.accessToken)).expect(200);
    expect(before.body).toEqual([]);

    const sent = spy.mock.calls.map((c) => c[0]).find((e) => e.type === 'auth.verify_email');
    spy.mockRestore();
    if (!sent || !('link' in sent.data)) throw new Error('no confirmation email was sent');
    const token = new URL(sent.data.link).searchParams.get('token');

    const verified = await api().post('/auth/verify-email').send({ token }).expect(200);
    expect(verified.body.user.emailVerified).toBe(true);
    const mine = await api().get('/me/appointments').set(auth(verified.body.accessToken)).expect(200);
    expect(mine.body.map((a: { id: string }) => a.id)).toEqual([guestApptId]);
  });

  it('customers can only cancel their own appointments, within the window', async () => {
    await api().post(`/me/appointments/${guestApptId}/cancel`).set(auth(cliToken)).expect(404);

    // Widen the window past the booking: 14 days > 7 days out → already too late to self-cancel.
    await api().patch(`/salons/${salonId}`).set(auth(mgrToken)).send({ cancelWindowHours: 24 * 14 }).expect(200);
    const late = await api().post(`/me/appointments/${clientApptId}/cancel`).set(auth(cliToken)).expect(409);
    expect(late.body.message).toMatch(/contact the business/i);
    await api().patch(`/salons/${salonId}`).set(auth(mgrToken)).send({ cancelWindowHours: 24 }).expect(200);

    const ok = await api().post(`/me/appointments/${clientApptId}/cancel`).set(auth(cliToken)).expect(200);
    expect(ok.body).toMatchObject({ status: 'CANCELLED', cancellableUntil: null });
    await api().post(`/me/appointments/${clientApptId}/cancel`).set(auth(cliToken)).expect(409);

    // The freed slot is offered again.
    const slots = (await publicSlots()).days[0].slots.map((s: { startMinutes: number }) => s.startMinutes);
    expect(slots).toContain(720);
  });

  // ---------- Staff ----------

  it('managers see customer contact on the calendar; designers see names only', async () => {
    const q = { from: D, to: D };
    const asMgr = await api().get(`/salons/${salonId}/appointments`).set(auth(mgrToken)).query(q).expect(200);
    const guest = asMgr.body.find((a: { id: string }) => a.id === guestApptId);
    expect(guest.customer).toMatchObject({ name: 'Gia Guest', email: guestEmail, phone: '(555) 010-2020' });
    expect(guest.source).toBe('ONLINE');

    const asDsg = await api().get(`/salons/${salonId}/appointments`).set(auth(dsgToken)).query(q).expect(200);
    const seen = asDsg.body.find((a: { id: string }) => a.id === guestApptId);
    expect(seen.customer).toEqual({ id: guest.customer.id, name: 'Gia Guest' });
    expect(JSON.stringify(asDsg.body)).not.toContain('@test.local');
  });

  it('staff book a walk-in outside published hours; the DB refuses an overlap', async () => {
    const first = await api()
      .post(`/salons/${salonId}/appointments`)
      .set(auth(mgrToken))
      .send({
        designerId: mgrMemberId,
        serviceId: cutId,
        startAt: at(1140), // 19:00, after closing — staff may
        customer: { name: 'Wally Walk-in', phone: '555-333-4444' },
        internalNotes: 'Regular, prefers #2 guard',
      })
      .expect(201);
    expect(first.body).toMatchObject({ source: 'STAFF', status: 'CONFIRMED', internalNotes: 'Regular, prefers #2 guard' });
    staffApptId = first.body.id;

    // Staff skip the slot engine, so this overlap reaches the exclusion constraint itself.
    const clash = await api()
      .post(`/salons/${salonId}/appointments`)
      .set(auth(mgrToken))
      .send({ designerId: mgrMemberId, serviceId: cutId, startAt: at(1170), customerId: first.body.customer.id })
      .expect(409);
    expect(clash.body.message).toMatch(/just taken/i);
  });

  it('a designer cannot book on the manager’s calendar', async () => {
    await api()
      .post(`/salons/${salonId}/appointments`)
      .set(auth(dsgToken))
      .send({ designerId: mgrMemberId, serviceId: cutId, startAt: at(900), customer: { name: 'X' } })
      .expect(403);
  });

  it('rescheduling re-checks the constraint; status changes follow the lifecycle', async () => {
    await api()
      .patch(`/salons/${salonId}/appointments/${staffApptId}`)
      .set(auth(mgrToken))
      .send({ startAt: at(600) }) // guest holds 10:00
      .expect(409);
    const moved = await api()
      .patch(`/salons/${salonId}/appointments/${staffApptId}`)
      .set(auth(mgrToken))
      .send({ startAt: at(900) })
      .expect(200);
    expect(moved.body).toMatchObject({ startAt: at(900), endAt: at(960) });

    // Completing is gated on the start time, so walk it back into the past first.
    await api()
      .patch(`/salons/${salonId}/appointments/${staffApptId}`)
      .set(auth(mgrToken))
      .send({ startAt: at(900, addDays(todayIn(LA), -1)) })
      .expect(200);
    await api()
      .patch(`/salons/${salonId}/appointments/${staffApptId}`)
      .set(auth(mgrToken))
      .send({ status: 'COMPLETED' })
      .expect(200);
    const dead = await api()
      .patch(`/salons/${salonId}/appointments/${staffApptId}`)
      .set(auth(mgrToken))
      .send({ status: 'CANCELLED' })
      .expect(409);
    expect(dead.body.message).toMatch(/completed/i);
  });

  it('customer search hides contact fields from designers and dedupes by email', async () => {
    const mgr = await api().get(`/salons/${salonId}/customers`).set(auth(mgrToken)).query({ q: 'wally' }).expect(200);
    expect(mgr.body).toHaveLength(1);
    expect(mgr.body[0]).toMatchObject({ name: 'Wally Walk-in', phone: '555-333-4444', hasAccount: false });

    const dsg = await api().get(`/salons/${salonId}/customers`).set(auth(dsgToken)).query({ q: 'wally' }).expect(200);
    // Designers see the salon's shared knowledge (notes, tags) but never contact fields.
    expect(dsg.body[0]).toMatchObject({ id: mgr.body[0].id, name: 'Wally Walk-in', hasAccount: false, tags: [] });
    expect(dsg.body[0].phone).toBeUndefined();
    expect(dsg.body[0].email).toBeUndefined();

    const dup = await api()
      .post(`/salons/${salonId}/customers`)
      .set(auth(mgrToken))
      .send({ name: 'Gia Again', email: guestEmail })
      .expect(201);
    expect(dup.body.name).toBe('Gia Guest'); // existing record returned, not duplicated
    expect(dup.body.hasAccount).toBe(true); // linked when she registered
  });

  it('a service with upcoming appointments cannot be deleted', async () => {
    const res = await api().delete(`/salons/${salonId}/services/${cutId}`).set(auth(mgrToken)).expect(409);
    expect(res.body.message).toMatch(/deactivate/i);
  });

  it('a no-show waits out the grace period, and is the one final state that can be undone', async () => {
    // The guest booking is a week out — nobody can have missed it yet.
    const early = await api()
      .patch(`/salons/${salonId}/appointments/${guestApptId}`)
      .set(auth(mgrToken))
      .send({ status: 'NO_SHOW' })
      .expect(409);
    expect(early.body.message).toMatch(/15 minutes after the start time/);

    // Staff may record something that already happened, and that one can be marked.
    const yesterday = addDays(todayIn(LA), -1);
    const appt = (
      await api()
        .post(`/salons/${salonId}/appointments`)
        .set(auth(mgrToken))
        .send({
          designerId: mgrMemberId,
          serviceId: cutId,
          startAt: localToUtc(yesterday, 600, LA).toISOString(),
          customer: { name: 'Yesterday Guest' },
        })
        .expect(201)
    ).body;

    const marked = await api().patch(`/salons/${salonId}/appointments/${appt.id}`).set(auth(mgrToken)).send({ status: 'NO_SHOW' }).expect(200);
    expect(marked.body.status).toBe('NO_SHOW');

    const undone = await api().patch(`/salons/${salonId}/appointments/${appt.id}`).set(auth(mgrToken)).send({ status: 'CONFIRMED' }).expect(200);
    expect(undone.body.status).toBe('CONFIRMED');

    // Every other final state stays final.
    await api().patch(`/salons/${salonId}/appointments/${appt.id}`).set(auth(mgrToken)).send({ status: 'COMPLETED' }).expect(200);
    const reopen = await api().patch(`/salons/${salonId}/appointments/${appt.id}`).set(auth(mgrToken)).send({ status: 'CONFIRMED' }).expect(409);
    expect(reopen.body.message).toMatch(/completed/i);
  });
});
