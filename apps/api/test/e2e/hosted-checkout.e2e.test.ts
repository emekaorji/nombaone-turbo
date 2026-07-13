import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { invoicesTable, paymentMethodsTable } from '@nombaone/core-db/schema';

import { processInboundInvoiceEvent } from '@shared/services/billing';
import { createCustomer } from '@shared/services/customers';
import { createPlan } from '@shared/services/plans';
import { createPrice } from '@shared/services/prices';
import { loadSubscriptionRow } from '@shared/services/subscriptions';

import { startHarness, type Harness } from '../helpers/harness';

import type { NombaClient, NombaRequest } from '@nombaone/sara/nomba';

/**
 * The HOSTED-CHECKOUT entry — the storefront flow the product is built around:
 * `POST /v1/subscriptions` with NO payment method returns a Nomba checkoutLink;
 * the end user pays there; the settle webhook activates the sub, captures the
 * card token for silent renewals (or flips a token-less payer to send_invoice),
 * and only THEN advances the period. This path did not exist before: the API
 * refused a method-less create outright.
 */
describe('hosted-checkout subscribe entry e2e', () => {
  let harness: Harness;
  let bearer: string;
  let ctx: { organizationId: string; mode: 'sandbox' };
  let requeryAmount = 0;
  const checkoutOrders: NombaRequest[] = [];

  const fakeNomba: NombaClient = {
    getToken: async () => 'tok',
    async request<T = unknown>(req: NombaRequest) {
      if (req.endpoint.includes('/checkout/order')) {
        checkoutOrders.push(req);
        return {
          status: 200,
          ok: true,
          pending: false, data: { data: { checkoutLink: `https://pay.nomba.com/sandbox/${req.idempotencyRef}` } } as T,
        };
      }
      return { status: 200, ok: true, pending: false, data: {} as T };
    },
    requeryTransaction: async () => ({ found: true, succeeded: true, amount: requeryAmount }),
  };

  beforeAll(async () => {
    harness = await startHarness();
    harness.setNombaClient(fakeNomba);
    const org = await harness.seedOrg('Hosted Checkout Gym');
    bearer = (
      await harness.mintApiKey(org.organizationId, 'sandbox', [
        'customers:read',
        'customers:write',
        'plans:write',
        'prices:write',
        'subscriptions:read',
        'subscriptions:write',
        'invoices:read',
        'payment_methods:read',
        'payment_methods:write',
      ])
    ).secret;
    ctx = { organizationId: org.organizationId, mode: 'sandbox' };
  });

  afterAll(async () => {
    await harness?.stop();
  });

  const as = (r: request.Test): request.Test => r.set('Authorization', `Bearer ${bearer}`);
  let seq = 0;
  const uniq = (): string => `${Date.now()}-${seq++}`;

  async function seedPrice(unitAmount: number): Promise<{ customerRef: string; priceRef: string }> {
    const u = uniq();
    const customer = await createCustomer(harness.db, ctx, { email: `m${u}@gym.test`, name: 'Member' });
    const plan = await createPlan(harness.db, ctx, { name: `Gym ${u}` });
    const price = await createPrice(harness.db, ctx, {
      planRef: plan.id,
      unitAmount,
      interval: 'minute',
      intervalCount: 10,
      usageType: 'licensed',
      billingScheme: 'per_unit',
      trialPeriodDays: 0,
    });
    return { customerRef: customer.id, priceRef: price.id };
  }

  const subscribe = (body: Record<string, unknown>): request.Test =>
    as(request(harness.app).post('/v1/subscriptions'))
      .set('Idempotency-Key', `s-${uniq()}`)
      .send(body);

  async function invoiceRowFor(subRef: string) {
    const sub = await loadSubscriptionRow(harness.db, ctx, subRef);
    const [inv] = await harness.db
      .select()
      .from(invoicesTable)
      .where(and(eq(invoicesTable.organizationId, ctx.organizationId), eq(invoicesTable.subscriptionId, sub.id)));
    return { sub, inv };
  }

  it('no payment method → 201 + checkoutLink + incomplete + open invoice + period NOT advanced', async () => {
    const { customerRef, priceRef } = await seedPrice(10_000);
    const res = await subscribe({
      customerId: customerRef,
      priceId: priceRef,
      callbackUrl: 'https://gym.example/welcome',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('incomplete');
    // THE product moment: the link the merchant redirects their member to.
    expect(res.body.data.checkoutLink).toMatch(/^https:\/\/pay\.nomba\.com\//);

    const { sub, inv } = await invoiceRowFor(res.body.data.id as string);
    expect(inv).toBeDefined();
    expect(inv!.paidAt).toBeNull(); // open, awaiting the payer
    expect(sub.currentPeriodIndex).toBe(0); // NOT advanced — no money, no service granted

    // The Nomba order tokenizes (top-level flag), uses the BARE invoice ref, and
    // carries the callback.
    const order = checkoutOrders.find(
      (o) => (o.body as { order?: { orderReference?: string } })?.order?.orderReference === inv!.reference
    );
    expect(order).toBeDefined();
    expect((order!.body as { tokenizeCard?: boolean }).tokenizeCard).toBe(true);
    expect((order!.body as { order: { callbackUrl?: string } }).order.callbackUrl).toBe('https://gym.example/welcome');
  });

  it('CARD payment settles → sub active, period advanced, token captured + pinned as default', async () => {
    const { customerRef, priceRef } = await seedPrice(10_000);
    const res = await subscribe({ customerId: customerRef, priceId: priceRef });
    const subRef = res.body.data.id as string;
    const { inv } = await invoiceRowFor(subRef);

    requeryAmount = inv!.amountDue;
    const settled = await processInboundInvoiceEvent(harness.db, () => fakeNomba, {
      requestId: `req-${uniq()}`,
      eventType: 'payment_success',
      payload: {
        data: {
          orderReference: inv!.reference,
          transaction: { transactionId: 'WEB-ONLINE_C-1' },
          tokenizedCardData: {
            tokenKey: 'tok_gym_777',
            cardType: 'VERVE',
            cardPan: '506099*****1234',
            tokenExpiryMonth: '12',
            tokenExpiryYear: '2029',
          },
        },
      },
    });
    expect(settled.matched).toBe(true);
    expect(settled.settled).toBe(true);

    const { sub } = await invoiceRowFor(subRef);
    expect(sub.status).toBe('active');
    expect(sub.currentPeriodIndex).toBe(1); // advanced exactly once, on settle

    // The token became a real, pinned payment method — silent renewals possible.
    const [pm] = await harness.db
      .select()
      .from(paymentMethodsTable)
      .where(and(eq(paymentMethodsTable.customerId, sub.customerId), eq(paymentMethodsTable.tokenKey, 'tok_gym_777')));
    expect(pm).toBeDefined();
    expect(pm!.status).toBe('active');
    expect(pm!.last4).toBe('1234');
    expect(sub.defaultPaymentMethodId).toBe(pm!.id);

    // Replay: idempotent, no second payment method.
    await processInboundInvoiceEvent(harness.db, () => fakeNomba, {
      requestId: `req-${uniq()}`,
      eventType: 'payment_success',
      payload: {
        data: {
          orderReference: inv!.reference,
          transaction: { transactionId: 'WEB-ONLINE_C-1' },
          tokenizedCardData: { tokenKey: 'tok_gym_777', cardType: 'VERVE', cardPan: '506099*****1234' },
        },
      },
    });
    const pms = await harness.db
      .select()
      .from(paymentMethodsTable)
      .where(and(eq(paymentMethodsTable.customerId, sub.customerId), eq(paymentMethodsTable.tokenKey, 'tok_gym_777')));
    expect(pms.length).toBe(1);
  });

  it("TRANSFER payment (tokenKey 'N/A') settles → active, NO phantom card, sub flips to send_invoice", async () => {
    const { customerRef, priceRef } = await seedPrice(10_000);
    const res = await subscribe({ customerId: customerRef, priceId: priceRef });
    const subRef = res.body.data.id as string;
    const { inv } = await invoiceRowFor(subRef);

    requeryAmount = inv!.amountDue;
    const settled = await processInboundInvoiceEvent(harness.db, () => fakeNomba, {
      requestId: `req-${uniq()}`,
      eventType: 'payment_success',
      payload: {
        data: {
          orderReference: inv!.reference,
          transaction: { transactionId: 'API-VACT_TRA-9', type: 'vact_transfer' },
          // Nomba's live sentinel on non-card payments — must NOT become a card.
          tokenizedCardData: { tokenKey: 'N/A' },
        },
      },
    });
    expect(settled.settled).toBe(true);

    const { sub } = await invoiceRowFor(subRef);
    expect(sub.status).toBe('active');
    // No uncharge­able phantom card was minted from the sentinel…
    const pms = await harness.db
      .select()
      .from(paymentMethodsTable)
      .where(eq(paymentMethodsTable.customerId, sub.customerId));
    expect(pms.length).toBe(0);
    // …and renewals route honestly: invoice + payment link, not doomed silent pulls.
    expect(sub.collectionMethod).toBe('send_invoice');
  });

  it('a PM-attached create still works exactly as before (checkoutLink null)', async () => {
    const { customerRef, priceRef } = await seedPrice(10_000);
    const pm = await as(request(harness.app).post('/v1/sandbox/payment-methods'))
      .set('Idempotency-Key', `pm-${uniq()}`)
      .send({ customerId: customerRef, behavior: 'success' });
    const res = await subscribe({
      customerId: customerRef,
      priceId: priceRef,
      paymentMethodId: pm.body.data.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('active');
    expect(res.body.data.checkoutLink).toBeNull();
  });
});
