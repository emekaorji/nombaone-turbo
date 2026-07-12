import { describe, expect, it } from 'vitest';

import {
  createPlanBody,
  createPriceBody,
  MAX_EMBEDDED_PRICES,
} from '@nombaone/core-contracts/validations';
import { NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { assertPlanArchivable } from '@shared/services/plans';
import { assertPriceCreatable } from '@shared/services/prices';
import { mintReference } from '@nombaone/sara/reference';

import type { DomainContext, InfraReadScope } from '@nombaone/sara/context';

/** A minimal well-formed embedded price, for the array-level assertions below. */
const monthly = { unitAmountInKobo: 500000, interval: 'month' as const };

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

  it('createPlanBody leaves `prices` absent when omitted and fills each embedded price', () => {
    expect(createPlanBody.parse({ name: 'Pro' }).prices).toBeUndefined();

    const parsed = createPlanBody.parse({ name: 'Pro', prices: [monthly] });
    expect(parsed.prices).toEqual([
      {
        unitAmountInKobo: 500000,
        interval: 'month',
        intervalCount: 1,
        usageType: 'licensed',
        billingScheme: 'per_unit',
        trialPeriodDays: 0,
      },
    ]);
  });

  it('createPlanBody rejects an empty array, a duplicate cadence, and more than the cap', () => {
    expect(createPlanBody.safeParse({ name: 'Pro', prices: [] }).success).toBe(false);

    // Same (interval, intervalCount) twice — including via the intervalCount DEFAULT.
    const dupe = createPlanBody.safeParse({
      name: 'Pro',
      prices: [monthly, { ...monthly, intervalCount: 1, unitAmountInKobo: 600000 }],
    });
    expect(dupe.success).toBe(false);
    expect(dupe.error?.issues[0]?.path).toEqual(['prices', 1, 'interval']);

    // A DIFFERENT intervalCount on the same unit is a different cadence — allowed.
    expect(
      createPlanBody.safeParse({
        name: 'Pro',
        prices: [monthly, { ...monthly, intervalCount: 3 }],
      }).success
    ).toBe(true);

    const capped = (count: number) =>
      createPlanBody.safeParse({
        name: 'Pro',
        prices: Array.from({ length: count }, (_, i) => ({ ...monthly, intervalCount: i + 1 })),
      }).success;
    expect(capped(MAX_EMBEDDED_PRICES)).toBe(true);
    expect(capped(MAX_EMBEDDED_PRICES + 1)).toBe(false);
  });

  it('assertPriceCreatable guards kobo then tiered, and points at the offending array row', () => {
    const base = {
      unitAmount: 500000,
      billingScheme: 'per_unit' as const,
    };
    expect(assertPriceCreatable(base)).toBeUndefined();

    // ORDER IS THE CONTRACT: money is checked before the 05 seam.
    expect(() => assertPriceCreatable({ unitAmount: 0, billingScheme: 'tiered' })).toThrow(
      expect.objectContaining({ code: NOMBAONE_ERROR_CODES.CLIENT_VALIDATION_FAILED })
    );
    expect(() => assertPriceCreatable({ ...base, billingScheme: 'tiered' })).toThrow(
      expect.objectContaining({ code: NOMBAONE_ERROR_CODES.PRICE_TIERED_NOT_SUPPORTED })
    );

    // With an index (the embedded path) the row is named on `fieldErrors` — the only
    // error surface the wire exposes — under the same key zod itself would emit.
    expect(() => assertPriceCreatable({ ...base, billingScheme: 'tiered' }, 2)).toThrow(
      expect.objectContaining({
        fieldErrors: { 'prices.2.billingScheme': ['tiered billing is not supported yet'] },
      })
    );
    // Without one (the nested route) there is no array to point into.
    expect(() => assertPriceCreatable({ ...base, billingScheme: 'tiered' })).toThrow(
      expect.objectContaining({ fieldErrors: undefined })
    );
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
