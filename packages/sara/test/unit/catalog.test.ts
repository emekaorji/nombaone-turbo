import { describe, expect, it } from 'vitest';

import { createPriceBody } from '@nombaone/core-contracts/validations';
import { NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { assertPlanArchivable } from '@nombaone/sara/plans';
import { mintReference } from '@nombaone/sara/reference';

import type { DomainContext, InfraReadScope } from '@nombaone/sara/context';

describe('catalog domain', () => {
  it('mints PLN / PRC references', () => {
    expect(mintReference('PLN')).toMatch(/^nbo\d{12}pln$/);
    expect(mintReference('PRC')).toMatch(/^nbo\d{12}prc$/);
  });

  it('createPriceBody fills the L5 defaults from a minimal body', () => {
    const parsed = createPriceBody.parse({ unitAmountInKobo: 500000, interval: 'month' });
    expect(parsed).toMatchObject({
      unitAmountInKobo: 500000,
      interval: 'month',
      intervalCount: 1,
      usageType: 'licensed',
      billingScheme: 'per_unit',
      trialPeriodDays: 0,
    });
  });

  it('assertPlanArchivable blocks when active subscribers > 0, passes at 0 (the O1 guard / 03 seam)', async () => {
    const db = {} as InfraReadScope;
    const ctx: DomainContext = { organizationId: 'org-1', mode: 'sandbox' };

    await expect(assertPlanArchivable(db, ctx, 'plan-1', async () => 1)).rejects.toMatchObject({
      code: NOMBAONE_ERROR_CODES.PLAN_HAS_ACTIVE_SUBSCRIBERS,
    });
    await expect(
      assertPlanArchivable(db, ctx, 'plan-1', async () => 0)
    ).resolves.toBeUndefined();
  });
});
