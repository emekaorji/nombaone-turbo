import { describe, expect, it } from 'vitest';

import { NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { assertLineItemsSumToTotal, deriveInvoiceStatus } from '@/domain/invoices';

describe('invoices/lineItems — J4 sum invariant (pure)', () => {
  it('passes when signed lines sum to the total', () => {
    expect(() =>
      assertLineItemsSumToTotal([{ amount: 300000 }, { amount: -50000 }], 250000)
    ).not.toThrow();
  });

  it('throws INVOICE_LINE_ITEMS_UNBALANCED otherwise', () => {
    let code: string | undefined;
    try {
      assertLineItemsSumToTotal([{ amount: 300000 }], 250000);
    } catch (e) {
      code = (e as { code?: string }).code;
    }
    expect(code).toBe(NOMBAONE_ERROR_CODES.INVOICE_LINE_ITEMS_UNBALANCED);
  });
});

describe('invoices/status — derived (no stored column)', () => {
  const base = {
    finalizedAt: null as Date | null,
    voidedAt: null as Date | null,
    paidAt: null as Date | null,
    uncollectibleAt: null as Date | null,
    amountDue: 100000,
    amountPaid: 0,
  };
  const ts = new Date('2026-01-01T00:00:00Z');

  it('draft before finalize', () => {
    expect(deriveInvoiceStatus(base)).toBe('draft');
  });
  it('open once finalized and unpaid', () => {
    expect(deriveInvoiceStatus({ ...base, finalizedAt: ts })).toBe('open');
  });
  it('paid once paid_at is set', () => {
    expect(deriveInvoiceStatus({ ...base, finalizedAt: ts, paidAt: ts })).toBe('paid');
  });
  it('paid when finalized at zero amount (J8 — never a ₦0 charge)', () => {
    expect(deriveInvoiceStatus({ ...base, finalizedAt: ts, amountDue: 0 })).toBe('paid');
  });
  it('void / uncollectible from their markers', () => {
    expect(deriveInvoiceStatus({ ...base, voidedAt: ts })).toBe('void');
    expect(deriveInvoiceStatus({ ...base, uncollectibleAt: ts })).toBe('uncollectible');
  });
  it('partially_paid when finalized + some collected but not full (05)', () => {
    expect(deriveInvoiceStatus({ ...base, finalizedAt: ts, amountPaid: 40000 })).toBe('partially_paid');
  });
  it('void takes precedence over every other signal', () => {
    expect(
      deriveInvoiceStatus({ ...base, finalizedAt: ts, paidAt: ts, uncollectibleAt: ts, voidedAt: ts })
    ).toBe('void');
  });
});
