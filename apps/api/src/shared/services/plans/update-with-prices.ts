import { and, desc, eq, inArray, ne } from 'drizzle-orm';

import { plansTable, pricesTable, type PlanRow, type PriceRow } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '@nombaone/sara/events';
import { mintReference } from '@nombaone/sara/reference';
import { assertPlanAcceptsPrices, assertPriceCreatable, buildPriceValues } from '../prices/create';
import { assertPlanNameFree } from './create';
import { listActivePlanPrices, resolvePlanId } from './queries';
import { serializePlan } from './serialize';

import type { DomainContext, InfraTx, InfraTxDb } from '@nombaone/sara/context';
import type { EmbeddedPriceInput } from '../prices/types';
import type { PlanWithPricesResponseData, UpdatePlanWithPricesInput } from './types';

/** What one cadence's reconcile decided. Drives the post-commit events, and nothing else. */
type CadenceOutcome = {
  created: PriceRow | null;
  deactivated: PriceRow[];
};

/**
 * ── Update a plan AND reconcile what it costs, atomically ─────────────────────
 *
 * `PATCH /v1/plans/{id}` with a `prices` array. The merchant sends what the plan costs; we
 * work out what changed. Per cadence (`interval` × `intervalCount`):
 *
 *   not priced yet    → INSERT                                          → price.created
 *   amount unchanged  → NOTHING (one active row)                        → (no event)
 *                     → deactivate the extras (several active rows)     → price.deactivated × M
 *   amount changed    → INSERT new + deactivate EVERY other active row  → price.created + × M
 *
 * A cadence that is NOT in the array is left completely alone. Omission never retires a
 * price, so a partial update is always safe, and the plan can never be left with nothing to
 * bill on (we never retire without replacing).
 *
 * WHY A CHANGE IS AN INSERT, NEVER AN UPDATE. A price row is immutable: its money is never
 * rewritten. A subscription pins a `price_id`, and that pinned row is the whole reason an
 * existing subscriber's bill cannot move under them — rewriting `unit_amount` in place would
 * silently re-price every one of them, retroactively, including invoices already issued
 * against it. So a change mints a NEW row and retires the old, which stays exactly as it was.
 * Grandfathering is a property of the data model here, not a feature someone remembered to
 * implement.
 *
 * We deactivate EVERY other active row on the cadence, not just the one we read. A plan can
 * already carry two live monthly prices (nothing in the DB forbids it — see
 * `rejectDuplicateCadence`), and leaving one behind would let row order decide what a new
 * subscriber pays. This heals that as a side effect of any edit.
 *
 * The shape follows the house pattern (`createPlanWithPrices`): every guard runs BEFORE the
 * transaction opens, ONE transaction does the writes, and events are emitted AFTER commit on
 * the pool handle.
 */
export async function updatePlanWithPrices(
  txDb: InfraTxDb,
  ctx: DomainContext,
  reference: string,
  input: UpdatePlanWithPricesInput
): Promise<PlanWithPricesResponseData> {
  // ── Guards, all of them, before a single write ───────────────────────────────
  const { id: planId, row: plan } = await resolvePlanId(txDb, ctx, reference);
  assertPlanAcceptsPrices(plan, reference);
  input.prices.forEach((price, index) => assertPriceCreatable(price, index));
  if (input.name !== undefined && input.name !== plan.name) {
    await assertPlanNameFree(txDb, ctx, input.name, planId);
  }

  const planChanged =
    (input.name !== undefined && input.name !== plan.name) ||
    input.description !== undefined ||
    input.metadata !== undefined;

  const { planRow, outcomes } = await txDb.transaction(async (tx) => {
    // Lock the PLAN row first. Two concurrent PATCHes would otherwise both find a cadence
    // unpriced and both mint a price for it — and locking the price rows cannot prevent that,
    // because you cannot lock a row that does not exist yet.
    const [locked] = await tx
      .select()
      .from(plansTable)
      .where(eq(plansTable.id, planId))
      .for('update');

    if (!locked) {
      throw AppError.NotFound('plan not found', { reference }, NOMBAONE_ERROR_CODES.PLAN_NOT_FOUND);
    }
    // Re-checked under the lock: a concurrent archive that landed between the guard and here
    // must not take a new price.
    assertPlanAcceptsPrices(locked, reference);

    const updated = planChanged
      ? await updatePlanFields(tx, locked, input)
      : locked;

    const outcomes: CadenceOutcome[] = [];
    for (const price of input.prices) {
      outcomes.push(await reconcileCadence(tx, ctx, planId, price));
    }

    return { planRow: updated, outcomes };
  });

  // ── Events, post-commit, on the pool handle (the house pattern) ──────────────
  if (planChanged) {
    await emitEvent(txDb, { ...ctx, type: 'plan.updated', payload: { reference } });
  }
  for (const outcome of outcomes) {
    if (outcome.created) {
      await emitEvent(txDb, {
        ...ctx,
        type: 'price.created',
        payload: {
          reference: outcome.created.reference,
          planRef: reference,
          unitAmount: outcome.created.unitAmount,
          interval: outcome.created.interval,
          intervalCount: outcome.created.intervalCount,
        },
      });
    }
    for (const row of outcome.deactivated) {
      await emitEvent(txDb, {
        ...ctx,
        type: 'price.deactivated',
        payload: { reference: row.reference, planRef: reference },
      });
    }
  }

  // The plan's ACTIVE prices as they now stand — the answer to "what does this plan cost?",
  // which is exactly what the caller just changed.
  return {
    ...serializePlan(planRow),
    prices: await listActivePlanPrices(txDb, ctx, planId, reference),
  };
}

/** The descriptive fields. `description: null` clears it; omitted leaves it untouched. */
async function updatePlanFields(
  tx: InfraTx,
  plan: PlanRow,
  input: UpdatePlanWithPricesInput
): Promise<PlanRow> {
  const patch: Partial<Pick<PlanRow, 'name' | 'description' | 'metadata'>> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.metadata !== undefined) patch.metadata = input.metadata;

  const [row] = await tx.update(plansTable).set(patch).where(eq(plansTable.id, plan.id)).returning();
  if (!row) {
    throw AppError.InternalServerError(
      'failed to update plan',
      { reference: plan.reference },
      NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
    );
  }
  return row;
}

/** One cadence, reconciled. See the table at the top of the file. */
async function reconcileCadence(
  tx: InfraTx,
  ctx: DomainContext,
  planId: string,
  price: EmbeddedPriceInput
): Promise<CadenceOutcome> {
  // Newest first: the newest active row is the CANONICAL price for this cadence. If a legacy
  // plan carries several, which one a new subscriber gets would otherwise be decided by row
  // order — a coin toss over money.
  const actives = await tx
    .select()
    .from(pricesTable)
    .where(
      and(
        eq(pricesTable.organizationId, ctx.organizationId),
        eq(pricesTable.mode, ctx.mode),
        eq(pricesTable.planId, planId),
        eq(pricesTable.interval, price.interval),
        eq(pricesTable.intervalCount, price.intervalCount),
        eq(pricesTable.active, true)
      )
    )
    .orderBy(desc(pricesTable.createdAt))
    .for('update');

  const canonical = actives[0];

  // The cadence is new to this plan. Nothing to retire.
  if (!canonical) {
    const created = await insertPrice(tx, ctx, planId, price);
    return { created, deactivated: [] };
  }

  // Unchanged. Write NOTHING — an update that only renamed the plan must not silently recreate
  // every price on it and hand each one a new id that clients have already stored.
  if (canonical.unitAmount === price.unitAmount) {
    const stale = actives.slice(1);
    if (stale.length === 0) return { created: null, deactivated: [] };

    const rows = await tx
      .update(pricesTable)
      .set({ active: false })
      .where(
        inArray(
          pricesTable.id,
          stale.map((row) => row.id)
        )
      )
      .returning();
    return { created: null, deactivated: rows };
  }

  // Changed → a new row, and every other active row on this cadence is retired. The new row is
  // excluded by id, so the plan is never left with nothing to bill on.
  const created = await insertPrice(tx, ctx, planId, price);
  const rows = await tx
    .update(pricesTable)
    .set({ active: false })
    .where(
      and(
        eq(pricesTable.planId, planId),
        eq(pricesTable.interval, price.interval),
        eq(pricesTable.intervalCount, price.intervalCount),
        eq(pricesTable.active, true),
        ne(pricesTable.id, created.id)
      )
    )
    .returning();

  return { created, deactivated: rows };
}

/** Written through `buildPriceValues`, so a price born in a plan update is byte-identical to
 *  one born from `POST /v1/plans/{id}/prices`. */
async function insertPrice(
  tx: InfraTx,
  ctx: DomainContext,
  planId: string,
  price: EmbeddedPriceInput
): Promise<PriceRow> {
  const reference = mintReference('PRC');
  const [row] = await tx
    .insert(pricesTable)
    .values(buildPriceValues(ctx, price, planId, reference))
    .returning();

  if (!row) {
    throw AppError.InternalServerError(
      'failed to persist price',
      { reference },
      NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
    );
  }
  return row;
}
