import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startHarness, type Harness } from '../helpers/harness';

/**
 * End-to-end coverage over the REAL stack (Postgres + Redis in containers): the
 * full middleware chain, the example money path, and the auth/scope/env gates.
 * Each assertion checks the platform's ONE envelope shape, not ad-hoc fields.
 */
describe('api e2e', () => {
  let harness: Harness;
  let bearer: string;
  let organizationId: string;

  beforeAll(async () => {
    harness = await startHarness();
    const org = await harness.seedOrg();
    organizationId = org.organizationId;
    const key = await harness.mintApiKey(organizationId, 'sandbox', [
      'example:read',
      'example:write',
    ]);
    bearer = key.secret;
  });

  afterAll(async () => {
    await harness?.stop();
  });

  const auth = (req: request.Test): request.Test => req.set('Authorization', `Bearer ${bearer}`);

  it('GET /v1/health → ok, no auth', async () => {
    const res = await request(harness.app).get('/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ status: 'ok' });
    expect(res.body.meta.requestId).toMatch(/^req_/);
  });

  it('POST /v1/examples creates, GET resolves, GET lists', async () => {
    const idempotencyKey = `it-create-${Date.now()}`;
    const created = await auth(request(harness.app).post('/v1/examples'))
      .set('Idempotency-Key', idempotencyKey)
      .send({ kind: 'standard', amountInKobo: 5000 });

    expect(created.status).toBe(201);
    expect(created.body.success).toBe(true);
    expect(created.body.data.id).toMatch(/exa$/);
    expect(created.body.data.amountInKobo).toBe(5000);
    expect(created.body.data.currency).toBe('NGN');
    const reference = created.body.data.id as string;

    const fetched = await auth(request(harness.app).get(`/v1/examples/${reference}`));
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.id).toBe(reference);

    const listed = await auth(request(harness.app).get('/v1/examples').query({ limit: 10 }));
    expect(listed.status).toBe(200);
    expect(listed.body.success).toBe(true);
    expect(Array.isArray(listed.body.data)).toBe(true);
    expect(listed.body.pagination).toMatchObject({ limit: 10 });
    expect(listed.body.data.some((e: { id: string }) => e.id === reference)).toBe(true);
  });

  it('idempotent replay returns the same resource for the same key', async () => {
    const idempotencyKey = `it-replay-${Date.now()}`;
    const first = await auth(request(harness.app).post('/v1/examples'))
      .set('Idempotency-Key', idempotencyKey)
      .send({ kind: 'priority', amountInKobo: 7000 });
    expect(first.status).toBe(201);

    const replay = await auth(request(harness.app).post('/v1/examples'))
      .set('Idempotency-Key', idempotencyKey)
      .send({ kind: 'priority', amountInKobo: 7000 });
    // Replay re-serves the cached inner data verbatim — same resource id.
    expect(replay.body.success).toBe(true);
    expect(replay.body.data.id).toBe(first.body.data.id);
  });

  it('reused idempotency key with a different body → 422', async () => {
    const idempotencyKey = `it-mismatch-${Date.now()}`;
    await auth(request(harness.app).post('/v1/examples'))
      .set('Idempotency-Key', idempotencyKey)
      .send({ kind: 'standard', amountInKobo: 100 });

    const mismatch = await auth(request(harness.app).post('/v1/examples'))
      .set('Idempotency-Key', idempotencyKey)
      .send({ kind: 'standard', amountInKobo: 999 });
    expect(mismatch.status).toBe(422);
    expect(mismatch.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('missing API key → 401', async () => {
    const res = await request(harness.app).get('/v1/examples');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('API_KEY_MISSING');
  });

  it('invalid API key → 401', async () => {
    const res = await request(harness.app)
      .get('/v1/examples')
      .set('Authorization', 'Bearer nbo_sandbox_not_a_real_key');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('API_KEY_INVALID');
  });

  it('key missing the required scope → 403', async () => {
    const readOnly = await harness.mintApiKey(organizationId, 'sandbox', ['example:read']);
    const res = await request(harness.app)
      .post('/v1/examples')
      .set('Authorization', `Bearer ${readOnly.secret}`)
      .set('Idempotency-Key', `it-scope-${Date.now()}`)
      .send({ kind: 'standard', amountInKobo: 100 });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('API_KEY_SCOPE_FORBIDDEN');
  });

  it('live key on a non-production deployment → 401 (safety guard)', async () => {
    // ONE process serves both modes, but a `live` key is only honoured on a
    // `production` deployment; the harness runs `development`, so it is refused.
    const liveKey = await harness.mintApiKey(organizationId, 'live', ['example:read']);
    const res = await request(harness.app)
      .get('/v1/examples')
      .set('Authorization', `Bearer ${liveKey.secret}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('API_KEY_ENVIRONMENT_MISMATCH');
  });

  it('POST without Idempotency-Key → 400', async () => {
    const res = await auth(request(harness.app).post('/v1/examples')).send({
      kind: 'standard',
      amountInKobo: 100,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_MISSING');
  });

  it('unknown route → 404 envelope', async () => {
    const res = await auth(request(harness.app).get('/v1/nope'));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CLIENT_ROUTE_NOT_FOUND');
    // Tenet 9: every error carries actionable guidance + a docs deep link.
    expect(typeof res.body.error.hint).toBe('string');
    expect(res.body.error.hint.length).toBeGreaterThan(0);
    expect(res.body.error.docUrl).toBe(
      'https://docs.nombaone.com/errors#CLIENT_ROUTE_NOT_FOUND'
    );
  });
});
