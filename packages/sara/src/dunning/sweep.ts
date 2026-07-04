import { coerceFailureReason } from '../nomba/failure-taxonomy';
import { executeDueAttempt, scheduleFirstAttempt } from './attempt';
import { selectDueDunningAttempts, selectPastDueNeedingDunning } from './queries';

import type { Mode } from '@nombaone/core-contracts/types';
import type { DomainContext, InfraTxDb } from '../context';

export interface DunningSweepDeps {
  db: InfraTxDb;
  mode: Mode;
  now: Date;
  batchSize: number;
}

export interface DunningSweepResult {
  started: number; // first attempts scheduled for newly-detected past_due invoices
  executed: number; // due attempts run this tick
}

const ctxOf = (row: { organizationId: string; mode: Mode }): DomainContext => ({
  organizationId: row.organizationId,
  mode: row.mode,
});

/**
 * The dunning sweep (K4) — two idempotent passes:
 *  1. DETECT: `past_due` invoices with no dunning attempt yet → `scheduleFirstAttempt`
 *     (classified from the failure reason persisted on the invoice at collect time).
 *  2. EXECUTE: every due `scheduled` attempt → `executeDueAttempt` (claim-guarded, so
 *     a replayed tick or a concurrent worker double-acts on nothing — J6).
 * A tick that finds nothing due is a no-op.
 */
export async function runDunningSweep(deps: DunningSweepDeps): Promise<DunningSweepResult> {
  const { db, mode, now, batchSize } = deps;

  const needing = await selectPastDueNeedingDunning(db, mode, batchSize);
  let started = 0;
  for (const { invoice, subscription } of needing) {
    const ctx = ctxOf(invoice);
    const row = await scheduleFirstAttempt(db, ctx, {
      subscription,
      invoice,
      reason: coerceFailureReason(invoice.lastFailureReason),
      gatewayMessage: invoice.lastGatewayMessage,
    });
    if (row) started += 1;
  }

  const due = await selectDueDunningAttempts(db, mode, now, batchSize);
  let executed = 0;
  for (const attempt of due) {
    await executeDueAttempt(db, ctxOf(attempt), attempt);
    executed += 1;
  }

  return { started, executed };
}
