import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startHarness, type Harness } from '../helpers/harness';

/**
 * End-to-end coverage of the `customers` slice over the REAL stack (Postgres +
 * Redis in containers): the full middleware chain on a real product resource,
 * idempotent writes, the per-(org,env) email guard, and — critically — tenant
 * isolation (Tenant A cannot see Tenant B's customer on any endpoint).
 */
describe('customers e2e', () => {
  let harness: Harness;
  let bearerA: string;
  let bearerB: string;

  beforeAll(async () => {
    harness = await startHarness();
    const orgA = await harness.seedOrg('Org A');
    const orgB = await harness.seedOrg('Org B');
    bearerA = (await harness.mintApiKey(orgA.organizationId, 'test', [
      'customers:read',
      'customers:write',
    ])).secret;
    bearerB = (await harness.mintApiKey(orgB.organizationId, 'test', [
      'customers:read',
      'customers:write',
    ])).secret;
  });

  afterAll(async () => {
    await harness?.stop();
  });

  const asA = (req: request.Test): request.Test => req.set('Authorization', `Bearer ${bearerA}`);
  const asB = (req: request.Test): request.Test => req.set('Authorization', `Bearer ${bearerB}`);

  it('POST creates, GET resolves, GET lists, PATCH updates', async () => {
    const created = await asA(request(harness.app).post('/v1/customers'))
      .set('Idempotency-Key', `cus-create-${Date.now()}`)
      .send({ email: 'ada@acme.test', name: 'Ada Lovelace', phone: '+2348000000001' });

    expect(created.status).toBe(201);
    expect(created.body.success).toBe(true);
    expect(created.body.data.id).toMatch(/cus$/);
    expect(created.body.data.email).toBe('ada@acme.test');
    expect(created.body.data.phone).toBe('+2348000000001');
    expect(created.body.meta.requestId).toMatch(/^req_/);
    const reference = created.body.data.id as string;

    const fetched = await asA(request(harness.app).get(`/v1/customers/${reference}`));
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.id).toBe(reference);

    const listed = await asA(request(harness.app).get('/v1/customers').query({ limit: 10 }));
    expect(listed.status).toBe(200);
    expect(listed.body.pagination).toMatchObject({ limit: 10 });
    expect(listed.body.data.some((c: { id: string }) => c.id === reference)).toBe(true);

    const updated = await asA(request(harness.app).patch(`/v1/customers/${reference}`))
      .set('Idempotency-Key', `cus-update-${Date.now()}`)
      .send({ name: 'Ada B. Lovelace' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe('Ada B. Lovelace');
    expect(updated.body.data.email).toBe('ada@acme.test');
  });

  it('idempotent replay returns the same customer for the same key', async () => {
    const key = `cus-replay-${Date.now()}`;
    const body = { email: `replay+${Date.now()}@acme.test`, name: 'Replay' };
    const first = await asA(request(harness.app).post('/v1/customers'))
      .set('Idempotency-Key', key)
      .send(body);
    expect(first.status).toBe(201);

    const replay = await asA(request(harness.app).post('/v1/customers'))
      .set('Idempotency-Key', key)
      .send(body);
    expect(replay.body.success).toBe(true);
    expect(replay.body.data.id).toBe(first.body.data.id);
  });

  it('duplicate email within the same tenant → 409 CUSTOMER_EMAIL_TAKEN', async () => {
    const email = `dupe+${Date.now()}@acme.test`;
    const ok = await asA(request(harness.app).post('/v1/customers'))
      .set('Idempotency-Key', `cus-dupe-1-${Date.now()}`)
      .send({ email, name: 'First' });
    expect(ok.status).toBe(201);

    const conflict = await asA(request(harness.app).post('/v1/customers'))
      .set('Idempotency-Key', `cus-dupe-2-${Date.now()}`)
      .send({ email, name: 'Second' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('CUSTOMER_EMAIL_TAKEN');
  });

  it('tenant isolation: Tenant A cannot read Tenant B’s customer (404)', async () => {
    const b = await asB(request(harness.app).post('/v1/customers'))
      .set('Idempotency-Key', `cus-iso-${Date.now()}`)
      .send({ email: `b-only+${Date.now()}@acme.test`, name: 'B Only' });
    expect(b.status).toBe(201);
    const bRef = b.body.data.id as string;

    // Same email is free for A — proves per-(org,env) scoping, not a global unique.
    const aSame = await asA(request(harness.app).post('/v1/customers'))
      .set('Idempotency-Key', `cus-iso-a-${Date.now()}`)
      .send({ email: b.body.data.email, name: 'A Same Email' });
    expect(aSame.status).toBe(201);

    // A cannot see B's customer — it simply does not exist in A's scope.
    const cross = await asA(request(harness.app).get(`/v1/customers/${bRef}`));
    expect(cross.status).toBe(404);
    expect(cross.body.error.code).toBe('CUSTOMER_NOT_FOUND');
  });

  it('missing API key → 401; missing Idempotency-Key on write → 400', async () => {
    const noKey = await request(harness.app).get('/v1/customers');
    expect(noKey.status).toBe(401);
    expect(noKey.body.error.code).toBe('API_KEY_MISSING');

    const noIdem = await asA(request(harness.app).post('/v1/customers')).send({
      email: 'x@acme.test',
      name: 'X',
    });
    expect(noIdem.status).toBe(400);
    expect(noIdem.body.error.code).toBe('IDEMPOTENCY_KEY_MISSING');
  });

  it('read-only key on a write route → 403', async () => {
    const orgC = await harness.seedOrg('Org C');
    const readOnly = await harness.mintApiKey(orgC.organizationId, 'test', ['customers:read']);
    const res = await request(harness.app)
      .post('/v1/customers')
      .set('Authorization', `Bearer ${readOnly.secret}`)
      .set('Idempotency-Key', `cus-scope-${Date.now()}`)
      .send({ email: 'c@acme.test', name: 'C' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('API_KEY_SCOPE_FORBIDDEN');
  });
});
