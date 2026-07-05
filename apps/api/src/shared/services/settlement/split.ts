import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import type { DomainContext } from '@nombaone/sara/context';

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

/** The provider-agnostic split descriptor the rail attaches to a collection. */
export interface NombaSplitRequest {
  splitType: 'AMOUNT';
  splitList: { accountId: string; value: number }[];
}

/**
 * Build the inline `splitRequest` (H5 ★): the tenant share (`gross − fee`) is routed
 * to their sub-account; the platform fee is the REMAINDER that stays on the parent
 * (separated automatically at collection). This is the single seam for the
 * ⚠ sandbox split-semantics flag (AMOUNT vs PERCENTAGE, remainder-vs-explicit-fee) —
 * a sandbox finding changes only this pure function.
 */
export function buildSplitRequest(
  _ctx: DomainContext,
  input: { grossKobo: number; subAccountId: string; platformFeeKobo: number }
): NombaSplitRequest {
  const tenantShare = input.grossKobo - input.platformFeeKobo;
  assertSplitBalances({
    grossKobo: input.grossKobo,
    platformFeeKobo: input.platformFeeKobo,
    netToTenantKobo: tenantShare,
  });
  return { splitType: 'AMOUNT', splitList: [{ accountId: input.subAccountId, value: tenantShare }] };
}
