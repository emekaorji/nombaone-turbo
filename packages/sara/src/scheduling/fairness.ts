import { sql } from 'drizzle-orm';

import type { Mode } from '@nombaone/core-contracts/types';
import type { InfraDb } from '../context';

export interface FairDueRow {
  id: string;
  reference: string;
  organizationId: string;
  mode: Mode;
  currentPeriodIndex: number;
}

export interface FairSweepConfig {
  /** Max rows a single tick claims across all tenants. */
  globalBudget: number;
  /** Max rows a single tenant contributes to one tick. */
  perTenantBudget: number;
}

/** Tunable, not load-bearing for correctness (04's catch-up guarantees completion). */
export const FAIR_SWEEP_DEFAULTS: FairSweepConfig = { globalBudget: 500, perTenantBudget: 50 };

/**
 * Fair due-selection (H7 ★). A round-robin over tenants: `row_number()` partitions
 * the due rows per tenant (oldest-due first WITHIN a tenant), the outer filter caps
 * each tenant to `perTenantBudget`, and the outer order is **by rank first**
 * (`rn ASC`) so every tenant's rank-1 is drawn before any tenant's rank-2 — a
 * backlog tenant with 10,000 due cannot fill the window ahead of a tenant with 10.
 * One indexed query over 04's due predicate; no N+1. Selection only — 04's locked,
 * idempotent claim + `(subscription, period)` uniqueness still guard the charge.
 */
export async function selectDueSubscriptionsFair(
  db: InfraDb,
  mode: Mode,
  now: Date,
  cfg: FairSweepConfig = FAIR_SWEEP_DEFAULTS
): Promise<FairDueRow[]> {
  const result = await db.execute(sql`
    SELECT id, reference, organization_id AS "organizationId",
           mode, current_period_index AS "currentPeriodIndex"
    FROM (
      SELECT id, reference, organization_id, mode, current_period_index, next_billing_at,
             row_number() OVER (
               PARTITION BY organization_id ORDER BY next_billing_at ASC, id ASC
             ) AS rn
      FROM subscriptions
      WHERE status IN ('active', 'trialing')
        AND mode = ${mode}
        AND next_billing_at IS NOT NULL
        AND next_billing_at <= ${now}
    ) ranked
    WHERE rn <= ${cfg.perTenantBudget}
    ORDER BY rn ASC, next_billing_at ASC, id ASC
    LIMIT ${cfg.globalBudget}
  `);
  // pg driver → { rows }, neon-http driver → array; normalize.
  const rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? []);
  return rows as FairDueRow[];
}
