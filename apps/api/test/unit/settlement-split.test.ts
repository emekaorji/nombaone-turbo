import { describe, expect, it } from 'vitest';

import { assertSplitBalances, buildSplitRequest } from '@shared/services/settlement';

const ctx = { organizationId: 'org', mode: 'sandbox' as const };

describe('settlement/split — kobo-exact split invariant (H5 ★ / L4)', () => {
  it('assertSplitBalances passes only when gross = fee + net, non-negative integers', () => {
    expect(() => assertSplitBalances({ grossKobo: 100000, platformFeeKobo: 1500, netToTenantKobo: 98500 })).not.toThrow();
    expect(() => assertSplitBalances({ grossKobo: 100000, platformFeeKobo: 1500, netToTenantKobo: 98501 })).toThrow(); // 1-kobo leak
    expect(() => assertSplitBalances({ grossKobo: 100000, platformFeeKobo: -1, netToTenantKobo: 100001 })).toThrow(); // negative fee
    expect(() => assertSplitBalances({ grossKobo: 100000.5, platformFeeKobo: 1500, netToTenantKobo: 98500.5 })).toThrow(); // non-integer
  });

  it('buildSplitRequest routes the tenant share (gross − fee) to the sub-account; fee is the parent remainder', () => {
    const split = buildSplitRequest(ctx, { grossKobo: 500000, subAccountId: 'sub_123', platformFeeKobo: 7500 });
    expect(split.splitType).toBe('AMOUNT');
    expect(split.splitList).toEqual([{ accountId: 'sub_123', value: 492500 }]); // 500000 − 7500
  });

  it('handles a clamped-floor and clamped-ceiling fee (fee still balances)', () => {
    const floor = buildSplitRequest(ctx, { grossKobo: 1000, subAccountId: 's', platformFeeKobo: 1000 });
    expect(floor.splitList[0]!.value).toBe(0); // whole amount is fee → tenant share 0, still balances
    const ceil = buildSplitRequest(ctx, { grossKobo: 100_000_000, subAccountId: 's', platformFeeKobo: 200_000 });
    expect(ceil.splitList[0]!.value).toBe(99_800_000);
  });
});
