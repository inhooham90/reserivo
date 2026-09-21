import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

/** Phase 1: team invites, services, hours, and the public catalog. */
describe('Phase 1 (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const pw = 'correct horse battery';
  const manager = { email: `mgr-${stamp}@test.local`, password: pw, name: 'Mara Manager' };
  const designer = { email: `dsg-${stamp}@test.local`, password: pw, name: 'Dee Designer' };
  const stranger = { email: `str-${stamp}@test.local`, password: pw, name: 'Sam Stranger' };

  let mgrToken = '';
  let dsgToken = '';
  let strToken = '';
  let salonId = '';
  let slug = '';
  let mgrMemberId = '';
  let dsgMemberId = '';
  let inviteToken = '';
  let serviceId = '';

  const api = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    mgrToken = (await api().post('/auth/register').send(manager).expect(201)).body.accessToken;
    dsgToken = (await api().post('/auth/register').send(designer).expect(201)).body.accessToken;
    strToken = (await api().post('/auth/register').send(stranger).expect(201)).body.accessToken;

    slug = `phase1-${stamp}`;
    const salon = await api()
      .post('/salons')
      .set(auth(mgrToken))
      .send({ name: 'Phase One Salon', slug, timezone: 'America/Chicago' })
      .expect(201);
    salonId = salon.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------- Team & invitations ----------

  it('lists the creator as the only member, with email visible to a manager', async () => {
    const res = await api().get(`/salons/${salonId}/members`).set(auth(mgrToken)).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ role: 'MANAGER', displayName: manager.name, email: manager.email });
    mgrMemberId = res.body[0].id;
  });

  it('manager creates an invite and gets the URL exactly once', async () => {
    const res = await api()
      .post(`/salons/${salonId}/invitations`)
      .set(auth(mgrToken))
      .send({ email: designer.email.toUpperCase(), role: 'DESIGNER' })
      .expect(201);
    expect(res.body.email).toBe(designer.email);
    expect(res.body.inviteUrl).toMatch(/^http:\/\/localhost:3000\/invite\/[A-Za-z0-9_-]{40,}$/);
    inviteToken = res.body.inviteUrl.split('/invite/')[1];

    const list = await api().get(`/salons/${salonId}/invitations`).set(auth(mgrToken)).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].inviteUrl).toBeUndefined();
  });

  it('a non-member cannot create invites', async () => {
    await api()
      .post(`/salons/${salonId}/invitations`)
      .set(auth(strToken))
      .send({ email: 'x@test.local', role: 'DESIGNER' })
      .expect(403);
  });

  it('the invite preview is public and never leaks beyond salon/role/email', async () => {
    const res = await api().get(`/invitations/${inviteToken}`).expect(200);
    expect(res.body).toEqual({
      salonName: 'Phase One Salon',
      salonSlug: slug,
      role: 'DESIGNER',
      email: designer.email,
      expiresAt: expect.any(String),
    });
    await api().get('/invitations/not-a-real-token').expect(404);
  });

  it('accepting with the wrong account is refused', async () => {
    const res = await api().post(`/invitations/${inviteToken}/accept`).set(auth(strToken)).expect(403);
    expect(res.body.message).toContain(designer.email);
  });

  it('the invited designer accepts and becomes an active member', async () => {
    const res = await api().post(`/invitations/${inviteToken}/accept`).set(auth(dsgToken)).expect(200);
    expect(res.body).toMatchObject({ salonId, role: 'DESIGNER' });
    dsgMemberId = res.body.membershipId;

    // Single use.
    await api().post(`/invitations/${inviteToken}/accept`).set(auth(dsgToken)).expect(410);

    const mine = await api().get('/salons/mine').set(auth(dsgToken)).expect(200);
    expect(mine.body).toEqual([expect.objectContaining({ id: salonId, role: 'DESIGNER' })]);
  });

  it('designers see teammates but not their emails', async () => {
    const res = await api().get(`/salons/${salonId}/members`).set(auth(dsgToken)).expect(200);
    expect(res.body).toHaveLength(2);
    for (const m of res.body) expect(m.email).toBeUndefined();
  });

  it('a designer edits their own profile but cannot change roles or others', async () => {
    const own = await api()
      .patch(`/salons/${salonId}/members/${dsgMemberId}`)
      .set(auth(dsgToken))
      .send({ bio: 'Balayage specialist' })
      .expect(200);
    expect(own.body.bio).toBe('Balayage specialist');

    await api().patch(`/salons/${salonId}/members/${dsgMemberId}`).set(auth(dsgToken)).send({ role: 'MANAGER' }).expect(403);
    await api().patch(`/salons/${salonId}/members/${mgrMemberId}`).set(auth(dsgToken)).send({ bio: 'nope' }).expect(403);
  });

  it('the last manager cannot be demoted or removed', async () => {
    await api().patch(`/salons/${salonId}/members/${mgrMemberId}`).set(auth(mgrToken)).send({ role: 'DESIGNER' }).expect(409);
    await api().delete(`/salons/${salonId}/members/${mgrMemberId}`).set(auth(mgrToken)).expect(409);
  });

  // ---------- Services ----------

  it('a designer creates a service for themselves without naming designerId', async () => {
    const res = await api()
      .post(`/salons/${salonId}/services`)
      .set(auth(dsgToken))
      .send({ name: 'Balayage', category: 'Color', priceCents: 18000, durationMin: 150, bufferMin: 15 })
      .expect(201);
    expect(res.body).toMatchObject({ designerId: dsgMemberId, priceCents: 18000, active: true });
    serviceId = res.body.id;
  });

  it('a designer cannot create a service for someone else, but a manager can', async () => {
    await api()
      .post(`/salons/${salonId}/services`)
      .set(auth(dsgToken))
      .send({ designerId: mgrMemberId, name: 'Sneaky', priceCents: 100, durationMin: 30 })
      .expect(403);

    const res = await api()
      .post(`/salons/${salonId}/services`)
      .set(auth(mgrToken))
      .send({ designerId: dsgMemberId, name: "Men's cut", priceCents: 4500, durationMin: 30 })
      .expect(201);
    expect(res.body.designerId).toBe(dsgMemberId);
  });

  it('rejects durations that are not 5-minute multiples', async () => {
    const res = await api()
      .post(`/salons/${salonId}/services`)
      .set(auth(dsgToken))
      .send({ name: 'Odd', priceCents: 100, durationMin: 32 })
      .expect(400);
    expect(res.body.issues[0].path).toBe('durationMin');
  });

  it('a manager can deactivate a designer service; a stranger cannot see the list', async () => {
    const res = await api()
      .patch(`/salons/${salonId}/services/${serviceId}`)
      .set(auth(mgrToken))
      .send({ active: false })
      .expect(200);
    expect(res.body.active).toBe(false);
    await api().get(`/salons/${salonId}/services`).set(auth(strToken)).expect(403);
  });

  // ---------- Availability ----------

  it('replaces weekly hours atomically and rejects overlapping windows', async () => {
    const good = await api()
      .put(`/salons/${salonId}/members/${dsgMemberId}/availability/rules`)
      .set(auth(dsgToken))
      .send({
        rules: [
          { weekday: 2, startMinutes: 540, endMinutes: 780 },
          { weekday: 2, startMinutes: 840, endMinutes: 1080 },
          { weekday: 6, startMinutes: 600, endMinutes: 960 },
        ],
      })
      .expect(200);
    expect(good.body).toHaveLength(3);

    const bad = await api()
      .put(`/salons/${salonId}/members/${dsgMemberId}/availability/rules`)
      .set(auth(dsgToken))
      .send({
        rules: [
          { weekday: 2, startMinutes: 540, endMinutes: 780 },
          { weekday: 2, startMinutes: 720, endMinutes: 900 },
        ],
      })
      .expect(400);
    expect(bad.body.issues[0].message).toMatch(/overlap/i);

    // The failed request must not have touched the stored rules.
    const after = await api().get(`/salons/${salonId}/members/${dsgMemberId}/availability`).set(auth(dsgToken)).expect(200);
    expect(after.body.rules).toHaveLength(3);
  });

  it('adds a day off and custom hours, keeping the date as a plain local date', async () => {
    const off = await api()
      .post(`/salons/${salonId}/members/${dsgMemberId}/availability/exceptions`)
      .set(auth(mgrToken))
      .send({ date: '2031-07-04', type: 'OFF', note: 'Holiday' })
      .expect(201);
    expect(off.body).toMatchObject({ date: '2031-07-04', type: 'OFF', startMinutes: null });

    await api()
      .post(`/salons/${salonId}/members/${dsgMemberId}/availability/exceptions`)
      .set(auth(dsgToken))
      .send({ date: '2031-07-05', type: 'CUSTOM', startMinutes: 600 })
      .expect(400);

    await api()
      .delete(`/salons/${salonId}/members/${dsgMemberId}/availability/exceptions/${off.body.id}`)
      .set(auth(strToken))
      .expect(403);
    await api()
      .delete(`/salons/${salonId}/members/${dsgMemberId}/availability/exceptions/${off.body.id}`)
      .set(auth(dsgToken))
      .expect(204);
  });

  it('a designer cannot edit a teammate’s hours', async () => {
    await api()
      .put(`/salons/${salonId}/members/${mgrMemberId}/availability/rules`)
      .set(auth(dsgToken))
      .send({ rules: [] })
      .expect(403);
  });

  // ---------- Public catalog ----------

  it('the public page lists bookable members with active services only, and no contact fields', async () => {
    const res = await api().get(`/salons/by-slug/${slug}`).expect(200);
    const dee = res.body.designers.find((d: { id: string }) => d.id === dsgMemberId);
    expect(dee).toBeDefined();
    expect(dee.services.map((s: { name: string }) => s.name)).toEqual(["Men's cut"]); // Balayage was deactivated
    expect(JSON.stringify(res.body)).not.toContain('@test.local');
    expect(JSON.stringify(res.body)).not.toContain('userId');
  });

  it('hiding a member removes them from the public page', async () => {
    await api()
      .patch(`/salons/${salonId}/members/${dsgMemberId}`)
      .set(auth(mgrToken))
      .send({ acceptsBookings: false })
      .expect(200);
    const res = await api().get(`/salons/by-slug/${slug}`).expect(200);
    expect(res.body.designers.some((d: { id: string }) => d.id === dsgMemberId)).toBe(false);
  });

  it('removing a member soft-deletes: they lose access but the row survives', async () => {
    await api().delete(`/salons/${salonId}/members/${dsgMemberId}`).set(auth(mgrToken)).expect(204);
    await api().get(`/salons/${salonId}`).set(auth(dsgToken)).expect(403);
    const mine = await api().get('/salons/mine').set(auth(dsgToken)).expect(200);
    expect(mine.body).toEqual([]);
  });
});
