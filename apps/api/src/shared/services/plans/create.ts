import { and, eq, ne } from 'drizzle-orm';

import { plansTable, type PlanInsert } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '@nombaone/sara/events';
import { mintReference } from '@nombaone/sara/reference';
import { serializePlan } from './serialize';

import type { DomainContext, InfraDb, InfraTxDb } from '@nombaone/sara/context';
import type { CreatePlanInput, PlanResponseData } from './types';

/**
 * The name-uniqueness pre-check: a plan name is unique per (org, mode). Split out
 * of `createPlan` because the atomic plan+prices path must run every guard BEFORE
 * it opens a transaction — a guard that fires mid-transaction is a rollback we
 * never needed. The `plans_org_env_name_unique` index remains the structural
 * backstop for the race this read cannot see.
 *
 * `exceptPlanId` excludes the plan being RENAMED from its own collision check —
 * a rename to the name it already has is not a conflict.
 */
export async function assertPlanNameFree(
  db: InfraDb,
  ctx: DomainContext,
  name: string,
  exceptPlanId?: string
): Promise<void> {
  const [existing] = await db
    .select({ id: plansTable.id })
    .from(plansTable)
    .where(
      and(
        eq(plansTable.organizationId, ctx.organizationId),
        eq(plansTable.mode, ctx.mode),
        eq(plansTable.name, name),
        ...(exceptPlanId === undefined ? [] : [ne(plansTable.id, exceptPlanId)])
      )
    )
    .limit(1);

  if (existing) {
    throw AppError.Conflict(
      'a plan with this name already exists',
      { name },
      NOMBAONE_ERROR_CODES.PLAN_NAME_TAKEN
    );
  }
}

/** The plan row a create writes. Shared by `createPlan` and `createPlanWithPrices`
 *  so the two insert IDENTICAL rows — a default added here is added to both. */
export function buildPlanValues(
  ctx: DomainContext,
  input: CreatePlanInput,
  reference: string
): PlanInsert {
  return {
    reference,
    organizationId: ctx.organizationId,
    mode: ctx.mode,
    name: input.name,
    description: input.description ?? null,
    metadata: input.metadata ?? {},
  };
}

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
  await assertPlanNameFree(txDb, ctx, input.name);

  const reference = mintReference('PLN');

  const [row] = await txDb
    .insert(plansTable)
    .values(buildPlanValues(ctx, input, reference))
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
