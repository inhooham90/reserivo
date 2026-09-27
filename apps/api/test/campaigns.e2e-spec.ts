import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { approveBusiness } from './business.js';
import { CampaignsService } from '../src/campaigns/campaigns.service.js';
import { MarketingMailer } from '../src/campaigns/marketing-mailer.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Email campaigns. The sweep takes its clock as an argument and the scheduler
 * bails on NODE_ENV=test, so these drive sweep() directly.
 *
 * The mailer is unconfigured in tests and logs instead of sending, which is
 * the same arrangement transactional email has — spying on it is how we see
 * who would have been mailed.
 */
describe('Campaigns (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let campaigns: CampaignsService;
  const stamp = Date.now();
  const pw = 'correct horse battery';
  const owner = { email: `camp-own-${stamp}@test.local`, password: pw, name: 'Mara Manager' };
  const designer = { email: `camp-dsg-${stamp}@test.local`, password: pw, name: 'Dee Designer' };

  let ownToken = '';
  let dsgToken = '';
  let salonId = '';
  let regularId = '';
  let lapsedId = '';

  const api = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  /** Sweeps and reports which addresses the mailer was asked to send to. */
  const sweepSendingTo = async () => {
    const spy = vi.spyOn(app.get(MarketingMailer), 'send');
    try {
      await campaigns.sweep();
      return spy.mock.calls.map((c) => c[0].to);
    } finally {
      spy.mockRestore();
    }
  };

  const tokenFor = async (customerId: string) =>
    (await prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { unsubscribeToken: true } }))
      .unsubscribeToken;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
    campaigns = app.get(CampaignsService);

    ownToken = (await api().post('/auth/register').send(owner).expect(201)).body.accessToken;
    dsgToken = (await api().post('/auth/register').send(designer).expect(201)).body.accessToken;
    await approveBusiness(app, owner.email);
    salonId = (
      await api()
        .post('/salons')
        .set(auth(ownToken))
        .send({ name: 'Campaign Salon', slug: `campaigns-${stamp}`, timezone: 'America/Los_Angeles' })
        .expect(201)
    ).body.id;

    const inv = await api()
      .post(`/salons/${salonId}/invitations`)
      .set(auth(ownToken))
      .send({ email: designer.email, roles: ['DESIGNER'] })
      .expect(201);
    await api().post(`/invitations/${inv.body.inviteUrl.split('/invite/')[1]}/accept`).set(auth(dsgToken)).expect(200);

    const addCustomer = async (body: Record<string, unknown>) =>
      (await api().post(`/salons/${salonId}/customers`).set(auth(ownToken)).send(body).expect(201)).body.id;

    regularId = await addCustomer({ name: 'Rita Regular', email: `camp-rita-${stamp}@test.local`, tags: ['vip'] });
    lapsedId = await addCustomer({ name: 'Leo Lapsed', email: `camp-leo-${stamp}@test.local` });
    // Nobody can be emailed without an address, whatever the audience says.
    await addCustomer({ name: 'Nora Nophone' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('counts the audience without ever returning addresses', async () => {
    const res = await api().get(`/salons/${salonId}/campaigns/audience`).set(auth(ownToken)).expect(200);
    expect(res.body.total).toBe(2); // Nora has no email.
    expect(res.body.sampleNames).toContain('Rita Regular');
    expect(JSON.stringify(res.body)).not.toContain('@test.local');
    expect(res.body.remainingToday).toBe(1000);
  });

  it('narrows the audience by tag', async () => {
    const res = await api().get(`/salons/${salonId}/campaigns/audience?tag=vip`).set(auth(ownToken)).expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.sampleNames).toEqual(['Rita Regular']);
  });

  it('refuses a designer everywhere, because only managers see client addresses', async () => {
    await api().get(`/salons/${salonId}/campaigns`).set(auth(dsgToken)).expect(403);
    await api().get(`/salons/${salonId}/campaigns/audience`).set(auth(dsgToken)).expect(403);
    await api()
      .post(`/salons/${salonId}/campaigns`)
      .set(auth(dsgToken))
      .send({ subject: 'Hi', body: 'Hello' })
      .expect(403);
  });

  it('refuses an audience that matches nobody rather than sending nothing quietly', async () => {
    await api()
      .post(`/salons/${salonId}/campaigns`)
      .set(auth(ownToken))
      .send({ subject: 'Hi', body: 'Hello', audience: { tag: 'nobody-has-this' } })
      .expect(400);
  });

  it('queues a campaign, sends each person once, and never sends again', async () => {
    const created = await api()
      .post(`/salons/${salonId}/campaigns`)
      .set(auth(ownToken))
      .send({ subject: 'Spring colour', body: 'We have space this month.' })
      .expect(201);
    expect(created.body).toMatchObject({ status: 'QUEUED', recipientCount: 2, sentCount: 0, sentByName: 'Mara Manager' });

    const first = await sweepSendingTo();
    expect(first.sort()).toEqual([`camp-leo-${stamp}@test.local`, `camp-rita-${stamp}@test.local`].sort());

    // The claim holds: a second sweep has nothing left to do.
    expect(await sweepSendingTo()).toEqual([]);

    const list = await api().get(`/salons/${salonId}/campaigns`).set(auth(ownToken)).expect(200);
    expect(list.body[0]).toMatchObject({ status: 'SENT', sentCount: 2, failedCount: 0 });
    expect(list.body[0].completedAt).not.toBeNull();
  });

  it('honours a one-click unsubscribe, with no account and no confirmation step', async () => {
    const token = await tokenFor(lapsedId);
    const res = await api().post(`/public/unsubscribe/${token}`).expect(200);
    expect(res.body).toEqual({ salonName: 'Campaign Salon', scope: 'SALON' });

    // Idempotent: a mail client may post more than once.
    await api().post(`/public/unsubscribe/${token}`).expect(200);

    const after = await api().get(`/salons/${salonId}/campaigns/audience`).set(auth(ownToken)).expect(200);
    expect(after.body.total).toBe(1);
  });

  it('rejects an unsubscribe token that is not ours', async () => {
    await api().post('/public/unsubscribe/not-a-real-token').expect(404);
  });

  it('skips someone who unsubscribes between composing and sending', async () => {
    // Re-subscribe Leo so he is in the audience when the campaign is written…
    const token = await tokenFor(lapsedId);
    await api().post(`/public/unsubscribe/${token}/scope`).send({ scope: 'NONE' }).expect(200);

    const created = await api()
      .post(`/salons/${salonId}/campaigns`)
      .set(auth(ownToken))
      .send({ subject: 'Second send', body: 'Still here.' })
      .expect(201);
    expect(created.body.recipientCount).toBe(2);

    // …then he unsubscribes before the sweep runs.
    await api().post(`/public/unsubscribe/${token}`).expect(200);

    const sentTo = await sweepSendingTo();
    expect(sentTo).toEqual([`camp-rita-${stamp}@test.local`]);

    const skipped = await prisma.emailCampaignRecipient.findFirst({
      where: { campaignId: created.body.id, customerId: lapsedId },
    });
    expect(skipped?.status).toBe('SKIPPED');
  });

  it('records a failed send against the recipient without stopping the rest', async () => {
    await api()
      .post(`/salons/${salonId}/campaigns`)
      .set(auth(ownToken))
      .send({ subject: 'Third send', body: 'Testing failure.' })
      .expect(201);

    const spy = vi.spyOn(app.get(MarketingMailer), 'send').mockRejectedValue(new Error('Resend is down'));
    try {
      await campaigns.sweep();
    } finally {
      spy.mockRestore();
    }

    const list = await api().get(`/salons/${salonId}/campaigns`).set(auth(ownToken)).expect(200);
    expect(list.body[0]).toMatchObject({ subject: 'Third send', status: 'SENT', sentCount: 0, failedCount: 1 });

    const row = await prisma.emailCampaignRecipient.findFirst({ where: { campaignId: list.body[0].id } });
    expect(row?.status).toBe('FAILED');
    expect(row?.error).toContain('Resend is down');
  });

  it('counts a campaign against the salon’s daily allowance', async () => {
    const res = await api().get(`/salons/${salonId}/campaigns/audience`).set(auth(ownToken)).expect(200);
    // Three campaigns have been queued above: 2 + 2 + 1 recipients.
    expect(res.body.remainingToday).toBe(1000 - 5);
  });

  describe('wider opt-outs', () => {
    let otherSalonId = '';
    const ritaEmail = `camp-rita-${stamp}@test.local`;
    const audienceAt = async (id: string) =>
      (await api().get(`/salons/${id}/campaigns/audience`).set(auth(ownToken)).expect(200)).body.total as number;

    beforeAll(async () => {
      // Rita is also a client somewhere else, which is the whole point of an
      // address-level opt-out. Stored in different case to prove the match
      // does not depend on how a salon typed the address.
      otherSalonId = (
        await api()
          .post('/salons')
          .set(auth(ownToken))
          .send({ name: 'Second Salon', slug: `campaigns-2-${stamp}`, timezone: 'America/Los_Angeles' })
          .expect(201)
      ).body.id;
      const other = await api()
        .post(`/salons/${otherSalonId}/customers`)
        .set(auth(ownToken))
        .send({ name: 'Rita Regular', email: ritaEmail })
        .expect(201);
      await prisma.customer.update({ where: { id: other.body.id }, data: { email: ritaEmail.toUpperCase() } });
    });

    it('stops every salon’s promotions from one salon’s link', async () => {
      expect(await audienceAt(otherSalonId)).toBe(1);
      const token = await tokenFor(regularId);
      const res = await api().post(`/public/unsubscribe/${token}/scope`).send({ scope: 'MARKETING' }).expect(200);
      expect(res.body).toEqual({ salonName: 'Campaign Salon', scope: 'MARKETING' });
      expect(await audienceAt(otherSalonId)).toBe(0);
    });

    it('never lets a repeated one-click narrow that choice', async () => {
      const token = await tokenFor(regularId);
      const res = await api().post(`/public/unsubscribe/${token}`).expect(200);
      expect(res.body.scope).toBe('MARKETING');
    });

    it('skips an address-level opt-out at send time too', async () => {
      // Queue at the second salon while she is mailable, then opt out wider.
      const token = await tokenFor(regularId);
      await api().post(`/public/unsubscribe/${token}/scope`).send({ scope: 'SALON' }).expect(200);
      expect(await audienceAt(otherSalonId)).toBe(1);
      await api()
        .post(`/salons/${otherSalonId}/campaigns`)
        .set(auth(ownToken))
        .send({ subject: 'Elsewhere', body: 'From the second salon.' })
        .expect(201);
      await api().post(`/public/unsubscribe/${token}/scope`).send({ scope: 'ALL' }).expect(200);
      expect(await sweepSendingTo()).toEqual([]);
    });

    it('records ALL against the address, and NONE clears everything', async () => {
      expect(await prisma.emailSuppression.findUnique({ where: { email: ritaEmail } })).toMatchObject({ scope: 'ALL' });

      const token = await tokenFor(regularId);
      const res = await api().post(`/public/unsubscribe/${token}/scope`).send({ scope: 'NONE' }).expect(200);
      expect(res.body.scope).toBe('NONE');
      expect(await prisma.emailSuppression.findUnique({ where: { email: ritaEmail } })).toBeNull();
      const rita = await prisma.customer.findUniqueOrThrow({ where: { id: regularId }, select: { emailOptOutAt: true } });
      expect(rita.emailOptOutAt).toBeNull();
    });

    it('refuses a scope it does not know', async () => {
      const token = await tokenFor(regularId);
      await api().post(`/public/unsubscribe/${token}/scope`).send({ scope: 'EVERYTHING' }).expect(400);
    });
  });
});
