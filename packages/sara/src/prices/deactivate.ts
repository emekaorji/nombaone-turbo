import { and, eq } from 'drizzle-orm';

import { plansTable, pricesTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '../events';
import { serializePrice } from './serialize';

import type { DomainContext, InfraTxDb } from '../context';
import type { PriceResponseData } from './types';

/**
 * Deactivate a price — the ONLY mutation a price permits. It is a sellability
 * state change (`active=false`), never a money edit: `unit_amount`/`interval` stay
 * frozen, so existing subscribers pinned to this price are unaffected. Emits
 * `price.deactivated`.
 */
export async function deactivatePrice(
  txDb: InfraTxDb,
  ctx: DomainContext,
  reference: string
): Promise<PriceResponseData> {
  const [found] = await txDb
    .select({ price: pricesTable, planRef: plansTable.reference })
    .from(pricesTable)
    .innerJoin(plansTable, eq(pricesTable.planId, plansTable.id))
    .where(
      and(
        eq(pricesTable.organizationId, ctx.organizationId),
        eq(pricesTable.mode, ctx.mode),
        eq(pricesTable.reference, reference)
      )
    )
    .limit(1);

  if (!found) {
    throw AppError.NotFound('price not found', { reference }, NOMBAONE_ERROR_CODES.PRICE_NOT_FOUND);
  }
  if (!found.price.active) {
    throw AppError.Conflict(
      'price is already inactive',
      { reference },
      NOMBAONE_ERROR_CODES.PRICE_ALREADY_INACTIVE
    );
  }

  const [row] = await txDb
    .update(pricesTable)
    .set({ active: false })
    .where(eq(pricesTable.id, found.price.id))
    .returning();

  if (!row) {
    throw AppError.InternalServerError(
      'failed to deactivate price',
      { reference },
      NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
    );
  }

  await emitEvent(txDb, {
    ...ctx,
    type: 'price.deactivated',
    payload: { reference, planRef: found.planRef },
  });

  return serializePrice(row, found.planRef);
}
