import { and, eq } from 'drizzle-orm';

import { plansTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '@nombaone/sara/events';
import { mintReference } from '@nombaone/sara/reference';
import { serializePlan } from './serialize';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';
import type { CreatePlanInput, PlanResponseData } from './types';

/**
 * Create a plan (the product/offering). Name is unique per (org, env): pre-checked
 * for a clean `409 PLAN_NAME_TAKEN`, with the `plans_org_env_name_unique` index as
 * the structural backstop. Emits `plan.created`.
 */
export async function createPlan(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: CreatePlanInput
): Promise<PlanResponseData> {
  const [existing] = await txDb
    .select({ id: plansTable.id })
    .from(plansTable)
    .where(
      and(
        eq(plansTable.organizationId, ctx.organizationId),
        eq(plansTable.mode, ctx.mode),
        eq(plansTable.name, input.name)
      )
    )
    .limit(1);

  if (existing) {
    throw AppError.Conflict(
      'a plan with this name already exists',
      { name: input.name },
      NOMBAONE_ERROR_CODES.PLAN_NAME_TAKEN
    );
  }

  const reference = mintReference('PLN');

  const [row] = await txDb
    .insert(plansTable)
    .values({
      reference,
      organizationId: ctx.organizationId,
      mode: ctx.mode,
      name: input.name,
      description: input.description ?? null,
      metadata: input.metadata ?? {},
    })
    .returning();

  if (!row) {
    throw AppError.InternalServerError(
      'failed to persist plan',
      { reference },
      NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
    );
  }

  await emitEvent(txDb, {
    ...ctx,
    type: 'plan.created',
    payload: { reference, name: row.name },
  });

  return serializePlan(row);
}
