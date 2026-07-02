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
  it('accepted charge → pending; orderReference is OUR reference (E3); kobo→naira on the wire (D.1)', async () => {
    let seen: NombaRequest | undefined;
    const rail = createCardRail(
      fakeClient((req) => {
        seen = req;
        return { ok: true, data: { data: { status: true, message: 'Approved by Financial Institution' } } };
      })
    );
    const res = await rail.collect(input({ metadata: { tokenKey: 'tok_1', customerEmail: 'a@b.c' } }));
    expect(res.status).toBe('pending');
    expect(res.providerReference).toBe('nbo000000000001exa');
    const body = seen?.body as { order: { orderReference: string; amount: string } };
    expect(body.order.orderReference).toBe('nbo000000000001exa');
    // 250000 kobo (₦2,500) → the naira decimal STRING Nomba expects — NOT 250000 (would be ₦250k, 100×).
    expect(body.order.amount).toBe('2500.00');
  });

  it('missing token → failed (no charge possible)', async () => {
    const rail = createCardRail(fakeClient(() => ({ ok: true, data: {} })));
    expect((await rail.collect(input({ metadata: {} }))).status).toBe('failed');
  });

  // The three live-proven outcomes of a tokenized recharge (data.status + data.message).
  const cardOutcome = (data: unknown) =>
    createCardRail(fakeClient(() => ({ ok: true, data }))).collect(
      input({ metadata: { tokenKey: 'tok_1', customerEmail: 'a@b.c' } })
    );

  it('(A) approved by FI → pending (webhook settles), no action', async () => {
    const res = await cardOutcome({ data: { status: true, message: 'Approved by Financial Institution' } });
    expect(res.status).toBe('pending');
    expect(res.action).toBeUndefined();
  });

  it('(B) bank OTP/3DS step-up → requires_action:otp_required with the gateway message', async () => {
    for (const message of ['Kindly enter the OTP sent to ****1958', 'Complete 3DS to continue', 'secure authentication']) {
      const res = await cardOutcome({ data: { status: true, message } });
      expect(res.status).toBe('requires_action');
      expect(res.failureReason).toBe('otp_required');
      expect(res.action?.type).toBe('otp_3ds');
      expect(res.action?.message).toBe(message);
    }
  });

  it('(C) data.status:false → failed, gateway message passed through', async () => {
    const res = await cardOutcome({ data: { status: false, message: 'Tokenized charge failed' } });
    expect(res.status).toBe('failed');
    expect(res.failureReason).toBe('Tokenized charge failed');
  });

  it('transport failure (res.ok=false) → failed:request_failed', async () => {
    const rail = createCardRail(fakeClient(() => ({ ok: false, status: 502, data: {} })));
    const res = await rail.collect(input({ metadata: { tokenKey: 'tok_1' } }));
    expect(res.status).toBe('failed');
    expect(res.failureReason).toBe('request_failed');
  });

  it('accepted with an unknown (non-OTP) message → optimistic pending (E4)', async () => {
    const res = await cardOutcome({ data: { status: true, message: 'Processing' } });
    expect(res.status).toBe('pending');
  });
});

describe('rails/mandate', () => {
  it('SUCCESS → succeeded; failure maps the taxonomy; over-ceiling → failed', async () => {
    let seenM: NombaRequest | undefined;
    const ok = createMandateRail(
      fakeClient((req) => {
        seenM = req;
        return { data: { data: { status: 'SUCCESS' } } };
      })
    );
    expect((await ok.collect(input({ amountKobo: 1000, metadata: { mandateId: 'm1' } }))).status).toBe(
      'succeeded'
    );
    expect((seenM?.body as { amount: string }).amount).toBe('10.00'); // 1000 kobo → ₦10.00 (D.1)

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
  it('push → pending + payInstructions; expectedAmount kobo→naira (D.1)', async () => {
    let seenT: NombaRequest | undefined;
    const rail = createTransferRail(
      fakeClient((req) => {
        seenT = req;
        return {
          data: { bankName: 'Wema', bankAccountNumber: '0000000000', bankAccountName: 'NombaOne' },
        };
      })
    );
    const res = await rail.collect(input({ reference: 'nbo000000000002prc', amountKobo: 500000, metadata: {} }));
    expect(res.status).toBe('pending');
    // the wire carries naira; our own payInstructions.amountKobo stays kobo.
    expect((seenT?.body as { expectedAmount: string }).expectedAmount).toBe('5000.00');
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
