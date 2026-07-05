import { and, eq } from 'drizzle-orm';

import { plansTable, pricesTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '@nombaone/sara/events';
import { serializePlan } from './serialize';

import type { DomainContext, InfraReadScope, InfraTxDb } from '@nombaone/sara/context';
import type { PlanResponseData } from './types';

/**
 * SEAM(03): the active-subscriber count for a plan. Phase 01 has no
 * `subscriptions` table, so this returns 0; 03 replaces the BODY with
 *   `SELECT count(*) FROM subscriptions
 *      WHERE plan_id = :planId AND status IN ('active','trialing','past_due','paused')`
 * (scoped to org+env). The signature and every call site stay identical — 03 only
 * fills the query in. It is injectable so a unit test can stub a positive count.
 */
export type CountActiveSubscribers = (
  db: InfraReadScope,
  ctx: DomainContext,
  planId: string
) => Promise<number>;

export const countActiveSubscribers: CountActiveSubscribers = async () => 0;

/**
 * The O1 guard: a plan with active subscribers cannot be retired (they would be
 * orphaned). Throws `PLAN_HAS_ACTIVE_SUBSCRIBERS` when the count is > 0.
 */
export async function assertPlanArchivable(
  db: InfraReadScope,
  ctx: DomainContext,
  planId: string,
  count: CountActiveSubscribers = countActiveSubscribers
): Promise<void> {
  const active = await count(db, ctx, planId);
  if (active > 0) {
    throw AppError.Conflict(
      'cannot archive a plan with active subscribers',
      { planId, activeSubscribers: active },
      NOMBAONE_ERROR_CODES.PLAN_HAS_ACTIVE_SUBSCRIBERS
    );
  }
}

/**
 * Retire a plan: archive (never hard-delete). Blocks if the plan has active
 * subscribers (O1). In one transaction it flips `status='archived'` and
 * deactivates every still-active price (so nothing new can subscribe) — existing
 * pinned prices on live subscriptions are left untouched, so subscribers are never
 * orphaned. Emits `plan.archived` + one `price.deactivated` per price flipped.
 */
export async function archivePlan(
  txDb: InfraTxDb,
  ctx: DomainContext,
  reference: string
): Promise<PlanResponseData> {
  const [plan] = await txDb
    .select()
    .from(plansTable)
    .where(
      and(
        eq(plansTable.organizationId, ctx.organizationId),
        eq(plansTable.mode, ctx.mode),
        eq(plansTable.reference, reference)
      )
    )
    .limit(1);

  if (!plan) {
    throw AppError.NotFound('plan not found', { reference }, NOMBAONE_ERROR_CODES.PLAN_NOT_FOUND);
  }
  if (plan.status === 'archived') {
    throw AppError.Conflict(
      'plan is already archived',
      { reference },
      NOMBAONE_ERROR_CODES.PLAN_ALREADY_ARCHIVED
    );
  }

  await assertPlanArchivable(txDb, ctx, plan.id);

  const { updated, deactivatedRefs } = await txDb.transaction(async (tx) => {
    const [archived] = await tx
      .update(plansTable)
      .set({ status: 'archived' })
      .where(eq(plansTable.id, plan.id))
      .returning();

    const flipped = await tx
      .update(pricesTable)
      .set({ active: false })
      .where(and(eq(pricesTable.planId, plan.id), eq(pricesTable.active, true)))
      .returning({ reference: pricesTable.reference });

    return { updated: archived, deactivatedRefs: flipped.map((p) => p.reference) };
  });

  if (!updated) {
    throw AppError.InternalServerError(
      'failed to archive plan',
      { reference },
      NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
    );
  }

  await emitEvent(txDb, { ...ctx, type: 'plan.archived', payload: { reference } });
  for (const priceRef of deactivatedRefs) {
    await emitEvent(txDb, {
      ...ctx,
      type: 'price.deactivated',
      payload: { reference: priceRef, planRef: reference },
    });
  }

  return serializePlan(updated);
}
