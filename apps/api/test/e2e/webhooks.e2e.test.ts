import { createHash, createHmac } from 'node:crypto';
import http from 'node:http';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { webhookDeliveriesTable, webhookEndpointsTable } from '@nombaone/core-db/schema';
import { emitEvent } from '@nombaone/sara/events';
import { deliverPending } from '@nombaone/sara/webhooks';

import { startHarness, type Harness } from '../helpers/harness';

import type { AddressInfo } from 'node:net';

interface Received {
  headers: http.IncomingHttpHeaders;
  rawBody: string;
}

describe('outbound webhooks e2e (G)', () => {
  let harness: Harness;
  let bearerA: string;
  let bearerB: string;
  let ctxA: { organizationId: string; environment: 'test' };

  let server: http.Server;
  let receiverUrl: string;
  let received: Received[] = [];
  let receiverStatus = 200;

  const scopes = ['webhooks:read', 'webhooks:write', 'customers:write'];

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        received.push({ headers: req.headers, rawBody: body });
        res.writeHead(receiverStatus);
        res.end();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    receiverUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;

    harness = await startHarness();
    const orgA = await harness.seedOrg('WH A');
    const orgB = await harness.seedOrg('WH B');
    bearerA = (await harness.mintApiKey(orgA.organizationId, 'test', scopes)).secret;
    bearerB = (await harness.mintApiKey(orgB.organizationId, 'test', scopes)).secret;
    ctxA = { organizationId: orgA.organizationId, environment: 'test' };
  });

  afterAll(async () => {
    await harness?.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const asA = (r: request.Test): request.Test => r.set('Authorization', `Bearer ${bearerA}`);
  let seq = 0;
  const uniq = (): string => `${Date.now()}-${seq++}`;

  const createEndpoint = async (): Promise<{ reference: string; secret: string }> => {
    // Isolate: disable any prior endpoints so this test's emit fans to EXACTLY one
    // active endpoint (else a `*`-endpoint from an earlier test also receives it,
    // signed with its own secret, and the correlation-by-event-id is ambiguous).
    await harness.db
      .update(webhookEndpointsTable)
      .set({ disabledAt: new Date() })
      .where(eq(webhookEndpointsTable.organizationId, ctxA.organizationId));
    const res = await asA(request(harness.app).post('/v1/webhooks'))
      .set('Idempotency-Key', `we-${uniq()}`)
      .send({ url: receiverUrl, enabledEvents: ['*'] });
    expect(res.status).toBe(201);
    return { reference: res.body.data.id, secret: res.body.data.signingSecret };
  };

  // Emit a catalogued event that fans out to the tenant's endpoints; return EVT ref.
  const emit = async (payloadRef: string): Promise<string> => {
    const { reference } = await emitEvent(harness.db, {
      ...ctxA,
      type: 'invoice.paid',
      payload: { reference: payloadRef },
    });
    return reference;
  };

  const findByEventRef = (evtRef: string): Received | undefined =>
    received.find((r) => {
      try {
        return (JSON.parse(r.rawBody) as { event?: { id?: string } }).event?.id === evtRef;
      } catch {
        return false;
      }
    });

  const tenantSignature = (plaintextSecret: string, rawBody: string): string => {
    const key = createHash('sha256').update(plaintextSecret).digest('hex');
    return createHmac('sha256', key).update(rawBody, 'utf8').digest('hex');
  };

  // Force a due drain regardless of backoff by resetting nextAttemptAt to the past.
  const makeDue = async (): Promise<void> => {
    await harness.db
      .update(webhookDeliveriesTable)
      .set({ nextAttemptAt: new Date(Date.now() - 1000) })
      .where(eq(webhookDeliveriesTable.organizationId, ctxA.organizationId));
  };

  // ── G2 / G4 / G7 happy path ─────────────────────────────────────────────────
  it('G2/G4/G7 — a delivery is signed (tenant-verifiable), carries the event id, and matches the frozen body', async () => {
    received = [];
    receiverStatus = 200;
    const { secret } = await createEndpoint();
    const payloadRef = `nbo${uniq().replace(/\D/g, '')}inv`;
    const evtRef = await emit(payloadRef);

    const result = await deliverPending(harness.db, { limit: 50 });
    expect(result.succeeded).toBeGreaterThanOrEqual(1);

    const got = findByEventRef(evtRef);
    expect(got).toBeTruthy();
    const body = JSON.parse(got!.rawBody);
    // Frozen shape: { id, type, event:{id,type,createdAt}, data }
    expect(body.type).toBe('invoice.paid');
    expect(body.event.id).toBe(evtRef); // the EVT dedupe key, inside the signed body (G4)
    expect(body.data.reference).toBe(payloadRef);
    // The fake receiver verifies with the documented recipe (G2).
    expect(got!.headers['x-nombaone-signature']).toBe(tenantSignature(secret, got!.rawBody));
    // The stated guarantee rides on every POST (G5).
    expect(got!.headers['x-nombaone-delivery-guarantee']).toBe('at-least-once');
  });

  // ── G3 / G6 backoff → dead-letter store ─────────────────────────────────────
  it('G3/G6 — repeated non-2xx retries then dead-letters, and the dead row is listable', async () => {
    received = [];
    receiverStatus = 500;
    const { reference: whRef } = await createEndpoint();
    const evtRef = await emit(`nbo${uniq().replace(/\D/g, '')}inv`);

    // Drain MAX_ATTEMPTS times, forcing each retry due (bypassing the backoff wait).
    for (let i = 0; i < 6; i += 1) {
      await deliverPending(harness.db, { limit: 50 });
      await makeDue();
    }

    const dead = await asA(request(harness.app).get(`/v1/webhooks/${whRef}/deliveries`).query({ status: 'dead' }));
    expect(dead.status).toBe(200);
    const row = dead.body.data.find((d: { eventId: string }) => d.eventId === evtRef);
    expect(row).toBeTruthy();
    expect(row.status).toBe('dead');
    expect(row.attempts).toBe(6);
  });

  // ── G6 ★ replay re-arms the SAME row (event.id stable) ──────────────────────
  it('G6 ★ — replaying a dead delivery re-arms the same row; event.id is unchanged across replay', async () => {
    received = [];
    receiverStatus = 500;
    const { reference: whRef, secret } = await createEndpoint();
    const evtRef = await emit(`nbo${uniq().replace(/\D/g, '')}inv`);
    for (let i = 0; i < 6; i += 1) {
      await deliverPending(harness.db, { limit: 50 });
      await makeDue();
    }
    const deadList = await asA(request(harness.app).get(`/v1/webhooks/${whRef}/deliveries`).query({ status: 'dead' }));
    const deadRow = deadList.body.data.find((d: { eventId: string }) => d.eventId === evtRef);
    expect(deadRow.status).toBe('dead');

    // The receiver recovers; replay the dead row.
    receiverStatus = 200;
    received = [];
    const replay = await asA(request(harness.app).post(`/v1/webhooks/${whRef}/deliveries/${deadRow.id}/replay`)).set('Idempotency-Key', `rp-${uniq()}`);
    expect(replay.status).toBe(200);
    expect(replay.body.data.id).toBe(deadRow.id); // SAME delivery reference, no new WHD
    expect(replay.body.data.replayCount).toBe(1);

    await deliverPending(harness.db, { limit: 50 });
    const got = findByEventRef(evtRef);
    expect(got).toBeTruthy();
    expect(JSON.parse(got!.rawBody).event.id).toBe(evtRef); // event.id stable across replay (consumer dedupe holds)
    expect(got!.headers['x-nombaone-signature']).toBe(tenantSignature(secret, got!.rawBody));

    const after = await asA(request(harness.app).get(`/v1/webhooks/${whRef}/deliveries/${deadRow.id}`));
    expect(after.body.data.status).toBe('succeeded');
  });

  // ── G2 rotation safety ──────────────────────────────────────────────────────
  it('G2 — after rotating the secret, a new delivery verifies with the new key and fails with the old', async () => {
    received = [];
    receiverStatus = 200;
    const { reference, secret: oldSecret } = await createEndpoint();
    const rot = await asA(request(harness.app).post(`/v1/webhooks/${reference}/rotate-secret`)).set('Idempotency-Key', `rot-${uniq()}`);
    expect(rot.status).toBe(200);
    const newSecret = rot.body.data.signingSecret as string;
    expect(newSecret).not.toBe(oldSecret);

    const evtRef = await emit(`nbo${uniq().replace(/\D/g, '')}inv`);
    await deliverPending(harness.db, { limit: 50 });
    const got = findByEventRef(evtRef);
    expect(got!.headers['x-nombaone-signature']).toBe(tenantSignature(newSecret, got!.rawBody));
    expect(got!.headers['x-nombaone-signature']).not.toBe(tenantSignature(oldSecret, got!.rawBody));
  });

  // ── G1 events list ──────────────────────────────────────────────────────────
  it('G1 — GET /v1/events lists the tenant\'s real emitted events', async () => {
    const evtRef = await emit(`nbo${uniq().replace(/\D/g, '')}inv`);
    const list = await asA(request(harness.app).get('/v1/events').query({ type: 'invoice.paid' }));
    expect(list.status).toBe(200);
    expect(list.body.data.some((e: { id: string }) => e.id === evtRef)).toBe(true);
  });

  // ── N4 auth + isolation ─────────────────────────────────────────────────────
  it('N4 — routes reject missing key / wrong scope; cross-tenant is NotFound', async () => {
    const { reference } = await createEndpoint();
    expect((await request(harness.app).get('/v1/webhooks')).status).toBe(401);

    const orgC = await harness.seedOrg('WH RO');
    const ro = (await harness.mintApiKey(orgC.organizationId, 'test', ['webhooks:read'])).secret;
    const forbidden = await request(harness.app)
      .post('/v1/webhooks')
      .set('Authorization', `Bearer ${ro}`)
      .set('Idempotency-Key', `we-${uniq()}`)
      .send({ url: receiverUrl, enabledEvents: ['*'] });
    expect(forbidden.status).toBe(403);

    // Tenant B cannot read tenant A's endpoint.
    const cross = await request(harness.app)
      .get(`/v1/webhooks/${reference}`)
      .set('Authorization', `Bearer ${bearerB}`);
    expect(cross.status).toBe(404);
  });
});
