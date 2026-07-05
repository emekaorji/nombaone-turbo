import { and, eq, ne } from 'drizzle-orm';

import { plansTable, type PlanRow } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '@nombaone/sara/events';
import { serializePlan } from './serialize';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';
import type { PlanResponseData, UpdatePlanInput } from './types';

/**
 * Update a plan's mutable descriptive fields (name/description/metadata). Status
 * is NOT mutated here — retiring a plan is `archivePlan`, its own named op. A name
 * change re-checks uniqueness in scope. Emits `plan.updated`.
 */
export async function updatePlan(
  txDb: InfraTxDb,
  ctx: DomainContext,
  reference: string,
  input: UpdatePlanInput
): Promise<PlanResponseData> {
  const [existing] = await txDb
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

  if (!existing) {
    throw AppError.NotFound('plan not found', { reference }, NOMBAONE_ERROR_CODES.PLAN_NOT_FOUND);
  }

  if (input.name !== undefined && input.name !== existing.name) {
    const [dupe] = await txDb
      .select({ id: plansTable.id })
      .from(plansTable)
      .where(
        and(
          eq(plansTable.organizationId, ctx.organizationId),
          eq(plansTable.mode, ctx.mode),
          eq(plansTable.name, input.name),
          ne(plansTable.id, existing.id)
        )
      )
      .limit(1);
    if (dupe) {
      throw AppError.Conflict(
        'a plan with this name already exists',
        { name: input.name },
        NOMBAONE_ERROR_CODES.PLAN_NAME_TAKEN
      );
    }
  }

  const patch: Partial<Pick<PlanRow, 'name' | 'description' | 'metadata'>> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.metadata !== undefined) patch.metadata = input.metadata;

  const [row] = await txDb
    .update(plansTable)
    .set(patch)
    .where(eq(plansTable.id, existing.id))
    .returning();

  if (!row) {
    throw AppError.InternalServerError(
      'failed to update plan',
      { reference },
      NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
    );
  }

  await emitEvent(txDb, { ...ctx, type: 'plan.updated', payload: { reference } });

  return serializePlan(row);
}
