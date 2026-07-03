import { and, eq } from 'drizzle-orm';

import {
  pricesTable,
  subscriptionItemsTable,
  subscriptionSchedulesTable,
  subscriptionsTable,
} from '@nombaone/core-db/schema';

import { emitEvent } from '../events';
import { loadActiveSchedule } from './queries';

import type { DomainContext, InfraTxDb } from '../context';

/**
 * Apply any schedule phase due at `periodIndex` — the boundary the sweep is about
 * to bill (B10). Swaps the subscription's effective price + its item to the phase's
 * price, marks the phase consumed (stamped), releases the schedule when all phases
 * are consumed. Applying AT THE BOUNDARY (not at API-call time) is exactly B10.
 * Returns whether a phase was applied. Idempotent: a consumed phase is skipped.
 */
export async function applyDuePhase(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: { subscriptionId: string; periodIndex: number }
): Promise<boolean> {
  const schedule = await loadActiveSchedule(txDb, ctx, input.subscriptionId);
  if (!schedule) return false;

  const idx = schedule.phases.findIndex(
    (p) => p.startIndex === input.periodIndex && !p.consumedAt
  );
  if (idx < 0) return false;
  const phase = schedule.phases[idx]!;

  const [price] = await txDb
    .select({ id: pricesTable.id, unitAmount: pricesTable.unitAmount })
    .from(pricesTable)
    .where(
      and(
        eq(pricesTable.organizationId, ctx.organizationId),
        eq(pricesTable.environment, ctx.environment),
        eq(pricesTable.id, phase.priceId)
      )
    )
    .limit(1);
  if (!price) return false; // price vanished — skip rather than crash the cycle

  await txDb
    .update(subscriptionsTable)
    .set({ priceId: price.id })
    .where(eq(subscriptionsTable.id, input.subscriptionId));
  await txDb
    .update(subscriptionItemsTable)
    .set({
      priceId: price.id,
      unitAmount: price.unitAmount,
      ...(phase.quantity ? { quantity: phase.quantity } : {}),
    })
    .where(
      and(
        eq(subscriptionItemsTable.organizationId, ctx.organizationId),
        eq(subscriptionItemsTable.environment, ctx.environment),
        eq(subscriptionItemsTable.subscriptionId, input.subscriptionId)
      )
    );

  const now = new Date().toISOString();
  const phases = schedule.phases.map((p, i) => (i === idx ? { ...p, consumedAt: now } : p));
  const allConsumed = phases.every((p) => p.consumedAt);
  await txDb
    .update(subscriptionSchedulesTable)
    .set({ phases, status: allConsumed ? 'released' : 'active' })
    .where(eq(subscriptionSchedulesTable.id, schedule.id));

  await emitEvent(txDb, {
    ...ctx,
    type: 'subscription.updated',
    payload: { reference: schedule.reference, periodIndex: input.periodIndex },
  });
  return true;
}
