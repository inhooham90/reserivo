import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Business accounts: only an account a site admin approved may create a
 * business, while belonging to one (an ACTIVE membership) is enough to count
 * as a business account.
 */
describe('Business accounts (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const pw = 'correct horse battery';
  const admin = { email: `bizadm-${stamp}@test.local`, password: pw, name: 'Ada Admin' };
  const owner = { email: `bizown-${stamp}@test.local`, password: pw, name: 'Olive Owner' };
  const member = { email: `bizmem-${stamp}@test.local`, password: pw, name: 'Max Member' };

  let adminToken = '';
  let ownerToken = '';
  let memberToken = '';
  let ownerUserId = '';
  let memberUserId = '';
  let salonId = '';
  let approvedAt = '';

  const api = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const me = async (t: string) => (await api().get('/auth/me').set(auth(t)).expect(200)).body;
  const createSalon = (t: string, slug: string) =>
    api().post('/salons').set(auth(t)).send({ name: 'Biz Salon', slug, timezone: 'America/Los_Angeles' });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

    const a = await api().post('/auth/register').send(admin).expect(201);
    adminToken = a.body.accessToken;
    // JwtStrategy re-reads the user per request, so the flag takes effect at once.
    await prisma.user.update({ where: { id: a.body.user.id }, data: { isSiteAdmin: true } });

    const m = await api().post('/auth/register').send(member).expect(201);
    memberToken = m.body.accessToken;
    memberUserId = m.body.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('a fresh account is personal and cannot create a business', async () => {
    const res = await api().post('/auth/register').send(owner).expect(201);
    ownerToken = res.body.accessToken;
    ownerUserId = res.body.user.id;
    expect(res.body.user).toMatchObject({ isBusinessAccount: false, canCreateBusiness: false });
    expect(await me(ownerToken)).toMatchObject({ isBusinessAccount: false, canCreateBusiness: false });

    const refused = await createSalon(ownerToken, `biz-refused-${stamp}`).expect(403);
    expect(refused.body.message).toMatch(/not approved/i);
  });

  it('a non-admin cannot approve anyone, themselves included', async () => {
    await api().post(`/admin/users/${ownerUserId}/business-approval`).set(auth(ownerToken)).expect(403);
    await api().delete(`/admin/users/${ownerUserId}/business-approval`).set(auth(ownerToken)).expect(403);
    await api().post(`/admin/users/${ownerUserId}/business-approval`).expect(401);
  });

  it('a site admin approves the account, which may then create a business', async () => {
    const res = await api().post(`/admin/users/${ownerUserId}/business-approval`).set(auth(adminToken)).expect(200);
    expect(res.body).toMatchObject({ id: ownerUserId, businessApprovedAt: expect.any(String), isBusinessAccount: true });
    approvedAt = res.body.businessApprovedAt;

    expect(await me(ownerToken)).toMatchObject({ isBusinessAccount: true, canCreateBusiness: true });
    salonId = (await createSalon(ownerToken, `biz-${stamp}`).expect(201)).body.id;
  });

  it('approving again is a no-op that keeps the original time', async () => {
    const res = await api().post(`/admin/users/${ownerUserId}/business-approval`).set(auth(adminToken)).expect(200);
    expect(res.body.businessApprovedAt).toBe(approvedAt);
  });

  it('an invited team member is a business account but cannot create a business', async () => {
    expect(await me(memberToken)).toMatchObject({ isBusinessAccount: false, canCreateBusiness: false });

    const inv = await api()
      .post(`/salons/${salonId}/invitations`)
      .set(auth(ownerToken))
      .send({ email: member.email, roles: ['DESIGNER'] })
      .expect(201);
    await api().post(`/invitations/${inv.body.inviteUrl.split('/invite/')[1]}/accept`).set(auth(memberToken)).expect(200);

    expect(await me(memberToken)).toMatchObject({ isBusinessAccount: true, canCreateBusiness: false });
    await createSalon(memberToken, `biz-member-${stamp}`).expect(403);

    const detail = await api().get(`/admin/users/${memberUserId}`).set(auth(adminToken)).expect(200);
    expect(detail.body).toMatchObject({ businessApprovedAt: null, isBusinessAccount: true });
  });

  it('the accounts list filters by approval', async () => {
    const approved = await api().get('/admin/users').set(auth(adminToken)).query({ q: `${stamp}`, business: 'approved' }).expect(200);
    expect(approved.body.map((u: { email: string }) => u.email)).toEqual([owner.email]);
    expect(approved.body[0]).toMatchObject({ businessApprovedAt: approvedAt, isBusinessAccount: true });

    const unapproved = await api()
      .get('/admin/users')
      .set(auth(adminToken))
      .query({ q: `${stamp}`, business: 'unapproved' })
      .expect(200);
    const emails = unapproved.body.map((u: { email: string }) => u.email);
    expect(emails).not.toContain(owner.email);
    expect(emails).toEqual(expect.arrayContaining([admin.email, member.email]));
  });

  it('revoking stops new businesses but leaves the account a business account while it belongs to one', async () => {
    const res = await api().delete(`/admin/users/${ownerUserId}/business-approval`).set(auth(adminToken)).expect(200);
    expect(res.body).toMatchObject({ businessApprovedAt: null, isBusinessAccount: true });

    expect(await me(ownerToken)).toMatchObject({ isBusinessAccount: true, canCreateBusiness: false });
    await createSalon(ownerToken, `biz-again-${stamp}`).expect(403);
    // The business it already runs is untouched.
    await api().get(`/salons/${salonId}`).set(auth(ownerToken)).expect(200);
  });
});
