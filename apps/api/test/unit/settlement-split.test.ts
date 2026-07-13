import { describe, expect, it } from 'vitest';

import { assertSplitBalances } from '@shared/services/settlement';

/**
 * The kobo-exact split invariant. Every settlement divides the gross into exactly two
 * parts — our platform fee, and the merchant's share (credited to
 * `tenant_settlement:{accountRef}`) — and this is what guarantees no kobo is invented
 * or lost in between.
 *
 * (`buildSplitRequest` used to live here too. Deleted: Nomba's `splitRequest` routes
 * each leg to a sub-account `accountId` we can never obtain, and it had ZERO production
 * callers — no split was ever transmitted to Nomba. The split that actually decides who
 * owns a naira is the one below, in our own ledger.)
 */
describe('settlement/split — kobo-exact split invariant', () => {
  it('passes only when gross = fee + net, all non-negative integers', () => {
    expect(() =>
      assertSplitBalances({ grossKobo: 100000, platformFeeKobo: 1500, netToTenantKobo: 98500 })
    ).not.toThrow();

    // A single kobo appearing out of nowhere must be fatal.
    expect(() =>
      assertSplitBalances({ grossKobo: 100000, platformFeeKobo: 1500, netToTenantKobo: 98501 })
    ).toThrow();

    expect(() =>
      assertSplitBalances({ grossKobo: 100000, platformFeeKobo: -1, netToTenantKobo: 100001 })
    ).toThrow(); // negative fee

    expect(() =>
      assertSplitBalances({ grossKobo: 100000.5, platformFeeKobo: 1500, netToTenantKobo: 98500.5 })
    ).toThrow(); // fractional kobo
  });

  it('allows the degenerate ends of the split (all-fee, all-tenant)', () => {
    expect(() =>
      assertSplitBalances({ grossKobo: 1000, platformFeeKobo: 1000, netToTenantKobo: 0 })
    ).not.toThrow();
    expect(() =>
      assertSplitBalances({ grossKobo: 1000, platformFeeKobo: 0, netToTenantKobo: 1000 })
    ).not.toThrow();
  });
});
