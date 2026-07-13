import { describe, expect, it } from 'vitest';

import {
  createCardRail,
  createMandateRail,
  createTransferRail,
  type RailCollectInput,
  type RailCollectMetadata,
} from '@nombaone/sara/rails';
import {
  nombaTokenNeedsRefresh,
  type NombaClient,
  type NombaClientFactory,
  type NombaRequest,
} from '@nombaone/sara/nomba';

/** A fake `NombaClient` — no network (B.10). `handler` shapes the response. */
const fakeClient = (
  handler: (req: NombaRequest) => {
    ok?: boolean;
    status?: number;
    pending?: boolean;
    data?: unknown;
  }
): NombaClient => ({
  getToken: async () => 'tok',
  async request<T = unknown>(req: NombaRequest) {
    const out = handler(req);
    return {
      status: out.status ?? 200,
      ok: out.ok ?? true,
      pending: out.pending ?? false,
      data: (out.data ?? {}) as T,
    };
  },
  requeryTransaction: async () => ({ found: true, succeeded: true }),
});

/** The rails now take a mode-selecting FACTORY; wrap a fake as one (mode ignored). */
const fakeFactory =
  (
    handler: (req: NombaRequest) => { ok?: boolean; status?: number; data?: unknown }
  ): NombaClientFactory =>
  () =>
    fakeClient(handler);

const ctx = { organizationId: 'org-1', mode: 'sandbox' as const };

/**
 * The TYPED metadata base — mirrors what `buildRailCollectMetadata` produces.
 * Rail-specific fields (tokenKey/mandateId/…) are layered per test. The old
 * untyped bag let a `maxAmount` key ship where the rail read `maxAmountKobo`;
 * the type now makes that a compile error, which is the whole point.
 */
const meta = (over: Partial<RailCollectMetadata> = {}): RailCollectMetadata => ({
  invoice: 'nbo000000000001inv',
  paymentMethod: 'nbo000000000001pmt',
  customerRef: 'nbo000000000001cus',
  customerEmail: 'a@b.c',
  ...over,
});

const input = (over: Partial<RailCollectInput>): RailCollectInput => ({
  ...ctx,
  reference: 'nbo000000000001exa',
  amountKobo: 250000,
  ...over,
});

describe('rails/card', () => {
  it('accepted charge → pending; orderReference is OUR reference (E3); kobo→naira on the wire (D.1); customerId is the CUS ref', async () => {
    let seen: NombaRequest | undefined;
    const rail = createCardRail(
      fakeFactory((req) => {
        seen = req;
        return { ok: true, pending: false, data: { data: { status: true, message: 'Approved by Financial Institution' } } };
      })
    );
    const res = await rail.collect(
      input({ metadata: meta({ tokenKey: 'tok_1', accountId: 'sub-acct-1' }) })
    );
    expect(res.status).toBe('pending');
    expect(res.providerReference).toBe('nbo000000000001exa');
    const body = seen?.body as {
      order: { orderReference: string; amount: string; customerId: string; accountId?: string };
    };
    expect(body.order.orderReference).toBe('nbo000000000001exa');
    // 250000 kobo (₦2,500) → the naira decimal STRING Nomba expects — NOT 250000 (would be ₦250k, 100×).
    expect(body.order.amount).toBe('2500.00');
    // Nomba's customerId is the CUS… reference the card was tokenized under, never our UUID.
    expect(body.order.customerId).toBe('nbo000000000001cus');
    // Sub-account scoping: without it the charge lands in the parent pool and never webhooks.
    expect(body.order.accountId).toBe('sub-acct-1');
  });

  it('missing token → failed (no charge possible)', async () => {
    const rail = createCardRail(fakeFactory(() => ({ ok: true, pending: false, data: {} })));
    expect((await rail.collect(input({ metadata: meta() }))).status).toBe('failed');
  });

  // The three live-proven outcomes of a tokenized recharge (data.status + data.message).
  const cardOutcome = (data: unknown) =>
    createCardRail(fakeFactory(() => ({ ok: true, data }))).collect(
      input({ metadata: meta({ tokenKey: 'tok_1' }) })
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
    const rail = createCardRail(fakeFactory(() => ({ ok: false, status: 502, data: {} })));
    const res = await rail.collect(input({ metadata: meta({ tokenKey: 'tok_1' }) }));
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
      fakeFactory((req) => {
        seenM = req;
        return { data: { data: { status: 'SUCCESS' } } };
      })
    );
    expect(
      (await ok.collect(input({ amountKobo: 1000, metadata: meta({ mandateId: 'm1' }) }))).status
    ).toBe('succeeded');
    expect((seenM?.body as { amount: string }).amount).toBe('10.00'); // 1000 kobo → ₦10.00 (D.1)

    const fail = createMandateRail(
      fakeFactory(() => ({ data: { data: { status: 'FAILED', message: 'Insufficient funds' } } }))
    );
    const fr = await fail.collect(input({ amountKobo: 1000, metadata: meta({ mandateId: 'm1' }) }));
    expect(fr.status).toBe('failed');
    expect(fr.failureReason).toBe('insufficient_funds');

    const cap = createMandateRail(fakeFactory(() => ({ data: {} })));
    const capped = await cap.collect(
      input({ amountKobo: 6000, metadata: meta({ mandateId: 'm1', maxAmountKobo: 5000 }) })
    );
    expect(capped.status).toBe('failed');
    expect(capped.failureReason).toBe('mandate_max_amount_exceeded');
  });

  it('missing mandate → failed (no debit possible)', async () => {
    const rail = createMandateRail(fakeFactory(() => ({ data: {} })));
    expect((await rail.collect(input({ metadata: meta() }))).status).toBe('failed');
  });
});

describe('rails/transfer', () => {
  it('push → pending + payInstructions from the NESTED envelope; expectedAmount kobo→naira (D.1)', async () => {
    let seenT: NombaRequest | undefined;
    const rail = createTransferRail(
      fakeFactory((req) => {
        seenT = req;
        // The REAL Nomba shape (probe-confirmed 2026-07-12): bank fields live one
        // level down, inside `data.data`. The old test mocked them at the top
        // level — encoding the very envelope bug it should have caught.
        return {
          data: {
            code: '00',
            description: 'SUCCESS',
            data: { bankName: 'Nombank MFB', bankAccountNumber: '3647923815', bankAccountName: 'ZIORA/nombaone' },
          },
        };
      })
    );
    const res = await rail.collect(
      input({ reference: 'nbo000000000002inv', amountKobo: 500000, metadata: meta({ accountRef: 'nbo000000000002inv' }) })
    );
    expect(res.status).toBe('pending');
    // the wire carries naira; our own payInstructions.amountKobo stays kobo.
    expect((seenT?.body as { expectedAmount: string }).expectedAmount).toBe('5000.00');
    expect(res.payInstructions).toMatchObject({
      bankName: 'Nombank MFB',
      accountNumber: '3647923815',
      accountName: 'ZIORA/nombaone',
      amountKobo: 500000,
      reference: 'nbo000000000002inv',
    });
  });

  it('metadata.accountRef (the invoice ref) wins over input.reference as the NUBAN alias', async () => {
    let seenT: NombaRequest | undefined;
    const rail = createTransferRail(
      fakeFactory((req) => {
        seenT = req;
        return { data: { data: { bankName: 'B', bankAccountNumber: '1', bankAccountName: 'N' } } };
      })
    );
    // Dunning keys the CALL on the attempt ref, but reconciliation must stay
    // keyed on the invoice — the alias the inbound webhook resolves by.
    const res = await rail.collect(
      input({ reference: 'nbo00000000000DUN', metadata: meta({ accountRef: 'nbo000000000009inv' }) })
    );
    expect((seenT?.body as { accountRef: string }).accountRef).toBe('nbo000000000009inv');
    expect(res.payInstructions?.reference).toBe('nbo000000000009inv');
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
