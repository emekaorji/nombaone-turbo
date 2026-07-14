import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

export interface SplitAmounts {
  grossKobo: number;
  platformFeeKobo: number;
  netToTenantKobo: number;
}

/**
 * The kobo-exact split invariant (L4): `gross = fee + net`, all non-negative
 * integers — mirrors `assertBalanced`. Throws `SETTLEMENT_SPLIT_UNBALANCED` so a
 * single kobo can never leak out of a settlement.
 */
export function assertSplitBalances(input: SplitAmounts): void {
  const { grossKobo, platformFeeKobo, netToTenantKobo } = input;
  const balanced =
    Number.isInteger(grossKobo) &&
    Number.isInteger(platformFeeKobo) &&
    Number.isInteger(netToTenantKobo) &&
    platformFeeKobo >= 0 &&
    netToTenantKobo >= 0 &&
    grossKobo === platformFeeKobo + netToTenantKobo;
  if (!balanced) {
    throw AppError.UnprocessableEntity(
      'settlement split does not balance to the kobo',
      { ...input },
      NOMBAONE_ERROR_CODES.SETTLEMENT_SPLIT_UNBALANCED
    );
  }
}
