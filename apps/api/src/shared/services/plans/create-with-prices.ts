import { plansTable, pricesTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '@nombaone/sara/events';
import { mintReference } from '@nombaone/sara/reference';
import { assertPriceCreatable, buildPriceValues } from '../prices/create';
import { serializePrice } from '../prices/serialize';
import { assertPlanNameFree, buildPlanValues } from './create';
import { serializePlan } from './serialize';

import type { PriceRow } from '@nombaone/core-db/schema';
import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';
import type { CreatePlanWithPricesInput, PlanWithPricesResponseData } from './types';

/**
 * ONE INTENT = ONE CALL: create a plan AND the prices it sells at, atomically.
 *
 * A merchant's actual intent is "sell Pro at ₦5,000/mo or ₦50,000/yr" — one thing.
 * Making them POST the plan, read back its reference, then POST each price leaks
 * our storage model at them and leaves a half-built catalog behind whenever the
 * second call fails. Here either every row lands or none does.
 *
 * The shape, and why:
 *
 *  1. EVERY guard runs BEFORE the transaction opens — name uniqueness, then each
 *     price. A rejected price must never open a transaction; there is then nothing
 *     to roll back, and the rollback path we do have is never exercised in anger.
 *  2. References are PRE-MINTED (they are client-visible ids, not DB identity), so
 *     the insert is a single round-trip and the response can be re-ordered against
 *     them.
 *  3. ONE transaction: the plan row, then ONE multi-row price insert. Nothing else.
 *  4. `INSERT … VALUES (a),(b) RETURNING` does NOT guarantee row order — Postgres
 *     makes no such promise. We re-order the returned rows against the pre-minted
 *     references so `response.prices[i]` is `request.prices[i]`. Clients WILL zip
 *     those two arrays.
 *  5. Events are emitted AFTER commit, on the POOL handle — the house pattern (see
 *     `archivePlan`, `createSubscription`). The outbox being post-commit rather than
 *     in-transaction is a known, accepted gap; it is inherited here, not fixed here.
 *
 * `PLAN_NOT_FOUND` / `PLAN_ALREADY_ARCHIVED` are structurally unreachable on this
 * path (we hold the id we just minted, and a brand-new plan is `active`), so there
 * are deliberately no guards for them.
 */
export async function createPlanWithPrices(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: CreatePlanWithPricesInput
): Promise<PlanWithPricesResponseData> {
  await assertPlanNameFree(txDb, ctx, input.name);
  input.prices.forEach((price, index) => assertPriceCreatable(price, index));

  const planReference = mintReference('PLN');
  // Pair each submitted price with its reference: the submission ORDER is the
  // contract, and this pairing is what survives the unordered RETURNING.
  const minted = input.prices.map((price) => ({ price, reference: mintReference('PRC') }));

  const { plan, prices } = await txDb.transaction(async (tx) => {
    const [planRow] = await tx
      .insert(plansTable)
      .values(buildPlanValues(ctx, input, planReference))
      .returning();

    if (!planRow) {
      throw AppError.InternalServerError(
        'failed to persist plan',
        { reference: planReference },
        NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
      );
    }

    const priceRows = await tx
      .insert(pricesTable)
      .values(
        minted.map(({ price, reference }) => buildPriceValues(ctx, price, planRow.id, reference))
      )
      .returning();

    const byReference = new Map(priceRows.map((row) => [row.reference, row]));
    const ordered = minted.map(({ reference }) => {
      const row = byReference.get(reference);
      if (!row) {
        throw AppError.InternalServerError(
          'failed to persist price',
          { reference },
          NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
        );
      }
      return row;
    });

    return { plan: planRow, prices: ordered satisfies PriceRow[] };
  });

  await emitEvent(txDb, {
    ...ctx,
    type: 'plan.created',
    payload: { reference: planReference, name: plan.name },
  });
  for (const row of prices) {
    await emitEvent(txDb, {
      ...ctx,
      type: 'price.created',
      payload: {
        reference: row.reference,
        planRef: planReference,
        unitAmount: row.unitAmount,
        interval: row.interval,
        intervalCount: row.intervalCount,
      },
    });
  }

  return {
    ...serializePlan(plan),
    prices: prices.map((row) => serializePrice(row, planReference)),
  };
}
