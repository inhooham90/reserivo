import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { addDays, localToUtc, todayIn, type LiveEvent } from '@reserivo/shared';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { LiveEventsService } from '../src/messaging/live-events.service.js';
import { MessagingService } from '../src/messaging/messaging.service.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { approveBusiness } from './business.js';

/** Unread counts, live events and the delayed email nudge. */
describe('Message notifications (e2e)', () => {
  let app: INestApplication;
  let messaging: MessagingService;
  const stamp = Date.now();
  const pw = 'correct horse battery';
  const LA = 'America/Los_Angeles';
  const owner = { email: `live-own-${stamp}@test.local`, password: pw, name: 'Lia Owner' };
  const client = { email: `live-cli-${stamp}@test.local`, password: pw, name: 'Leo Client' };
  let ownerToken = '';
  let clientToken = '';
  let clientUserId = '';
  let ownerUserId = '';
  let salonId = '';
  let memberId = '';
  let convId = '';
  let emit: ReturnType<typeof vi.spyOn>;

  const api = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const unread = async (token: string) => (await api().get('/me/unread').set(auth(token)).expect(200)).body;
  // The sweep is global and other specs run alongside, so only this test's conversation is counted.
  type Nudge = { type: string; to: { email: string | null }; data: { conversationId?: string } };
  const nudges = () =>
    emit.mock.calls
      .map((call: unknown[]) => call[0] as Nudge)
      .filter((e: Nudge) => e.type === 'message.received' && e.data.conversationId === convId);
  const minutes = (n: number) => new Date(Date.now() + n * 60_000);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    messaging = app.get(MessagingService);
    emit = vi.spyOn(app.get(NotificationsService), 'emit');

    const o = await api().post('/auth/register').send(owner).expect(201);
    ownerToken = o.body.accessToken;
    ownerUserId = o.body.user.id;
    const c = await api().post('/auth/register').send(client).expect(201);
    clientToken = c.body.accessToken;
    clientUserId = c.body.user.id;
    await approveBusiness(app, owner.email);
    const slug = `live-${stamp}`;
    salonId = (await api().post('/salons').set(auth(ownerToken)).send({ name: 'Live Salon', slug, timezone: LA }).expect(201)).body.id;
    memberId = (await api().get(`/salons/${salonId}/members`).set(auth(ownerToken)).expect(200)).body[0].id;

    // The client books (signed in), which is what entitles them to message.
    await api().patch(`/salons/${salonId}`).set(auth(ownerToken)).send({ slotIntervalMin: 60 }).expect(200);
    const allWeek = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinutes: 540, endMinutes: 1020 }));
    await api().put(`/salons/${salonId}/hours/rules`).set(auth(ownerToken)).send({ rules: allWeek }).expect(200);
    await api().put(`/salons/${salonId}/members/${memberId}/availability/rules`).set(auth(ownerToken)).send({ rules: allWeek }).expect(200);
    const serviceId = (await api().post(`/salons/${salonId}/services`).set(auth(ownerToken)).send({ name: 'Cut', priceCents: 5000, durationMin: 60 }).expect(201)).body.id;
    await api()
      .post(`/public/salons/${slug}/appointments`)
      .set(auth(clientToken))
      .send({ serviceId, designerId: memberId, startAt: localToUtc(addDays(todayIn(LA), 7), 600, LA).toISOString(), customer: { name: client.name, email: client.email } })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('the live stream needs a session', async () => {
    await api().get('/me/events').expect(401);
  });

  it('a new message is announced live to both sides, by id only, and emails nobody yet', async () => {
    const live = app.get(LiveEventsService);
    const seen: Record<string, LiveEvent[]> = { owner: [], client: [] };
    const subs = [
      live.streamFor(ownerUserId).subscribe(({ data }) => seen.owner.push(data)),
      live.streamFor(clientUserId).subscribe(({ data }) => seen.client.push(data)),
    ];
    emit.mockClear();

    const res = await api().post('/me/conversations').set(auth(clientToken)).send({ salonId, designerId: memberId, body: 'Can I come at 11 instead?' }).expect(200);
    convId = res.body.conversationId;
    subs.forEach((s) => s.unsubscribe());

    // Staff hear about it with the business; the client's own other tabs without. Never a body.
    expect(seen.owner).toContainEqual({ type: 'message', conversationId: convId, salonId });
    expect(seen.client).toContainEqual({ type: 'message', conversationId: convId });
    expect(JSON.stringify(seen)).not.toContain('11 instead');
    expect(nudges()).toHaveLength(0);
  });

  it('counts unread per business for staff and personally for the client', async () => {
    expect((await unread(ownerToken)).salons[salonId]).toBe(1);
    expect((await unread(clientToken)).personal).toBe(0);
  });

  it('emails only once the message has sat unread for five minutes, and only once per streak', async () => {
    emit.mockClear();
    await messaging.sweepNudges(minutes(2));
    expect(nudges()).toHaveLength(0);
    await messaging.sweepNudges(minutes(6));
    expect(nudges()).toHaveLength(1);
    expect(nudges()[0]).toMatchObject({ to: { email: owner.email } });

    // A second message in the same unread streak sends nothing more.
    await api().post(`/me/conversations/${convId}/messages`).set(auth(clientToken)).send({ body: 'Or 12?' }).expect(201);
    await messaging.sweepNudges(minutes(20));
    expect(nudges()).toHaveLength(1);
    expect((await unread(ownerToken)).salons[salonId]).toBe(2);
  });

  it('reading clears the count and starts a new streak; a reply is counted and nudged on the other side', async () => {
    await api().get(`/salons/${salonId}/conversations/${convId}`).set(auth(ownerToken)).expect(200);
    expect((await unread(ownerToken)).salons[salonId]).toBe(0);

    await api().post(`/salons/${salonId}/conversations/${convId}/messages`).set(auth(ownerToken)).send({ body: '11 works.' }).expect(201);
    expect((await unread(clientToken)).personal).toBe(1);

    emit.mockClear();
    await messaging.sweepNudges(minutes(6));
    expect(nudges()).toHaveLength(1);
    expect(nudges()[0]).toMatchObject({ to: { email: client.email } });

    // Read on screen within the five minutes: nothing to email.
    await api().get(`/me/conversations/${convId}`).set(auth(clientToken)).expect(200);
    await api().post(`/salons/${salonId}/conversations/${convId}/messages`).set(auth(ownerToken)).send({ body: 'See you then.' }).expect(201);
    await api().get(`/me/conversations/${convId}`).set(auth(clientToken)).expect(200);
    emit.mockClear();
    await messaging.sweepNudges(minutes(30));
    expect(nudges()).toHaveLength(0);
  });
});
