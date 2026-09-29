import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { approveBusiness } from './business.js';

/** The setup guide: steps by role, marked by saving, shared where they describe the business. */
describe('Setup guide (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const pw = 'correct horse battery';
  const owner = { email: `guide-own-${stamp}@test.local`, password: pw, name: 'Olive Owner' };
  const stylist = { email: `guide-dsg-${stamp}@test.local`, password: pw, name: 'Dee Designer' };
  const desk = { email: `guide-mgr-${stamp}@test.local`, password: pw, name: 'Frankie Frontdesk' };
  const stranger = { email: `guide-str-${stamp}@test.local`, password: pw, name: 'Sam Stranger' };

  const tokens: Record<string, string> = {};
  let salonId = '';
  let ownerMemberId = '';

  const api = () => request(app.getHttpServer());
  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const guide = async (who: string) => (await api().get(`/salons/${salonId}/setup`).set(auth(who)).expect(200)).body;
  const doneOf = (body: { steps: { key: string; done: boolean }[] }) =>
    Object.fromEntries(body.steps.map((s) => [s.key, s.done]));
  const join = async (who: string, email: string, roles: string[]) => {
    const invite = await api().post(`/salons/${salonId}/invitations`).set(auth('owner')).send({ email, roles }).expect(201);
    const token = new URL(invite.body.inviteUrl).pathname.split('/').pop();
    await api().post(`/invitations/${token}/accept`).set(auth(who)).expect(200);
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    for (const [key, user] of Object.entries({ owner, stylist, desk, stranger })) {
      tokens[key] = (await api().post('/auth/register').send(user).expect(201)).body.accessToken;
    }
    await approveBusiness(app, owner.email);
    const salon = await api()
      .post('/salons')
      .set(auth('owner'))
      .send({ name: 'Guide Salon', slug: `guide-${stamp}`, timezone: 'America/New_York' })
      .expect(201);
    salonId = salon.body.id;
    const members = await api().get(`/salons/${salonId}/members`).set(auth('owner')).expect(200);
    ownerMemberId = members.body[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('an owner who takes appointments starts with every step, none done, and the guide showing', async () => {
    const body = await guide('owner');
    expect(body.steps.map((s: { key: string }) => s.key)).toEqual([
      'business',
      'businessHours',
      'myHours',
      'services',
      'profile',
      'team',
      'share',
    ]);
    expect(body.steps.every((s: { done: boolean }) => !s.done)).toBe(true);
    expect(body.hidden).toBe(false);
  });

  it('saving each screen ticks its step; services, profile and team are read off the data', async () => {
    await api().patch(`/salons/${salonId}`).set(auth('owner')).send({ name: 'Guide Salon & Co' }).expect(200);
    await api()
      .put(`/salons/${salonId}/hours/rules`)
      .set(auth('owner'))
      .send({ rules: [{ weekday: 2, startMinutes: 600, endMinutes: 1080 }] })
      .expect(200);
    await api()
      .put(`/salons/${salonId}/members/${ownerMemberId}/availability/rules`)
      .set(auth('owner'))
      .send({ rules: [{ weekday: 2, startMinutes: 600, endMinutes: 900 }] })
      .expect(200);
    await api().post(`/salons/${salonId}/services`).set(auth('owner')).send({ name: 'Cut', priceCents: 5000, durationMin: 45 }).expect(201);
    await api().patch(`/salons/${salonId}/members/${ownerMemberId}`).set(auth('owner')).send({ bio: 'Twenty years behind the chair.' }).expect(200);

    expect(doneOf(await guide('owner'))).toEqual({
      business: true,
      businessHours: true,
      myHours: true,
      services: true,
      profile: true,
      team: false,
      share: false,
    });

    const after = await api().patch(`/salons/${salonId}/setup`).set(auth('owner')).send({ done: ['share'] }).expect(200);
    expect(doneOf(after.body).share).toBe(true);
  });

  it('a team member who takes appointments sees only their own chair; a new manager inherits the business steps', async () => {
    await join('stylist', stylist.email, ['DESIGNER']);
    const mine = await guide('stylist');
    expect(mine.steps.map((s: { key: string }) => s.key)).toEqual(['myHours', 'services', 'profile', 'share']);
    expect(mine.steps.every((s: { done: boolean }) => !s.done)).toBe(true);

    // Joining filled the team; the owner's team step is now done.
    expect(doneOf(await guide('owner')).team).toBe(true);

    await join('desk', desk.email, ['MANAGER']);
    expect(doneOf(await guide('desk'))).toEqual({ business: true, businessHours: true, team: true, share: false });
  });

  it('hiding is per person and reversible', async () => {
    await api().patch(`/salons/${salonId}/setup`).set(auth('stylist')).send({ hidden: true }).expect(200);
    expect((await guide('stylist')).hidden).toBe(true);
    expect((await guide('owner')).hidden).toBe(false);
    await api().patch(`/salons/${salonId}/setup`).set(auth('stylist')).send({ hidden: false }).expect(200);
    expect((await guide('stylist')).hidden).toBe(false);
  });

  it('refuses an empty update, a step that cannot be stored, and anyone outside the business', async () => {
    await api().patch(`/salons/${salonId}/setup`).set(auth('owner')).send({}).expect(400);
    await api().patch(`/salons/${salonId}/setup`).set(auth('owner')).send({ done: ['services'] }).expect(400);
    await api().get(`/salons/${salonId}/setup`).set(auth('stranger')).expect(403);
  });
});
