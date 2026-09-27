import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { addDays, localToUtc, todayIn } from '@reserivo/shared';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { approveBusiness } from './business.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import type { NotificationEvent } from '../src/notifications/notifications.types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RemindersService } from '../src/reminders/reminders.service.js';

const LA = 'America/Los_Angeles';

type ReminderEvent = Extract<NotificationEvent, { type: 'appointment.reminder' }>;
const isReminder = (e: NotificationEvent): e is ReminderEvent => e.type === 'appointment.reminder';
const HOUR = 3_600_000;

/**
 * Reminders. The sweep takes its clock as an argument, so these drive it to a
 * chosen moment rather than waiting or backdating rows.
 */
describe('Reminders (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let reminders: RemindersService;
  const stamp = Date.now();
  const pw = 'correct horse battery';
  const owner = { email: `rem-own-${stamp}@test.local`, password: pw, name: 'Ruth Owner' };

  let ownToken = '';
  let salonId = '';
  let slug = '';
  let memberId = '';
  let serviceId = '';
  let apptId = '';
  let startAt = new Date();

  const api = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  /** Reminder rows for our appointment only — the suite shares a database. */
  const rowsFor = (id: string) =>
    prisma.appointmentReminder.findMany({ where: { appointmentId: id }, orderBy: { hoursBefore: 'desc' } });

  /** Runs a sweep at `now` and returns the reminder events it emitted for our appointment. */
  const sweepAt = async (now: Date) => {
    const spy = vi.spyOn(app.get(NotificationsService), 'emit');
    try {
      await reminders.sweep(now);
      return spy.mock.calls
        .map((c) => c[0])
        .filter(isReminder)
        .filter((e) => e.data.appointmentId === apptId);
    } finally {
      spy.mockRestore();
    }
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
    reminders = app.get(RemindersService);

    ownToken = (await api().post('/auth/register').send(owner).expect(201)).body.accessToken;
    await approveBusiness(app, owner.email);
    slug = `reminders-${stamp}`;
    salonId = (await api().post('/salons').set(auth(ownToken)).send({ name: 'Reminder Salon', slug, timezone: LA }).expect(201)).body.id;
    memberId = (await api().get(`/salons/${salonId}/members`).set(auth(ownToken)).expect(200)).body[0].id;

    const allDay = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinutes: 0, endMinutes: 1440 }));
    await api().put(`/salons/${salonId}/hours/rules`).set(auth(ownToken)).send({ rules: allDay }).expect(200);
    await api().put(`/salons/${salonId}/members/${memberId}/availability/rules`).set(auth(ownToken)).send({ rules: allDay }).expect(200);
    await api()
      .patch(`/salons/${salonId}`)
      .set(auth(ownToken))
      .send({ slotIntervalMin: 60, reminderHoursBefore: [2, 24] })
      .expect(200);
    serviceId = (
      await api().post(`/salons/${salonId}/services`).set(auth(ownToken)).send({ name: 'Cut', priceCents: 5000, durationMin: 60 }).expect(201)
    ).body.id;

    // Three days out, so both reminder times are comfortably in the future.
    const date = addDays(todayIn(LA), 3);
    startAt = localToUtc(date, 600, LA);
    apptId = (
      await api()
        .post(`/public/salons/${slug}/appointments`)
        .send({
          designerId: memberId,
          serviceId,
          startAt: startAt.toISOString(),
          customer: { name: 'Remy Customer', email: `rem-cust-${stamp}@test.local`, phone: '(555) 400-1000' },
        })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('stores the reminder schedule, newest lead first', async () => {
    const salon = await api().get(`/salons/${salonId}`).set(auth(ownToken)).expect(200);
    expect(salon.body.reminderHoursBefore).toEqual([24, 2]);
  });

  it('sends nothing before the first reminder is due', async () => {
    expect(await sweepAt(new Date(startAt.getTime() - 25 * HOUR))).toEqual([]);
    expect(await rowsFor(apptId)).toEqual([]);
  });

  it('sends the day-before reminder once the moment arrives, and only once', async () => {
    const justAfter = new Date(startAt.getTime() - 24 * HOUR + 60_000);

    const first = await sweepAt(justAfter);
    expect(first).toHaveLength(1);
    expect(first[0].data).toMatchObject({ hoursBefore: 24, serviceName: 'Cut', salonName: 'Reminder Salon', timezone: LA });
    expect(first[0].to.name).toBe('Remy Customer');

    // Running again changes nothing: the claim row is the lock.
    expect(await sweepAt(justAfter)).toEqual([]);
    expect(await rowsFor(apptId)).toEqual([expect.objectContaining({ hoursBefore: 24, channel: 'EMAIL' })]);
  });

  it('sends the two-hour reminder later, without repeating the first', async () => {
    const second = await sweepAt(new Date(startAt.getTime() - 2 * HOUR + 60_000));
    expect(second).toHaveLength(1);
    expect(second[0].data.hoursBefore).toBe(2);
    expect((await rowsFor(apptId)).map((r) => r.hoursBefore)).toEqual([24, 2]);
  });

  it('never texts without consent, even with a number on file', async () => {
    // Twilio is unconfigured in tests, and consent was never given.
    expect((await rowsFor(apptId)).every((r) => r.channel === 'EMAIL')).toBe(true);
  });

  it('skips an appointment booked after its reminder would have gone out', async () => {
    // Booked for two hours from now: the day-before reminder is long past due,
    // but sending one would be absurd — they just booked it.
    const soon = new Date(Date.now() + 2 * HOUR);
    const late = (
      await api()
        .post(`/salons/${salonId}/appointments`)
        .set(auth(ownToken))
        .send({ designerId: memberId, serviceId, startAt: soon.toISOString(), customer: { name: 'Last Minute' } })
        .expect(201)
    ).body.id;

    await reminders.sweep(new Date());
    expect(await rowsFor(late)).toEqual([]);
  });

  it('stops reminding once an appointment is cancelled', async () => {
    const date = addDays(todayIn(LA), 4);
    const futureStart = localToUtc(date, 780, LA);
    const doomed = (
      await api()
        .post(`/salons/${salonId}/appointments`)
        .set(auth(ownToken))
        .send({ designerId: memberId, serviceId, startAt: futureStart.toISOString(), customer: { name: 'Cancelling Customer' } })
        .expect(201)
    ).body.id;
    await api().patch(`/salons/${salonId}/appointments/${doomed}`).set(auth(ownToken)).send({ status: 'CANCELLED' }).expect(200);

    await reminders.sweep(new Date(futureStart.getTime() - 24 * HOUR + 60_000));
    expect(await rowsFor(doomed)).toEqual([]);
  });

  it('an empty schedule turns reminders off entirely', async () => {
    const date = addDays(todayIn(LA), 5);
    const quietStart = localToUtc(date, 900, LA);
    const quiet = (
      await api()
        .post(`/salons/${salonId}/appointments`)
        .set(auth(ownToken))
        .send({ designerId: memberId, serviceId, startAt: quietStart.toISOString(), customer: { name: 'No Reminders' } })
        .expect(201)
    ).body.id;

    await api().patch(`/salons/${salonId}`).set(auth(ownToken)).send({ reminderHoursBefore: [] }).expect(200);
    await reminders.sweep(new Date(quietStart.getTime() - 24 * HOUR + 60_000));
    expect(await rowsFor(quiet)).toEqual([]);
  });
});
