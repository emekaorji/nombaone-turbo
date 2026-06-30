import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { nombaWebhookEventsTable } from '@nombaone/core-db/schema';
import {
  computeNombaSignature,
  type NombaClient,
  type NombaRequest,
} from '@nombaone/sara/nomba';
import { processInboundNombaEvent } from '@nombaone/sara/payment-methods';

import { startHarness, type Harness } from '../helpers/harness';

const NOMBA_SIG_KEY = 'test_nomba_signature_key'; // matches the harness env

/** A fake Nomba client — canned responses by endpoint, no network. */
const ok = <T>(data: T) => ({ status: 200, ok: true, data });
const fakeNomba: NombaClient = {
  getToken: async () => 'tok',
  async request<T = unknown>(req: NombaRequest) {
    const ep = req.endpoint;
    let data: unknown = {};
    if (ep.includes('tokenized-card-data') && req.method === 'DELETE') data = {};
    else if (ep.includes('checkout/order')) data = { checkoutLink: 'https://checkout.test/sess' };
    else if (ep.includes('direct-debits/status')) data = { status: 'ACTIVE', adviceStatus: 'ADVICE_SENT' };
    else if (ep.includes('direct-debits')) data = { mandateId: 'mandate_123', description: 'Pay ₦50 NIBSS validation' };
    else if (ep.includes('accounts/virtual'))
      data = { bankName: 'Wema', bankAccountNumber: '0000000000', bankAccountName: 'NombaOne' };
    return ok(data as T);
  },
  requeryTransaction: async () => ({ found: true, succeeded: true }),
};

describe('payment methods + inbound pipeline e2e', () => {
  let harness: Harness;
  let bearerA: string;
  let bearerB: string;
  const scopes = ['customers:read', 'customers:write', 'payment_methods:read', 'payment_methods:write', 'mandates:write'];

  beforeAll(async () => {
    harness = await startHarness();
    harness.setNombaClient(fakeNomba);
    const orgA = await harness.seedOrg('PM A');
    const orgB = await harness.seedOrg('PM B');
    bearerA = (await harness.mintApiKey(orgA.organizationId, 'test', scopes)).secret;
    bearerB = (await harness.mintApiKey(orgB.organizationId, 'test', scopes)).secret;
  });

  afterAll(async () => {
    await harness?.stop();
  });

  const asA = (r: request.Test): request.Test => r.set('Authorization', `Bearer ${bearerA}`);
  const asB = (r: request.Test): request.Test => r.set('Authorization', `Bearer ${bearerB}`);
  const idem = (r: request.Test, k: string): request.Test => r.set('Idempotency-Key', k);

  const newCustomer = async (): Promise<string> => {
    const res = await idem(asA(request(harness.app).post('/v1/customers')), `c-${Date.now()}-${Math.random()}`).send(
      { email: `pm+${Date.now()}-${Math.random()}@acme.test`, name: 'Payer' }
    );
    return res.body.data.id as string;
  };

  it('setup-card → webhook capture persists tokenKey (E1) and NEVER leaks it (N1); replay dedups (F2)', async () => {
    const customerRef = await newCustomer();

    const setup = await idem(asA(request(harness.app).post('/v1/payment-methods/setup')), `pm-${Date.now()}`).send({
      customerRef,
      amount: 250000,
      callbackUrl: 'https://acme.test/return',
    });
    expect(setup.status).toBe(201);
    expect(setup.body.data.checkoutLink).toBe('https://checkout.test/sess');
    const pmtRef = setup.body.data.reference as string;
    expect(pmtRef).toMatch(/pmt$/);

    const pending = await asA(request(harness.app).get(`/v1/payment-methods/${pmtRef}`));
    expect(pending.body.data.status).toBe('setup_pending');
    expect(JSON.stringify(pending.body.data)).not.toContain('token');

    // Drive the settle path the worker runs (real DB, via the harness handle).
    const payload = {
      event_type: 'payment_success',
      requestId: 'req-capture-1',
      data: {
        orderReference: pmtRef,
        tokenizedCardData: {
          tokenKey: 'tok_live_SECRET',
          cardType: 'visa',
          cardPan: '411111******1111',
          tokenExpiryMonth: '12',
          tokenExpiryYear: '2030',
        },
      },
    };
    const r1 = await processInboundNombaEvent(harness.db, {
      requestId: 'req-capture-1',
      eventType: 'payment_success',
      payload,
    });
    expect(r1.outcome).toBe('captured');
    expect(r1.firstSeen).toBe(true);

    const active = await asA(request(harness.app).get(`/v1/payment-methods/${pmtRef}`));
    expect(active.body.data.status).toBe('active');
    expect(active.body.data.brand).toBe('visa');
    expect(active.body.data.last4).toBe('1111');
    expect(JSON.stringify(active.body.data)).not.toContain('SECRET');

    // F2: replay the same event → no second effect, exactly one event row.
    const r2 = await processInboundNombaEvent(harness.db, {
      requestId: 'req-capture-1',
      eventType: 'payment_success',
      payload,
    });
    expect(r2.firstSeen).toBe(false);
    const rows = await harness.db
      .select({ id: nombaWebhookEventsTable.id })
      .from(nombaWebhookEventsTable)
      .where(eq(nombaWebhookEventsTable.requestId, 'req-capture-1'));
    expect(rows).toHaveLength(1);

    // F5: an unknown/unsubscribed event type is recorded-ignored, never errored.
    const ignored = await processInboundNombaEvent(harness.db, {
      requestId: 'req-ignored-1',
      eventType: 'order_success',
      payload: { event_type: 'order_success', requestId: 'req-ignored-1', data: { orderReference: pmtRef } },
    });
    expect(ignored.outcome).toBe('ignored');
  });

  it('inbound webhook route verifies the Nomba signature (F1) and fast-acks (F3)', async () => {
    const body = JSON.stringify({ event_type: 'payment_success', requestId: 'req-sig-1', data: {} });
    const sig = computeNombaSignature(NOMBA_SIG_KEY, body);

    const good = await request(harness.app)
      .post('/webhooks/inbound/nomba')
      .set('Content-Type', 'application/json')
      .set('nomba-signature', sig)
      .send(body);
    expect(good.status).toBe(200);
    expect(good.body.data.received).toBe(true);

    const bad = await request(harness.app)
      .post('/webhooks/inbound/nomba')
      .set('Content-Type', 'application/json')
      .set('nomba-signature', 'not-a-valid-signature')
      .send(body);
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
  });

  it('mandate create → consent_pending → poll active', async () => {
    const customerRef = await newCustomer();
    const created = await idem(asA(request(harness.app).post('/v1/mandates')), `md-${Date.now()}`).send({
      customerRef,
      customerAccountNumber: '0123456789',
      bankCode: '044',
      customerName: 'Ada Payer',
      maxAmount: 5000000,
      frequency: 'monthly',
    });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('consent_pending');
    const ref = created.body.data.reference as string;

    const polled = await asA(request(harness.app).get(`/v1/mandates/${ref}`));
    expect(polled.status).toBe(200);
    expect(polled.body.data.status).toBe('active');
  });

  it('virtual account issue → active + bank details', async () => {
    const customerRef = await newCustomer();
    const va = await idem(asA(request(harness.app).post('/v1/payment-methods/virtual-account')), `va-${Date.now()}`).send(
      { customerRef }
    );
    expect(va.status).toBe(201);
    expect(va.body.data).toMatchObject({ bankName: 'Wema', accountNumber: '0000000000' });
  });

  it('list / set-default / remove + idempotency, isolation, auth', async () => {
    const customerRef = await newCustomer();
    const setupKey = `pm-mng-${Date.now()}`;
    const setup = await idem(asA(request(harness.app).post('/v1/payment-methods/setup')), setupKey).send({
      customerRef,
      amount: 100000,
      callbackUrl: 'https://acme.test/return',
    });
    const pmtRef = setup.body.data.reference as string;

    // K: idempotent replay → same reference, no second method.
    const replay = await idem(asA(request(harness.app).post('/v1/payment-methods/setup')), setupKey).send({
      customerRef,
      amount: 100000,
      callbackUrl: 'https://acme.test/return',
    });
    expect(replay.body.data.reference).toBe(pmtRef);

    const listed = await asA(request(harness.app).get('/v1/payment-methods').query({ customerRef }));
    expect(listed.status).toBe(200);
    expect(listed.body.data.some((m: { id: string }) => m.id === pmtRef)).toBe(true);

    const def = await idem(asA(request(harness.app).post(`/v1/payment-methods/${pmtRef}/default`)), `def-${Date.now()}`);
    expect(def.status).toBe(200);
    expect(def.body.data.isDefault).toBe(true);

    const removed = await idem(asA(request(harness.app).delete(`/v1/payment-methods/${pmtRef}`)), `rm-${Date.now()}`);
    expect(removed.status).toBe(200);
    expect(removed.body.data.status).toBe('removed');

    // H: Tenant B cannot see A's method.
    const cross = await asB(request(harness.app).get(`/v1/payment-methods/${pmtRef}`));
    expect(cross.status).toBe(404);

    // N4: missing key → 401; read-only key on a write route → 403.
    const noKey = await request(harness.app).get('/v1/payment-methods');
    expect(noKey.status).toBe(401);
    const orgC = await harness.seedOrg('PM C');
    const ro = await harness.mintApiKey(orgC.organizationId, 'test', ['payment_methods:read']);
    const forbidden = await request(harness.app)
      .post('/v1/payment-methods/virtual-account')
      .set('Authorization', `Bearer ${ro.secret}`)
      .set('Idempotency-Key', `ro-${Date.now()}`)
      .send({ customerRef });
    expect(forbidden.status).toBe(403);
  });
});
