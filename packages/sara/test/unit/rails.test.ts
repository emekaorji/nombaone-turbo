import { describe, expect, it } from 'vitest';

import {
  createCardRail,
  createMandateRail,
  createTransferRail,
  type RailCollectInput,
} from '@nombaone/sara/rails';
import { nombaTokenNeedsRefresh, type NombaClient, type NombaRequest } from '@nombaone/sara/nomba';

/** A fake `NombaClient` — no network (B.10). `handler` shapes the response. */
const fakeClient = (
  handler: (req: NombaRequest) => { ok?: boolean; status?: number; data?: unknown }
): NombaClient => ({
  getToken: async () => 'tok',
  async request<T = unknown>(req: NombaRequest) {
    const out = handler(req);
    return { status: out.status ?? 200, ok: out.ok ?? true, data: (out.data ?? {}) as T };
  },
  requeryTransaction: async () => ({ found: true, succeeded: true }),
});

const ctx = { organizationId: 'org-1', environment: 'test' as const };
const input = (over: Partial<RailCollectInput>): RailCollectInput => ({
  ...ctx,
  reference: 'nbo000000000001exa',
  amountKobo: 250000,
  ...over,
});

describe('rails/card', () => {
  it('accepted charge → pending; orderReference is OUR reference (E3); kobo passthrough', async () => {
    let seen: NombaRequest | undefined;
    const rail = createCardRail(
      fakeClient((req) => {
        seen = req;
        return { ok: true, data: {} };
      })
    );
    const res = await rail.collect(input({ metadata: { tokenKey: 'tok_1', customerEmail: 'a@b.c' } }));
    expect(res.status).toBe('pending');
    expect(res.providerReference).toBe('nbo000000000001exa');
    const body = seen?.body as { order: { orderReference: string; amount: number } };
    expect(body.order.orderReference).toBe('nbo000000000001exa');
    expect(body.order.amount).toBe(250000);
  });

  it('missing token → failed (no charge possible)', async () => {
    const rail = createCardRail(fakeClient(() => ({ ok: true, data: {} })));
    expect((await rail.collect(input({ metadata: {} }))).status).toBe('failed');
  });
});

describe('rails/mandate', () => {
  it('SUCCESS → succeeded; failure maps the taxonomy; over-ceiling → failed', async () => {
    const ok = createMandateRail(fakeClient(() => ({ data: { data: { status: 'SUCCESS' } } })));
    expect((await ok.collect(input({ amountKobo: 1000, metadata: { mandateId: 'm1' } }))).status).toBe(
      'succeeded'
    );

    const fail = createMandateRail(
      fakeClient(() => ({ data: { data: { status: 'FAILED', message: 'Insufficient funds' } } }))
    );
    const fr = await fail.collect(input({ amountKobo: 1000, metadata: { mandateId: 'm1' } }));
    expect(fr.status).toBe('failed');
    expect(fr.failureReason).toBe('insufficient_funds');

    const cap = createMandateRail(fakeClient(() => ({ data: {} })));
    const capped = await cap.collect(
      input({ amountKobo: 6000, metadata: { mandateId: 'm1', maxAmount: 5000 } })
    );
    expect(capped.status).toBe('failed');
    expect(capped.failureReason).toBe('mandate_max_amount_exceeded');
  });
});

describe('rails/transfer', () => {
  it('push → pending + payInstructions', async () => {
    const rail = createTransferRail(
      fakeClient(() => ({
        data: { bankName: 'Wema', bankAccountNumber: '0000000000', bankAccountName: 'NombaOne' },
      }))
    );
    const res = await rail.collect(input({ reference: 'nbo000000000002prc', amountKobo: 500000, metadata: {} }));
    expect(res.status).toBe('pending');
    expect(res.payInstructions).toMatchObject({
      accountNumber: '0000000000',
      amountKobo: 500000,
      reference: 'nbo000000000002prc',
    });
  });
});

describe('nomba/client token cache', () => {
  it('nombaTokenNeedsRefresh respects the margin and bad input', () => {
    const now = Date.parse('2026-06-30T12:00:00Z');
    expect(nombaTokenNeedsRefresh(null, now, 300)).toBe(true);
    expect(
      nombaTokenNeedsRefresh({ accessToken: 't', expiresAt: '2026-06-30T13:00:00Z' }, now, 300)
    ).toBe(false);
    expect(
      nombaTokenNeedsRefresh({ accessToken: 't', expiresAt: '2026-06-30T12:04:00Z' }, now, 300)
    ).toBe(true);
    expect(nombaTokenNeedsRefresh({ accessToken: 't', expiresAt: 'garbage' }, now, 300)).toBe(true);
  });
});
