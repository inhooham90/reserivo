import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { approveBusiness } from './business.js';

/** The guided setup's batch create: one request, all or nothing, appended in order. */
describe('Services bulk create (e2e)', () => {
  let app: INestApplication;
  const stamp = Date.now();
  const pw = 'correct horse battery';
  const owner = { email: `bulk-own-${stamp}@test.local`, password: pw, name: 'Olive Owner' };
  const stranger = { email: `bulk-str-${stamp}@test.local`, password: pw, name: 'Sam Stranger' };

  let ownerToken = '';
  let strangerToken = '';
  let salonId = '';

  const api = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const listNames = async () =>
    (await api().get(`/salons/${salonId}/services`).set(auth(ownerToken)).expect(200)).body.map((s: { name: string }) => s.name);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    ownerToken = (await api().post('/auth/register').send(owner).expect(201)).body.accessToken;
    strangerToken = (await api().post('/auth/register').send(stranger).expect(201)).body.accessToken;
    await approveBusiness(app, owner.email);
    const salon = await api()
      .post('/salons')
      .set(auth(ownerToken))
      .send({ name: 'Bulk Salon', slug: `bulk-${stamp}`, timezone: 'America/New_York' })
      .expect(201);
    salonId = salon.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a whole menu for the caller, after what they already had, in the order given', async () => {
    await api().post(`/salons/${salonId}/services`).set(auth(ownerToken)).send({ name: 'Existing', priceCents: 1000, durationMin: 30 }).expect(201);

    const res = await api()
      .post(`/salons/${salonId}/services/bulk`)
      .set(auth(ownerToken))
      .send({
        services: [
          { name: 'Pedicure', priceCents: 4500, durationMin: 45 },
          { name: 'Gel manicure', priceCents: 4000, durationMin: 45 },
          { name: 'Acrylic full set', priceCents: 7000, durationMin: 75, allowsDoubleBooking: true },
        ],
      })
      .expect(201);
    expect(res.body.map((s: { name: string }) => s.name)).toEqual(['Pedicure', 'Gel manicure', 'Acrylic full set']);
    expect(res.body[2]).toMatchObject({ active: true, bufferMin: 0, allowsDoubleBooking: true });
    expect(await listNames()).toEqual(['Existing', 'Pedicure', 'Gel manicure', 'Acrylic full set']);
  });

  it('refuses the whole batch when one item is invalid', async () => {
    const res = await api()
      .post(`/salons/${salonId}/services/bulk`)
      .set(auth(ownerToken))
      .send({
        services: [
          { name: 'Fine', priceCents: 1000, durationMin: 30 },
          { name: 'Too short to share', priceCents: 1000, durationMin: 30, allowsDoubleBooking: true },
        ],
      })
      .expect(400);
    expect(res.body.issues[0].path).toBe('services.1.allowsDoubleBooking');
    expect(await listNames()).not.toContain('Fine');
  });

  it('refuses an empty or oversized batch, and anyone outside the business', async () => {
    await api().post(`/salons/${salonId}/services/bulk`).set(auth(ownerToken)).send({ services: [] }).expect(400);
    const many = Array.from({ length: 51 }, (_, i) => ({ name: `S${i}`, priceCents: 100, durationMin: 30 }));
    await api().post(`/salons/${salonId}/services/bulk`).set(auth(ownerToken)).send({ services: many }).expect(400);
    await api()
      .post(`/salons/${salonId}/services/bulk`)
      .set(auth(strangerToken))
      .send({ services: [{ name: 'Nope', priceCents: 100, durationMin: 30 }] })
      .expect(403);
  });
});
