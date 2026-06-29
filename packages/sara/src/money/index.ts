import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

/**
 * Money is ALWAYS integer minor units (kobo). ₦1.00 = 100 kobo. No floating
 * point anywhere in the money path; direction (debit/credit) carries the sign,
 * so amounts are always positive. The product is NGN-only by design.
 */
export type Kobo = number;

export const CURRENCY = 'NGN' as const;

export function assertPositiveKobo(amount: number): asserts amount is Kobo {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw AppError.UnprocessableEntity(
      'amount must be a positive integer (kobo)',
      { amount },
      NOMBAONE_ERROR_CODES.CLIENT_VALIDATION_FAILED
    );
  }
}

export const nairaToKobo = (naira: number): Kobo => Math.round(naira * 100);
export const koboToNaira = (kobo: Kobo): number => kobo / 100;
export const sumKobo = (values: Kobo[]): Kobo => values.reduce((total, value) => total + value, 0);

/** Display helper: 123450 → "₦1,234.50". */
export const formatKobo = (kobo: Kobo): string =>
  `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
