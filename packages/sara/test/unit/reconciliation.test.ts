import { describe, expect, it } from 'vitest';

import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { assertZeroSum } from '@nombaone/sara/reconciliation';

/**
 * Pure zero-sum assertion: a healthy ledger has totalDebits === totalCredits.
 */
describe('reconciliation.assertZeroSum', () => {
  it('passes when debits equal credits', () => {
    expect(() => assertZeroSum(1_000_000, 1_000_000)).not.toThrow();
  });

  it('throws RECONCILIATION_DRIFT_DETECTED when totals diverge', () => {
    try {
      assertZeroSum(1_000_000, 999_999);
      throw new Error('expected assertZeroSum to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(NOMBAONE_ERROR_CODES.RECONCILIATION_DRIFT_DETECTED);
    }
  });

  it('tolerates drift within an explicit band', () => {
    expect(() => assertZeroSum(1_000_000, 999_999, 1)).not.toThrow();
  });

  it('throws when drift exceeds the band', () => {
    expect(() => assertZeroSum(1_000_000, 999_990, 1)).toThrowError(AppError);
  });
});
