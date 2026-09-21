import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/** Phase 4: the site-admin console — search, acting as a user, and the audit log. */
describe('Phase 4 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const pw = 'correct horse battery';
  const admin = { email: `p4adm-${stamp}@test.local`, password: pw, name: 'Ada Admin' };
  const other = { email: `p4oth-${stamp}@test.local`, password: pw, name: 'Otto Admin' };
  const target = { email: `p4dsg-${stamp}@test.local`, password: pw, name: 'Dee Designer' };

  let adminToken = '';
  let targetToken = '';
  let adminUserId = '';
  let otherUserId = '';
  let targetUserId = '';
  let salonId = '';
  let slug = '';
  let targetMemberId = '';
  let actingToken = '';

  const api = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const makeAdmin = (id: string) => prisma.user.update({ where: { id }, data: { isSiteAdmin: true } });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

    for (const [who, box] of [
      [admin, (t: string, id: string) => ((adminToken = t), (adminUserId = id))],
      [other, (_t: string, id: string) => (otherUserId = id)],
      [target, (t: string, id: string) => ((targetToken = t), (targetUserId = id))],
    ] as const) {
      const res = await api().post('/auth/register').send(who).expect(201);
      box(res.body.accessToken, res.body.user.id);
    }

    slug = `phase4-${stamp}`;
    salonId = (
      await api()
        .post('/salons')
        .set(auth(adminToken))
        .send({ name: 'Phase Four Salon', slug, timezone: 'America/Los_Angeles' })
        .expect(201)
    ).body.id;
    const inv = await api()
      .post(`/salons/${salonId}/invitations`)
      .set(auth(adminToken))
      .send({ email: target.email, roles: ['DESIGNER'] })
      .expect(201);
    targetMemberId = (
      await api().post(`/invitations/${inv.body.inviteUrl.split('/invite/')[1]}/accept`).set(auth(targetToken)).expect(200)
    ).body.membershipId;

    // Ada becomes the site admin. JwtStrategy reads the user per request, so the flag takes effect at once.
    await makeAdmin(adminUserId);
    await makeAdmin(otherUserId);
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------- Access ----------

  it('every admin route is closed to ordinary users', async () => {
    for (const path of ['/admin/stats', '/admin/users', '/admin/salons', '/admin/audit', `/admin/users/${adminUserId}`]) {
      await api().get(path).set(auth(targetToken)).expect(403);
    }
    await api().post(`/admin/impersonate/${adminUserId}`).set(auth(targetToken)).expect(403);
    await api().get('/admin/stats').expect(401);
  });

  it('reports platform stats', async () => {
    const res = await api().get('/admin/stats').set(auth(adminToken)).expect(200);
    expect(res.body.users).toBeGreaterThanOrEqual(3);
    expect(res.body.salons).toBeGreaterThanOrEqual(1);
    expect(res.body).toHaveProperty('bookedLast7Days');
  });

  // ---------- Search ----------

  it('finds people and salons, and reports how they are connected', async () => {
    const users = await api().get('/admin/users').set(auth(adminToken)).query({ q: target.email }).expect(200);
    expect(users.body).toHaveLength(1);
    expect(users.body[0]).toMatchObject({ email: target.email, isSiteAdmin: false, salonCount: 1 });

    const salons = await api().get('/admin/salons').set(auth(adminToken)).query({ q: slug }).expect(200);
    expect(salons.body).toHaveLength(1);
    expect(salons.body[0]).toMatchObject({ slug, memberCount: 2 });

    const detail = await api().get(`/admin/users/${targetUserId}`).set(auth(adminToken)).expect(200);
    expect(detail.body.canImpersonate).toBe(true);
    expect(detail.body.memberships).toEqual([
      expect.objectContaining({ salonId, salonSlug: slug, roles: ['DESIGNER'], status: 'ACTIVE' }),
    ]);

    const salonDetail = await api().get(`/admin/salons/${salonId}`).set(auth(adminToken)).expect(200);
    expect(salonDetail.body.members.map((m: { email: string }) => m.email).sort()).toEqual([admin.email, target.email].sort());
    expect(salonDetail.body.policies).toMatchObject({ slotIntervalMin: 15 });
  });

  // ---------- Acting as ----------

  it('refuses to act as yourself or as another site admin', async () => {
    const self = await api().post(`/admin/impersonate/${adminUserId}`).set(auth(adminToken)).expect(409);
    expect(self.body.message).toMatch(/already yourself/i);

    const peer = await api().post(`/admin/impersonate/${otherUserId}`).set(auth(adminToken)).expect(403);
    expect(peer.body.message).toMatch(/cannot act as one another/i);

    const detail = await api().get(`/admin/users/${otherUserId}`).set(auth(adminToken)).expect(200);
    expect(detail.body.canImpersonate).toBe(false);
  });

  it('hands back a token that acts as the user — and sets no refresh cookie', async () => {
    const res = await api().post(`/admin/impersonate/${targetUserId}`).set(auth(adminToken)).expect(200);
    expect(res.body.user).toMatchObject({ id: targetUserId, email: target.email, actorUserId: adminUserId });
    // Impersonation must not survive its access token: the admin's own session stays underneath.
    expect(res.headers['set-cookie']).toBeUndefined();
    actingToken = res.body.accessToken;

    const me = await api().get('/auth/me').set(auth(actingToken)).expect(200);
    expect(me.body).toMatchObject({ id: targetUserId, actorUserId: adminUserId });
  });

  it('the acting token is the user, not the admin: no admin routes, their own salons', async () => {
    const blocked = await api().get('/admin/stats').set(auth(actingToken)).expect(403);
    expect(blocked.body.message).toMatch(/stop acting as/i);
    await api().post(`/admin/impersonate/${otherUserId}`).set(auth(actingToken)).expect(403);

    const mine = await api().get('/salons/mine').set(auth(actingToken)).expect(200);
    expect(mine.body).toEqual([expect.objectContaining({ id: salonId, roles: ['DESIGNER'] })]);
  });

  it('records the switch, and attributes later actions to the admin as well as the user', async () => {
    await api()
      .patch(`/salons/${salonId}/members/${targetMemberId}`)
      .set(auth(actingToken))
      .send({ bio: 'Edited while being helped' })
      .expect(200);

    // Scoped to this admin: the suite shares a database, so an unfiltered page
    // fills up with other specs' rows.
    const res = await api()
      .get('/admin/audit')
      .set(auth(adminToken))
      .query({ impersonatedOnly: 'true', actorUserId: adminUserId, limit: 100 })
      .expect(200);
    const edit = res.body.entries.find((e: { action: string }) => e.action.includes('members'));
    expect(edit).toMatchObject({
      actor: { id: adminUserId, name: admin.name },
      impersonated: { id: targetUserId, name: target.name },
      salon: { id: salonId },
    });

    // The switch itself is its own labelled row, and the token never lands in the log.
    const all = await api().get('/admin/audit').set(auth(adminToken)).query({ actorUserId: adminUserId, limit: 100 }).expect(200);
    const start = all.body.entries.find((e: { action: string }) => e.action === 'admin.impersonate.start');
    expect(start).toMatchObject({ actor: { id: adminUserId }, entityType: 'users', entityId: targetUserId });
    expect(start.impersonated).toBeNull();
    expect(JSON.stringify(all.body)).not.toContain(actingToken.slice(0, 30));
  });

  // ---------- Audit log ----------

  it('filters by salon and entity, and pages with a cursor', async () => {
    const bySalon = await api().get('/admin/audit').set(auth(adminToken)).query({ salonId, limit: 100 }).expect(200);
    expect(bySalon.body.entries.length).toBeGreaterThan(0);
    for (const e of bySalon.body.entries) expect(e.salon.id).toBe(salonId);

    const byEntity = await api().get('/admin/audit').set(auth(adminToken)).query({ entityType: 'salons', limit: 100 }).expect(200);
    for (const e of byEntity.body.entries) expect(e.entityType).toBe('salons');

    const first = await api().get('/admin/audit').set(auth(adminToken)).query({ limit: 1 }).expect(200);
    expect(first.body.entries).toHaveLength(1);
    expect(first.body.nextCursor).toEqual(expect.any(String));

    const second = await api().get('/admin/audit').set(auth(adminToken)).query({ limit: 1, cursor: first.body.nextCursor }).expect(200);
    expect(second.body.entries[0].id).not.toBe(first.body.entries[0].id);
  });

  it('never stores a password, even from the registration that created these users', async () => {
    const all = await api().get('/admin/audit').set(auth(adminToken)).query({ limit: 100 }).expect(200);
    expect(JSON.stringify(all.body)).not.toContain(pw);
  });
});
