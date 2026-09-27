import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { addDays, localToUtc, todayIn, type AvailabilityResponse } from '@reserivo/shared';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { approveBusiness } from './business.js';

const LA = 'America/Los_Angeles';

/**
 * Double booking, opt-in per service, and the gate on completing an
 * appointment before it has started.
 *
 * Two layers decide who may overlap whom, and they deliberately disagree:
 *   - the database refuses an overlap only when *neither* side is sharable;
 *   - the slot engine, which only public booking goes through, also refuses to
 *     put anything on top of a hands-on appointment, and caps the stack at two.
 */
describe('Double booking (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const pw = 'correct horse battery';
  const owner = { email: `db-owner-${stamp}@test.local`, password: pw, name: 'Otto Owner' };

  let token = '';
  let salonId = '';
  let slug = '';
  let memberId = '';
  let cutId = '';
  let colorId = '';
  /** Dates far enough out that lead time never interferes; one per scenario. */
  let D1 = '';
  let D2 = '';
  /** Already started, so the payment tests can complete it. */
  let paidApptId = '';

  const api = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const at = (date: string, minutes: number) => localToUtc(date, minutes, LA).toISOString();

  const bookStaff = (serviceId: string, startAt: string, name: string) =>
    api()
      .post(`/salons/${salonId}/appointments`)
      .set(auth())
      .send({ designerId: memberId, serviceId, startAt, customer: { name } });

  /** Local start minutes offered to a customer for a service on one date. */
  const publicSlots = async (serviceId: string, date: string): Promise<number[]> => {
    const res = await api()
      .get(`/public/salons/${slug}/availability`)
      .query({ designerId: memberId, serviceId, from: date, days: 1 })
      .expect(200);
    const body = res.body as AvailabilityResponse;
    return body.days[0]?.slots.map((s) => s.startMinutes) ?? [];
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    token = (await api().post('/auth/register').send(owner).expect(201)).body.accessToken;
    await approveBusiness(app, owner.email);
    slug = `double-booking-${stamp}`;
    salonId = (await api().post('/salons').set(auth()).send({ name: 'Double Salon', slug, timezone: LA }).expect(201))
      .body.id;
    memberId = (await api().get(`/salons/${salonId}/members`).set(auth()).expect(200)).body[0].id;

    // An hourly grid keeps the slot assertions readable.
    await api().patch(`/salons/${salonId}`).set(auth()).send({ slotIntervalMin: 60 }).expect(200);
    const allWeek = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinutes: 540, endMinutes: 1020 }));
    await api().put(`/salons/${salonId}/hours/rules`).set(auth()).send({ rules: allWeek }).expect(200);
    await api()
      .put(`/salons/${salonId}/members/${memberId}/availability/rules`)
      .set(auth())
      .send({ rules: allWeek })
      .expect(200);

    cutId = (
      await api()
        .post(`/salons/${salonId}/services`)
        .set(auth())
        .send({ designerId: memberId, name: 'Cut', priceCents: 5000, durationMin: 60 })
        .expect(201)
    ).body.id;
    colorId = (
      await api()
        .post(`/salons/${salonId}/services`)
        .set(auth())
        .send({ designerId: memberId, name: 'Color', priceCents: 12000, durationMin: 60, allowsDoubleBooking: true })
        .expect(201)
    ).body.id;

    D1 = addDays(todayIn(LA), 7);
    D2 = addDays(todayIn(LA), 8);
    paidApptId = (await bookStaff(cutId, at(addDays(todayIn(LA), -2), 600), 'Paying Client').expect(201)).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------- The flag is offered only where there is downtime to share ----------

  it('refuses the flag on a service at or below the 35-minute threshold', async () => {
    const res = await api()
      .post(`/salons/${salonId}/services`)
      .set(auth())
      .send({ designerId: memberId, name: 'Fringe trim', priceCents: 1500, durationMin: 30, allowsDoubleBooking: true })
      .expect(400);
    expect(res.body.issues[0]).toMatchObject({ path: 'allowsDoubleBooking' });
  });

  it('refuses turning the flag on for a short service through an update', async () => {
    const trim = (
      await api()
        .post(`/salons/${salonId}/services`)
        .set(auth())
        .send({ designerId: memberId, name: 'Trim', priceCents: 1500, durationMin: 30 })
        .expect(201)
    ).body;
    expect(trim.allowsDoubleBooking).toBe(false);
    await api().patch(`/salons/${salonId}/services/${trim.id}`).set(auth()).send({ allowsDoubleBooking: true }).expect(400);
  });

  it('drops the flag rather than the edit when a service is shortened past the threshold', async () => {
    const svc = (
      await api()
        .post(`/salons/${salonId}/services`)
        .set(auth())
        .send({ designerId: memberId, name: 'Gloss', priceCents: 4000, durationMin: 45, allowsDoubleBooking: true })
        .expect(201)
    ).body;
    expect(svc.allowsDoubleBooking).toBe(true);

    const shortened = await api()
      .patch(`/salons/${salonId}/services/${svc.id}`)
      .set(auth())
      .send({ durationMin: 20 })
      .expect(200);
    expect(shortened.body.allowsDoubleBooking).toBe(false);
  });

  // ---------- What the database allows ----------

  it('lets an ordinary appointment sit on top of a sharable one', async () => {
    const color = await bookStaff(colorId, at(D1, 600), 'Colour Client').expect(201);
    expect(color.body.allowsDoubleBooking).toBe(true);

    const cut = await bookStaff(cutId, at(D1, 600), 'Cut Client').expect(201);
    expect(cut.body.allowsDoubleBooking).toBe(false);
  });

  it('still refuses two hands-on appointments at the same time', async () => {
    const res = await bookStaff(cutId, at(D1, 600), 'Third Client').expect(409);
    expect(res.body.message).toMatch(/just taken|overlaps/i);
  });

  it('lets two sharable appointments overlap each other', async () => {
    await bookStaff(colorId, at(D2, 600), 'Colour One').expect(201);
    await bookStaff(colorId, at(D2, 600), 'Colour Two').expect(201);
  });

  // ---------- What the slot engine offers customers ----------

  it('offers a customer the hour a sharable appointment is already using', async () => {
    const fresh = addDays(todayIn(LA), 9);
    await bookStaff(colorId, at(fresh, 600), 'Colour Solo').expect(201);
    expect(await publicSlots(cutId, fresh)).toContain(600);
  });

  it('does not offer that hour once a hands-on appointment is also in it', async () => {
    // D1 holds a colour and a cut at 10:00 from the tests above.
    expect(await publicSlots(cutId, D1)).not.toContain(600);
    // Even a sharable service is refused on top of the hands-on cut.
    expect(await publicSlots(colorId, D1)).not.toContain(600);
  });

  it('caps the stack at two, so a third customer is not offered the hour', async () => {
    // D2 holds two colours at 10:00, which the database was happy to accept.
    expect(await publicSlots(cutId, D2)).not.toContain(600);
    expect(await publicSlots(cutId, D2)).toContain(660);
  });

  // ---------- Rescheduling looks past the appointment itself ----------

  /** Staff view of the same engine: no lead time, but no past, hours or clashes. */
  const staffSlots = async (serviceId: string, date: string, excludeAppointmentId?: string): Promise<number[]> => {
    const res = await api()
      .get(`/salons/${salonId}/availability`)
      .set(auth())
      .query({ designerId: memberId, serviceId, from: date, days: 1, ...(excludeAppointmentId ? { excludeAppointmentId } : {}) })
      .expect(200);
    const body = res.body as AvailabilityResponse;
    return body.days[0]?.slots.map((slot) => slot.startMinutes) ?? [];
  };

  it('frees an appointment from its own time so it can be nudged', async () => {
    const day = addDays(todayIn(LA), 10);
    const appt = (await bookStaff(cutId, at(day, 600), 'Moving Client').expect(201)).body;

    // Its own hour is taken, as far as anything else is concerned.
    expect(await staffSlots(cutId, day)).not.toContain(600);
    // Asked where *this* appointment could go, the hour is its own again.
    expect(await staffSlots(cutId, day, appt.id)).toContain(600);
  });

  it('still hides hours taken by a different appointment', async () => {
    const day = addDays(todayIn(LA), 11);
    const mover = (await bookStaff(cutId, at(day, 600), 'Mover').expect(201)).body;
    await bookStaff(cutId, at(day, 780), 'Someone Else').expect(201);

    const offered = await staffSlots(cutId, day, mover.id);
    expect(offered).toContain(600);
    expect(offered).not.toContain(780);
  });

  it('ignores the exclusion on the public route, so it cannot expose a taken slot', async () => {
    const day = addDays(todayIn(LA), 12);
    const appt = (await bookStaff(cutId, at(day, 600), 'Public Test').expect(201)).body;
    const res = await api()
      .get(`/public/salons/${slug}/availability`)
      .query({ designerId: memberId, serviceId: cutId, from: day, days: 1, excludeAppointmentId: appt.id })
      .expect(200);
    const body = res.body as AvailabilityResponse;
    expect(body.days[0].slots.map((slot) => slot.startMinutes)).not.toContain(600);
  });

  // ---------- Completing an appointment ----------

  it('refuses to complete an appointment that has not started', async () => {
    const appt = (await bookStaff(cutId, at(D1, 780), 'Future Client').expect(201)).body;
    const res = await api()
      .patch(`/salons/${salonId}/appointments/${appt.id}`)
      .set(auth())
      .send({ status: 'COMPLETED' })
      .expect(409);
    expect(res.body.message).toMatch(/cannot be completed before/i);
  });

  it('completes one that has started, with no payment method recorded', async () => {
    const yesterday = addDays(todayIn(LA), -1);
    const appt = (await bookStaff(cutId, at(yesterday, 600), 'Past Client').expect(201)).body;
    expect(appt.paymentMethod).toBeNull();

    const res = await api()
      .patch(`/salons/${salonId}/appointments/${appt.id}`)
      .set(auth())
      .send({ status: 'COMPLETED' })
      .expect(200);
    expect(res.body).toMatchObject({ status: 'COMPLETED', paymentMethod: null });
  });

  // ---------- How they paid ----------

  it('records a payment method alongside the completion', async () => {
    const res = await api()
      .patch(`/salons/${salonId}/appointments/${paidApptId}`)
      .set(auth())
      .send({ status: 'COMPLETED', paymentMethod: 'CASH' })
      .expect(200);
    expect(res.body).toMatchObject({ status: 'COMPLETED', paymentMethod: 'CASH' });
  });

  it('corrects it afterwards, and clears it with null', async () => {
    const corrected = await api()
      .patch(`/salons/${salonId}/appointments/${paidApptId}`)
      .set(auth())
      .send({ paymentMethod: 'GIFT_CARD' })
      .expect(200);
    expect(corrected.body.paymentMethod).toBe('GIFT_CARD');

    const cleared = await api()
      .patch(`/salons/${salonId}/appointments/${paidApptId}`)
      .set(auth())
      .send({ paymentMethod: null })
      .expect(200);
    expect(cleared.body.paymentMethod).toBeNull();
  });

  it('refuses a payment method on an appointment that is not completed', async () => {
    const appt = (await bookStaff(cutId, at(D1, 900), 'Unpaid Client').expect(201)).body;
    const res = await api()
      .patch(`/salons/${salonId}/appointments/${appt.id}`)
      .set(auth())
      .send({ paymentMethod: 'CARD' })
      .expect(409);
    expect(res.body.message).toMatch(/only be recorded on a completed/i);
  });

  it('refuses one alongside a cancellation', async () => {
    const appt = (await bookStaff(cutId, at(D1, 960), 'Cancelling Client').expect(201)).body;
    await api()
      .patch(`/salons/${salonId}/appointments/${appt.id}`)
      .set(auth())
      .send({ status: 'CANCELLED', paymentMethod: 'CARD' })
      .expect(409);
  });

  it('records a tip with the completion, and corrects it afterwards', async () => {
    const appt = (await bookStaff(cutId, at(addDays(todayIn(LA), -3), 780), 'Tipping Client').expect(201)).body;
    expect(appt.tipCents).toBeNull();

    const done = await api()
      .patch(`/salons/${salonId}/appointments/${appt.id}`)
      .set(auth())
      .send({ status: 'COMPLETED', paymentMethod: 'CARD', tipCents: 1000 })
      .expect(200);
    expect(done.body).toMatchObject({ paymentMethod: 'CARD', tipCents: 1000 });

    const fixed = await api()
      .patch(`/salons/${salonId}/appointments/${appt.id}`)
      .set(auth())
      .send({ tipCents: 1200 })
      .expect(200);
    expect(fixed.body.tipCents).toBe(1200);
  });

  it('keeps "no tip recorded" and "tipped nothing" apart', async () => {
    const zeroed = await api()
      .patch(`/salons/${salonId}/appointments/${paidApptId}`)
      .set(auth())
      .send({ tipCents: 0 })
      .expect(200);
    expect(zeroed.body.tipCents).toBe(0);

    const cleared = await api()
      .patch(`/salons/${salonId}/appointments/${paidApptId}`)
      .set(auth())
      .send({ tipCents: null })
      .expect(200);
    expect(cleared.body.tipCents).toBeNull();
  });

  it('refuses a tip on an appointment that is not completed', async () => {
    const appt = (await bookStaff(cutId, at(D2, 780), 'Untipped Client').expect(201)).body;
    const res = await api()
      .patch(`/salons/${salonId}/appointments/${appt.id}`)
      .set(auth())
      .send({ tipCents: 500 })
      .expect(409);
    expect(res.body.message).toMatch(/tip can only be recorded on a completed/i);
  });

  it('rejects a negative tip', async () => {
    await api()
      .patch(`/salons/${salonId}/appointments/${paidApptId}`)
      .set(auth())
      .send({ tipCents: -100 })
      .expect(400);
  });

  it('averages each visit as its own percentage, not total over total', async () => {
    const day = addDays(todayIn(LA), -4);
    // Cut is $50. A $10 tip is 20%, a $5 tip is 10%, so the mean is 15%.
    const first = (await bookStaff(cutId, at(day, 600), 'Averaging Client').expect(201)).body;
    const customerId = first.customer.id;
    const second = (
      await api()
        .post(`/salons/${salonId}/appointments`)
        .set(auth())
        .send({ designerId: memberId, serviceId: cutId, startAt: at(day, 780), customerId })
        .expect(201)
    ).body;

    await api()
      .patch(`/salons/${salonId}/appointments/${first.id}`)
      .set(auth())
      .send({ status: 'COMPLETED', tipCents: 1000 })
      .expect(200);
    await api()
      .patch(`/salons/${salonId}/appointments/${second.id}`)
      .set(auth())
      .send({ status: 'COMPLETED', tipCents: 500 })
      .expect(200);

    const detail = await api().get(`/salons/${salonId}/customers/${customerId}`).set(auth()).expect(200);
    expect(detail.body.stats).toMatchObject({ avgTipPct: 15, tippedVisits: 2, tipCents: 1500 });
  });

  it('leaves the average null until a tip is recorded', async () => {
    const appt = (await bookStaff(cutId, at(addDays(todayIn(LA), -5), 600), 'Silent Client').expect(201)).body;
    await api()
      .patch(`/salons/${salonId}/appointments/${appt.id}`)
      .set(auth())
      .send({ status: 'COMPLETED' })
      .expect(200);

    const detail = await api().get(`/salons/${salonId}/customers/${appt.customer.id}`).set(auth()).expect(200);
    expect(detail.body.stats).toMatchObject({ avgTipPct: null, tippedVisits: 0, tipCents: 0 });
  });

  it('rejects a method that is not one of ours', async () => {
    const res = await api()
      .patch(`/salons/${salonId}/appointments/${paidApptId}`)
      .set(auth())
      .send({ paymentMethod: 'CRYPTO' })
      .expect(400);
    expect(res.body.issues[0]).toMatchObject({ path: 'paymentMethod' });
  });
});
