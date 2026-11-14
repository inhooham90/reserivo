import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { addDays, localToUtc, todayIn } from '@reserivo/shared';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { approveBusiness } from './business.js';

/** A business's public phone and address: managers set them, clients see them wherever they need to reach the business. */
describe('Business contact details (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const pw = 'correct horse battery';
  const LA = 'America/Los_Angeles';
  const owner = { email: `contact-own-${stamp}@test.local`, password: pw, name: 'Cora Owner' };
  const stylist = { email: `contact-dsg-${stamp}@test.local`, password: pw, name: 'Dana Stylist' };
  const client = { email: `contact-cli-${stamp}@test.local`, password: pw, name: 'Cal Client' };
  const slug = `contact-${stamp}`;
  let ownerToken = '';
  let stylistToken = '';
  let clientToken = '';
  let salonId = '';
  let serviceId = '';
  let ownerMemberId = '';

  const api = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    ownerToken = (await api().post('/auth/register').send(owner).expect(201)).body.accessToken;
    stylistToken = (await api().post('/auth/register').send(stylist).expect(201)).body.accessToken;
    clientToken = (await api().post('/auth/register').send(client).expect(201)).body.accessToken;
    await approveBusiness(app, owner.email);
    salonId = (await api().post('/salons').set(auth(ownerToken)).send({ name: 'Contact Salon', slug, timezone: LA }).expect(201)).body.id;
    ownerMemberId = (await api().get(`/salons/${salonId}/members`).set(auth(ownerToken)).expect(200)).body[0].id;

    const inv = await api().post(`/salons/${salonId}/invitations`).set(auth(ownerToken)).send({ email: stylist.email, roles: ['DESIGNER'] }).expect(201);
    await api().post(`/invitations/${inv.body.inviteUrl.split('/invite/')[1]}/accept`).set(auth(stylistToken)).expect(200);

    await api().patch(`/salons/${salonId}`).set(auth(ownerToken)).send({ slotIntervalMin: 60 }).expect(200);
    const allWeek = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMinutes: 540, endMinutes: 1020 }));
    await api().put(`/salons/${salonId}/hours/rules`).set(auth(ownerToken)).send({ rules: allWeek }).expect(200);
    await api().put(`/salons/${salonId}/members/${ownerMemberId}/availability/rules`).set(auth(ownerToken)).send({ rules: allWeek }).expect(200);
    serviceId = (await api().post(`/salons/${salonId}/services`).set(auth(ownerToken)).send({ name: 'Cut', priceCents: 5000, durationMin: 60 }).expect(201)).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('starts empty, and refuses a number that is not one', async () => {
    const salon = (await api().get(`/salons/by-slug/${slug}`).expect(200)).body;
    expect(salon.phone).toBeNull();
    expect(salon.address).toBeNull();
    await api().patch(`/salons/${salonId}`).set(auth(ownerToken)).send({ phone: 'call me maybe' }).expect(400);
    await api().patch(`/salons/${salonId}`).set(auth(ownerToken)).send({ phone: '12' }).expect(400);
  });

  it('only managers set it, and it reaches the public booking page', async () => {
    const contact = { phone: ' (555) 010-2030 ', address: '12 Main St\nSpringfield, IL 62701' };
    await api().patch(`/salons/${salonId}`).set(auth(stylistToken)).send(contact).expect(403);
    const saved = (await api().patch(`/salons/${salonId}`).set(auth(ownerToken)).send(contact).expect(200)).body;
    expect(saved.phone).toBe('(555) 010-2030');
    const salon = (await api().get(`/salons/by-slug/${slug}`).expect(200)).body;
    expect(salon).toMatchObject({ phone: '(555) 010-2030', address: '12 Main St\nSpringfield, IL 62701' });
  });

  it("is on the client's booking confirmation and in their reservations", async () => {
    const day = addDays(todayIn(LA), 7);
    const booked = await api()
      .post(`/public/salons/${slug}/appointments`)
      .set(auth(clientToken))
      .send({ serviceId, designerId: ownerMemberId, startAt: localToUtc(day, 600, LA).toISOString(), customer: { name: client.name, email: client.email } })
      .expect(201);
    expect(booked.body.salon).toMatchObject({ phone: '(555) 010-2030', address: '12 Main St\nSpringfield, IL 62701' });

    const mine = (await api().get('/me/appointments').set(auth(clientToken)).expect(200)).body;
    expect(mine.find((a: { id: string }) => a.id === booked.body.id).salon.phone).toBe('(555) 010-2030');
  });

  it('an emptied field clears it rather than storing a blank', async () => {
    const saved = (await api().patch(`/salons/${salonId}`).set(auth(ownerToken)).send({ phone: '   ', address: '' }).expect(200)).body;
    expect(saved.phone).toBeNull();
    expect(saved.address).toBeNull();
  });
});
