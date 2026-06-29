import { describe, expect, it } from 'vitest';

import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { assertBalanced, type EntryInput } from '@nombaone/sara/ledger';

/**
 * Pure-function tests for the ledger's cardinal invariant guard. No database:
 * `assertBalanced` is the in-memory gate that runs BEFORE any row is written.
 */
describe('ledger.assertBalanced', () => {
  it('passes a balanced two-leg transaction', () => {
    const entries: EntryInput[] = [
      { accountId: 'acct-cash', direction: 'debit', amount: 5_000 },
      { accountId: 'acct-revenue', direction: 'credit', amount: 5_000 },
    ];
    expect(() => assertBalanced(entries)).not.toThrow();
  });

  it('passes a balanced multi-leg transaction', () => {
    const entries: EntryInput[] = [
      { accountId: 'a', direction: 'debit', amount: 7_000 },
      { accountId: 'b', direction: 'credit', amount: 5_000 },
      { accountId: 'c', direction: 'credit', amount: 2_000 },
    ];
    expect(() => assertBalanced(entries)).not.toThrow();
  });

  it('throws LEDGER_TRANSACTION_UNBALANCED when debits != credits', () => {
    const entries: EntryInput[] = [
      { accountId: 'a', direction: 'debit', amount: 5_000 },
      { accountId: 'b', direction: 'credit', amount: 4_999 },
    ];
    try {
      assertBalanced(entries);
      throw new Error('expected assertBalanced to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(NOMBAONE_ERROR_CODES.LEDGER_TRANSACTION_UNBALANCED);
    }
  });

  it('throws when fewer than two entries are supplied', () => {
    const entries: EntryInput[] = [{ accountId: 'a', direction: 'debit', amount: 5_000 }];
    expect(() => assertBalanced(entries)).toThrowError(AppError);
  });

  it('throws LEDGER_INVALID_ENTRY on a non-positive or non-integer amount', () => {
    const zero: EntryInput[] = [
      { accountId: 'a', direction: 'debit', amount: 0 },
      { accountId: 'b', direction: 'credit', amount: 0 },
    ];
    try {
      assertBalanced(zero);
      throw new Error('expected assertBalanced to throw');
    } catch (error) {
      expect((error as AppError).code).toBe(NOMBAONE_ERROR_CODES.LEDGER_INVALID_ENTRY);
    }

    const fractional: EntryInput[] = [
      { accountId: 'a', direction: 'debit', amount: 10.5 },
      { accountId: 'b', direction: 'credit', amount: 10.5 },
    ];
    expect(() => assertBalanced(fractional)).toThrowError(AppError);
  });
});
