import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { addDays, localToUtc, todayIn } from '@reserivo/shared';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { approveBusiness } from './business.js';

const LA = 'America/Los_Angeles';

/** Phase 3: CRM detail/notes/tags and the message relay. */
describe('Phase 3 (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const pw = 'correct horse battery';
  const owner = { email: `p3own-${stamp}@test.local`, password: pw, name: 'Olive Owner' };
  const designer = { email: `p3dsg-${stamp}@test.local`, password: pw, name: 'Dee Designer' };
  const client = { email: `p3cli-${stamp}@test.local`, password: pw, name: 'Cleo Client' };
  const other = { email: `p3oth-${stamp}@test.local`, password: pw, name: 'Otto Other' };

  let ownToken = '';
  let dsgToken = '';
  let cliToken = '';
  let othToken = '';
  let salonId = '';
  let slug = '';
  let ownMemberId = '';
  let dsgMemberId = '';
  let serviceId = '';
  let cleoCustomerId = '';
  let walkinCustomerId = '';
  let convId = '';

  const api = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    ownToken = (await api().post('/auth/register').send(owner).expect(201)).body.accessToken;
    dsgToken = (await api().post('/auth/register').send(designer).expect(201)).body.accessToken;
    cliToken = (await api().post('/auth/register').send(client).expect(201)).body.accessToken;
    othToken = (await api().post('/auth/register').send(other).expect(201)).body.accessToken;

    await approveBusiness(app, owner.email);
    slug = `phase3-${stamp}`;
    salonId = (await api().post('/salons').set(auth(ownToken)).send({ name: 'Phase Three Salon', slug, timezone: LA }).expect(201)).body.id;
    ownMemberId = (await api().get(`/salons/${salonId}/members`).set(auth(ownToken)).expect(200)).body[0].id;
    await api().patch(`/salons/${salonId}`).set(auth(ownToken)).send({ slotIntervalMin: 60 }).expect(200);
    const allWeek = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinutes: 540, endMinutes: 1020 }));
    await api().put(`/salons/${salonId}/hours/rules`).set(auth(ownToken)).send({ rules: allWeek }).expect(200);

    const inv = await api().post(`/salons/${salonId}/invitations`).set(auth(ownToken)).send({ email: designer.email, roles: ['DESIGNER'] }).expect(201);
    dsgMemberId = (await api().post(`/invitations/${inv.body.inviteUrl.split('/invite/')[1]}/accept`).set(auth(dsgToken)).expect(200)).body.membershipId;
    await api().put(`/salons/${salonId}/members/${dsgMemberId}/availability/rules`).set(auth(dsgToken)).send({ rules: allWeek }).expect(200);
    serviceId = (await api().post(`/salons/${salonId}/services`).set(auth(dsgToken)).send({ name: 'Cut', priceCents: 6000, durationMin: 60 }).expect(201)).body.id;

    // Cleo books Dee online (signed in) — that is what entitles her to message.
    const D = addDays(todayIn(LA), 7);
    const booked = await api()
      .post(`/public/salons/${slug}/appointments`)
      .set(auth(cliToken))
      .send({ designerId: dsgMemberId, serviceId, startAt: localToUtc(D, 600, LA).toISOString(), customer: { name: client.name, email: client.email, phone: '555-000-1111' } })
      .expect(201);
    expect(booked.body.designerId).toBe(dsgMemberId);

    // A walk-in with no account, created by the owner.
    walkinCustomerId = (await api().post(`/salons/${salonId}/customers`).set(auth(ownToken)).send({ name: 'Wally Walk-in', phone: '555-222-3333' }).expect(201)).body.id;
    cleoCustomerId = (await api().get(`/salons/${salonId}/customers`).set(auth(ownToken)).query({ q: 'cleo' }).expect(200)).body[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------- CRM ----------

  it('customer detail shows stats and history; designers get no contact fields but do see notes', async () => {
    const asOwner = await api().get(`/salons/${salonId}/customers/${cleoCustomerId}`).set(auth(ownToken)).expect(200);
    expect(asOwner.body).toMatchObject({ name: client.name, email: client.email, phone: '555-000-1111', hasAccount: true, tags: [] });
    expect(asOwner.body.stats).toMatchObject({ visits: 0, upcoming: 1, spentCents: 0 });
    expect(asOwner.body.history).toHaveLength(1);
    expect(asOwner.body.history[0]).toMatchObject({ serviceName: 'Cut', designerName: designer.name, status: 'CONFIRMED' });

    await api().patch(`/salons/${salonId}/customers/${cleoCustomerId}`).set(auth(ownToken)).send({ notes: 'Sensitive scalp — patch test first', tags: ['vip', 'color'] }).expect(200);

    const asDsg = await api().get(`/salons/${salonId}/customers/${cleoCustomerId}`).set(auth(dsgToken)).expect(200);
    expect(asDsg.body.notes).toBe('Sensitive scalp — patch test first');
    expect(asDsg.body.tags).toEqual(['vip', 'color']);
    expect(asDsg.body.email).toBeUndefined();
    expect(asDsg.body.phone).toBeUndefined();
    expect(JSON.stringify(asDsg.body)).not.toContain('@test.local');
  });

  it('designers may edit notes and tags but not contact details', async () => {
    const ok = await api().patch(`/salons/${salonId}/customers/${cleoCustomerId}`).set(auth(dsgToken)).send({ tags: ['vip'], notes: 'Prefers 10am' }).expect(200);
    expect(ok.body.tags).toEqual(['vip']);
    const no = await api().patch(`/salons/${salonId}/customers/${cleoCustomerId}`).set(auth(dsgToken)).send({ phone: '555-999-9999' }).expect(403);
    expect(no.body.message).toMatch(/managers/i);
  });

  it('search filters by tag', async () => {
    const res = await api().get(`/salons/${salonId}/customers`).set(auth(dsgToken)).query({ tag: 'vip' }).expect(200);
    expect(res.body.map((c: { id: string }) => c.id)).toEqual([cleoCustomerId]);
    const none = await api().get(`/salons/${salonId}/customers`).set(auth(dsgToken)).query({ tag: 'nope' }).expect(200);
    expect(none.body).toEqual([]);
  });

  // ---------- Relay: customer side ----------

  it('a customer who never booked cannot start a thread', async () => {
    const res = await api().post('/me/conversations').set(auth(othToken)).send({ salonId, designerId: dsgMemberId, body: 'hi' }).expect(403);
    expect(res.body.message).toMatch(/booked/i);
  });

  it('a customer opens a thread with their designer and the first message is delivered', async () => {
    const res = await api()
      .post('/me/conversations')
      .set(auth(cliToken))
      .send({ salonId, designerId: dsgMemberId, body: 'Hi Dee — can I come 15 min early?' })
      .expect(200);
    convId = res.body.conversationId;
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0]).toMatchObject({ sender: 'CUSTOMER', fromName: client.name });
    expect(res.body.messages[0].writtenBy).toBeUndefined();

    // Same pair → same thread.
    const again = await api().post('/me/conversations').set(auth(cliToken)).send({ salonId, designerId: dsgMemberId }).expect(200);
    expect(again.body.conversationId).toBe(convId);

    const list = await api().get('/me/conversations').set(auth(cliToken)).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ designer: { displayName: designer.name }, salon: { slug }, unread: 0 });
    expect(JSON.stringify(list.body)).not.toContain(designer.email);
  });

  // ---------- Relay: staff side ----------

  it('the designer sees the thread with the customer’s name only and an unread count', async () => {
    const list = await api().get(`/salons/${salonId}/conversations`).set(auth(dsgToken)).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ customer: { id: cleoCustomerId, name: client.name }, unread: 1 });
    expect(JSON.stringify(list.body)).not.toContain('@test.local');
    expect(JSON.stringify(list.body)).not.toContain('555-');

    const thread = await api().get(`/salons/${salonId}/conversations/${convId}`).set(auth(dsgToken)).expect(200);
    expect(thread.body.messages[0]).toMatchObject({ sender: 'CUSTOMER', fromName: client.name, mine: false });

    // Reading cleared the unread mark.
    const after = await api().get(`/salons/${salonId}/conversations`).set(auth(dsgToken)).expect(200);
    expect(after.body[0].unread).toBe(0);
  });

  it('the designer replies; the customer sees it from the designer', async () => {
    const sent = await api().post(`/salons/${salonId}/conversations/${convId}/messages`).set(auth(dsgToken)).send({ body: 'Of course, see you then!' }).expect(201);
    expect(sent.body).toMatchObject({ sender: 'STAFF', fromName: designer.name, mine: true });
    expect(sent.body.writtenBy).toBeUndefined();

    const mine = await api().get('/me/conversations').set(auth(cliToken)).expect(200);
    expect(mine.body[0].unread).toBe(1);
    const thread = await api().get(`/me/conversations/${convId}`).set(auth(cliToken)).expect(200);
    expect(thread.body.messages.at(-1)).toMatchObject({ sender: 'STAFF', fromName: designer.name, body: 'Of course, see you then!' });
  });

  it('a manager replies as the designer: the customer sees the designer, staff see who wrote it', async () => {
    const sent = await api()
      .post(`/salons/${salonId}/conversations/${convId}/messages`)
      .set(auth(ownToken))
      .send({ body: 'Also, we moved to suite 4 — front desk will point you.' })
      .expect(201);
    expect(sent.body).toMatchObject({ sender: 'STAFF', fromName: designer.name, writtenBy: owner.name });

    const customerView = await api().get(`/me/conversations/${convId}`).set(auth(cliToken)).expect(200);
    const last = customerView.body.messages.at(-1);
    expect(last.fromName).toBe(designer.name);
    expect(last.writtenBy).toBeUndefined();
    expect(JSON.stringify(customerView.body)).not.toContain(owner.name);

    const staffView = await api().get(`/salons/${salonId}/conversations/${convId}`).set(auth(dsgToken)).expect(200);
    const staffLast = staffView.body.messages.at(-1);
    expect(staffLast).toMatchObject({ fromName: designer.name, writtenBy: owner.name, mine: false });
  });

  it('threads are private to their designer and their customer', async () => {
    // Another designer in the salon cannot read Dee's thread; the owner (manager) can.
    const inv = await api().post(`/salons/${salonId}/invitations`).set(auth(ownToken)).send({ email: other.email, roles: ['DESIGNER'] }).expect(201);
    await api().post(`/invitations/${inv.body.inviteUrl.split('/invite/')[1]}/accept`).set(auth(othToken)).expect(200);
    await api().get(`/salons/${salonId}/conversations/${convId}`).set(auth(othToken)).expect(403);
    const otherList = await api().get(`/salons/${salonId}/conversations`).set(auth(othToken)).expect(200);
    expect(otherList.body).toEqual([]);
    await api().get(`/salons/${salonId}/conversations/${convId}`).set(auth(ownToken)).expect(200);

    // A different customer cannot read it either.
    await api().get(`/me/conversations/${convId}`).set(auth(othToken)).expect(404);
    await api().post(`/me/conversations/${convId}/messages`).set(auth(othToken)).send({ body: 'x' }).expect(404);
  });

  it('staff cannot open a thread with a customer who has no account', async () => {
    const res = await api().post(`/salons/${salonId}/conversations`).set(auth(ownToken)).send({ customerId: walkinCustomerId, designerId: dsgMemberId }).expect(409);
    expect(res.body.message).toMatch(/no Morrri account/);
  });

  it('a designer cannot start a thread on another designer’s behalf; a manager can', async () => {
    await api().post(`/salons/${salonId}/conversations`).set(auth(othToken)).send({ customerId: cleoCustomerId, designerId: dsgMemberId }).expect(403);
    const res = await api().post(`/salons/${salonId}/conversations`).set(auth(ownToken)).send({ customerId: cleoCustomerId, designerId: ownMemberId, body: 'Welcome from the owner!' }).expect(200);
    expect(res.body.conversationId).not.toBe(convId);
    const mine = await api().get('/me/conversations').set(auth(cliToken)).expect(200);
    expect(mine.body).toHaveLength(2);
  });

  it('rejects empty or oversized messages', async () => {
    await api().post(`/me/conversations/${convId}/messages`).set(auth(cliToken)).send({ body: '   ' }).expect(400);
    await api().post(`/me/conversations/${convId}/messages`).set(auth(cliToken)).send({ body: 'x'.repeat(2001) }).expect(400);
  });
});
