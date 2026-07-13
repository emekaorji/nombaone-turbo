import { and, desc, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { invoicesTable, ledgerAccountsTable } from '@nombaone/core-db/schema';

import { processInboundInvoiceEvent } from '@shared/services/billing';
import { createCustomer } from '@shared/services/customers';
import { createPlan } from '@shared/services/plans';
import { createPrice } from '@shared/services/prices';

import { startHarness, type Harness } from '../helpers/harness';

import type { NombaClient, NombaRequest } from '@nombaone/sara/nomba';

/**
 * ── THE MONEY CORE ──────────────────────────────────────────────────────────────
 *
 * Does a merchant actually get their money? Nothing tested this, and as a result the
 * whole thing was broken in production in two independent ways at once:
 *
 *  1. `confirmInvoiceFromWebhook` — the ONLY settle path that runs on live, because the
 *     card rail returns `pending` and the money confirms asynchronously — posted
 *     `cash → platform_revenue` and never called `recordSettlement`. The gross sat in a
 *     suspense account and `tenant_settlement` was never credited. Every merchant's
 *     balance was ₦0, forever.
 *  2. Settlement was additionally gated on an `org_nomba_accounts` row that no merchant
 *     could ever obtain (Nomba does not mint sub-accounts), so even the sandbox path
 *     bailed out before crediting anyone.
 *
 * So this walks the real thing: a customer pays → the webhook settles → the merchant's
 * ledger balance is exactly right → they register a bank account → they withdraw it.
 */
describe('money core: a customer pays, and the merchant can actually withdraw it', () => {
  let harness: Harness;
  let bearer: string;
  let ctx: { organizationId: string; mode: 'sandbox' };
  let accountRef: string;
  let requeryAmount = 0;
  const transfers: NombaRequest[] = [];

  const fakeNomba: NombaClient = {
    getToken: async () => 'tok',
    async request<T = unknown>(req: NombaRequest) {
      // ⚠ Name enquiry is ALSO a POST under /transfers/bank — match it FIRST or every
      // lookup would be counted as a transfer.
      if (req.endpoint.includes('/transfers/bank/lookup')) {
        return {
          status: 200,
          ok: true,
          pending: false,
          data: { data: { accountName: 'IRON REPUBLIC GYM LTD' } } as T,
        };
      }
      if (req.endpoint === '/v1/transfers/bank' && req.method === 'POST') {
        transfers.push(req);
        return { status: 200, ok: true, pending: false, data: { data: { id: 'nomba-tx-1' } } as T };
      }
      if (req.endpoint.includes('/checkout/order')) {
        return {
          status: 200,
          ok: true,
          pending: false,
          data: { data: { checkoutLink: `https://pay.nomba.com/${req.idempotencyRef}` } } as T,
        };
      }
      return { status: 200, ok: true, pending: false, data: {} as T };
    },
    requeryTransaction: async () => ({ found: true, succeeded: true, amount: requeryAmount }),
  };

  /** Same client, but the requery agrees with the decline: found, and NOT succeeded. */
  const declineNomba: NombaClient = {
    ...fakeNomba,
    requeryTransaction: async () => ({ found: true, succeeded: false, amount: 0 }),
  };

  beforeAll(async () => {
    harness = await startHarness();
    harness.setNombaClient(fakeNomba);
    const org = await harness.seedOrg('Iron Republic');
    ctx = { organizationId: org.organizationId, mode: 'sandbox' };
    accountRef = `NBO-${org.reference}`;
    bearer = (
      await harness.mintApiKey(org.organizationId, 'sandbox', [
        'settlements:read',
        'settlements:write',
        'subscriptions:write',
        'subscriptions:read',
      ])
    ).secret;
  });

  afterAll(async () => {
    await harness?.stop();
  });

  const as = (r: request.Test): request.Test => r.set('Authorization', `Bearer ${bearer}`);

  const balanceOf = async (key: string): Promise<number> => {
    const [row] = await harness.db
      .select({ balance: ledgerAccountsTable.balance })
      .from(ledgerAccountsTable)
      .where(
        and(
          eq(ledgerAccountsTable.organizationId, ctx.organizationId),
          eq(ledgerAccountsTable.mode, 'sandbox'),
          eq(ledgerAccountsTable.key, key)
        )
      )
      .limit(1);
    return row?.balance ?? 0;
  };

  it('a webhook-settled payment credits the merchant — the bug that made every balance ₦0', async () => {
    const u = Date.now();
    const customer = await createCustomer(harness.db, ctx, {
      email: `member${u}@gym.test`,
      name: 'Chidinma Okafor-Eze', // a hyphen: the name that used to break the transfer rail
    });
    const plan = await createPlan(harness.db, ctx, { name: `Iron Republic ${u}` });
    const price = await createPrice(harness.db, ctx, {
      planRef: plan.id,
      unitAmount: 500_000, // ₦5,000 in kobo
      interval: 'month',
      intervalCount: 1,
      usageType: 'licensed',
      billingScheme: 'per_unit',
      trialPeriodDays: 0,
    });

    // Subscribe with NO payment method → hosted checkout (the real storefront entry).
    const sub = await as(request(harness.app).post('/v1/subscriptions'))
      .set('Idempotency-Key', `sub-${u}`)
      .send({ customerId: customer.id, priceId: price.id });
    expect(sub.status).toBe(201);
    expect(sub.body.data.checkoutLink).toBeTruthy();

    const [invoice] = await harness.db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.organizationId, ctx.organizationId))
      .limit(1);
    expect(invoice).toBeTruthy();

    const before = await balanceOf(`tenant_settlement:${accountRef}`);
    expect(before).toBe(0);

    // The customer pays on Nomba's hosted page → payment_success lands.
    requeryAmount = invoice!.amountDue;
    const settled = await processInboundInvoiceEvent(harness.db, () => fakeNomba, {
      requestId: `req-${u}`,
      eventType: 'payment_success',
      payload: {
        data: {
          orderReference: invoice!.reference,
          transaction: { transactionId: 'nomba-tx-in-1' },
        },
      },
    });
    expect(settled.matched).toBe(true);
    expect(settled.settled).toBe(true);

    // 💰 THE ASSERTION THAT WAS MISSING. Before the fix this was 0 and the entire gross
    // was stranded in `platform_revenue`.
    const merchantBalance = await balanceOf(`tenant_settlement:${accountRef}`);
    expect(merchantBalance).toBeGreaterThan(0);

    // gross = our fee + the merchant's share, to the kobo. No naira invented or lost.
    const fees = await balanceOf('platform_fees');
    expect(fees + merchantBalance).toBe(invoice!.amountDue);

    // `platform_revenue` is a SUSPENSE account: the charge credits the gross into it and
    // settlement reclassifies the whole gross back out. A non-zero balance here means
    // money was collected and attributed to nobody — which is exactly what was happening.
    expect(await balanceOf('platform_revenue')).toBe(0);
  });

  it('a redelivered webhook credits nothing twice', async () => {
    const balanceBefore = await balanceOf(`tenant_settlement:${accountRef}`);
    const [invoice] = await harness.db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.organizationId, ctx.organizationId))
      .limit(1);

    requeryAmount = invoice!.amountDue;
    // A DIFFERENT requestId — a genuine redelivery, not the webhook-event dedupe. This
    // must be stopped by `settlements.merchant_tx_ref`, not by the inbox.
    await processInboundInvoiceEvent(harness.db, () => fakeNomba, {
      requestId: `req-redelivery-${Date.now()}`,
      eventType: 'payment_success',
      payload: {
        data: {
          orderReference: invoice!.reference,
          transaction: { transactionId: 'nomba-tx-in-1' },
        },
      },
    });

    // `settlements.merchant_tx_ref` is unique + claimed before the ledger post.
    expect(await balanceOf(`tenant_settlement:${accountRef}`)).toBe(balanceBefore);
  });

  it('the merchant registers a bank account — the NAME comes from the bank, not the request', async () => {
    // They never gave us this at signup. This is the first time we ask, and only because
    // there is now money to send somewhere.
    const res = await as(request(harness.app).post('/v1/payout-accounts'))
      .set('Idempotency-Key', `pa-${Date.now()}`)
      .send({ bankCode: '044', bankName: 'Access Bank', accountNumber: '0123456789' });

    expect(res.status).toBe(201);
    // Nobody typed this. It is what the bank said when we asked who owns that NUBAN.
    expect(res.body.data.accountName).toBe('IRON REPUBLIC GYM LTD');
  });

  it('withdrawing pays the verified account, debits the balance, and cannot double-spend', async () => {
    const [invoice] = await harness.db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.organizationId, ctx.organizationId))
      .limit(1);

    // Age the settlement past the escrow hold so it is withdrawable.
    await harness.db.execute(
      `UPDATE settlements SET created_at = now() - interval '4 hours' WHERE organization_id = '${ctx.organizationId}'` as never
    );

    const balanceBefore = await balanceOf(`tenant_settlement:${accountRef}`);
    expect(balanceBefore).toBeGreaterThan(0);

    const key = `po-${Date.now()}`;
    // No destination in the body — that is the point. It goes where the bank confirmed.
    const payout = await as(request(harness.app).post('/v1/settlements/payout'))
      .set('Idempotency-Key', key)
      .send({});

    expect([200, 201]).toContain(payout.status);
    expect(payout.body.data.resolvedAccountName).toBe('IRON REPUBLIC GYM LTD');

    // The whole available balance left the merchant's ledger account.
    const after = await balanceOf(`tenant_settlement:${accountRef}`);
    expect(after).toBeLessThan(balanceBefore);

    // Replaying the same Idempotency-Key must not debit again — `unique(merchant_tx_ref)`.
    const replay = await as(request(harness.app).post('/v1/settlements/payout'))
      .set('Idempotency-Key', key)
      .send({});
    expect(replay.status).toBe(200);
    expect(await balanceOf(`tenant_settlement:${accountRef}`)).toBe(after);

    void invoice;
  });

  it('a merchant with no bank account gets told to add one — never a silent failure', async () => {
    const org2 = await harness.seedOrg('No Bank Co');
    const bearer2 = (
      await harness.mintApiKey(org2.organizationId, 'sandbox', ['settlements:read', 'settlements:write'])
    ).secret;

    const res = await request(harness.app)
      .post('/v1/settlements/payout')
      .set('Authorization', `Bearer ${bearer2}`)
      .set('Idempotency-Key', `po-none-${Date.now()}`)
      .send({ amountInKobo: 1000 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PAYOUT_ACCOUNT_MISSING');
    expect(res.body.error.message).toMatch(/bank account/i);
  });

  /**
   * 🔴 THE ASYNC DECLINE. On live a tokenized card charge returns `pending` — the real
   * outcome arrives later as a `payment_failed` webhook naming the INVOICE.
   *
   * That webhook is matched by `processInboundInvoiceEvent`, so the worker returns early
   * and never reaches the dunning bridge (which only handles RETRIES, keyed on a DUN ref).
   * And `confirmInvoiceFromWebhook` only ever acted on `settled`. So the decline landed,
   * was acknowledged, and NOTHING happened: invoice stayed `open`, subscription stayed
   * `active`, dunning never started. Free membership, forever. Every renewal decline on
   * live ended here.
   */
  it('an async payment_failed puts the subscription past_due so dunning can start', async () => {
    const u = Date.now();
    const customer = await createCustomer(harness.db, ctx, {
      email: `decline${u}@gym.test`,
      name: 'Declined Member',
    });
    const plan = await createPlan(harness.db, ctx, { name: `Decline Gym ${u}` });
    const price = await createPrice(harness.db, ctx, {
      planRef: plan.id,
      unitAmount: 250_000,
      interval: 'month',
      intervalCount: 1,
      usageType: 'licensed',
      billingScheme: 'per_unit',
      trialPeriodDays: 0,
    });

    const sub = await as(request(harness.app).post('/v1/subscriptions'))
      .set('Idempotency-Key', `sub-decl-${u}`)
      .send({ customerId: customer.id, priceId: price.id });
    expect(sub.status).toBe(201);
    const subRef = sub.body.data.id as string;

    const [invoice] = await harness.db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.organizationId, ctx.organizationId))
      .orderBy(desc(invoicesTable.createdAt))
      .limit(1);
    expect(invoice).toBeTruthy();

    // Nomba says the payment FAILED, and our own requery agrees (found, not succeeded).
    requeryAmount = 0;
    await processInboundInvoiceEvent(harness.db, () => declineNomba, {
      requestId: `req-decl-${u}`,
      eventType: 'payment_failed',
      payload: {
        data: {
          orderReference: invoice!.reference,
          transaction: { transactionId: 'nomba-tx-decl', gatewayMessage: 'Insufficient funds' },
        },
      },
    });

    // The invoice must record the failure…
    const [after] = await harness.db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, invoice!.id))
      .limit(1);
    expect(after!.paidAt).toBeNull();
    expect(after!.attemptCount).toBeGreaterThan(0);
    expect(after!.lastFailureReason).toBe('insufficient_funds');

    // …and the customer must NOT still be enjoying an unpaid membership.
    const read = await as(request(harness.app).get(`/v1/subscriptions/${subRef}`));
    expect(read.body.data.status).not.toBe('active');
  });

  it('never duns a customer who actually paid — requery.succeeded always wins', async () => {
    const u = Date.now();
    const customer = await createCustomer(harness.db, ctx, { email: `slow${u}@gym.test`, name: 'Slow Settler' });
    const plan = await createPlan(harness.db, ctx, { name: `Slow Gym ${u}` });
    const price = await createPrice(harness.db, ctx, {
      planRef: plan.id,
      unitAmount: 250_000,
      interval: 'month',
      intervalCount: 1,
      usageType: 'licensed',
      billingScheme: 'per_unit',
      trialPeriodDays: 0,
    });
    const sub = await as(request(harness.app).post('/v1/subscriptions'))
      .set('Idempotency-Key', `sub-slow-${u}`)
      .send({ customerId: customer.id, priceId: price.id });
    const [invoice] = await harness.db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.organizationId, ctx.organizationId))
      .orderBy(desc(invoicesTable.createdAt))
      .limit(1);

    // A spoofed / stale `payment_failed` — but the provider says the money DID land.
    // E4: our requery outranks the webhook, so this must NOT dun a paying customer.
    requeryAmount = invoice!.amountDue;
    await processInboundInvoiceEvent(harness.db, () => fakeNomba, {
      requestId: `req-spoof-${u}`,
      eventType: 'payment_failed',
      payload: {
        data: {
          orderReference: invoice!.reference,
          transaction: { transactionId: 'nomba-tx-slow' },
        },
      },
    });

    const [after] = await harness.db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, invoice!.id))
      .limit(1);
    expect(after!.paidAt).toBeTruthy(); // it settled
    expect(after!.attemptCount).toBe(0); // and was never counted as a failure
  });
});
