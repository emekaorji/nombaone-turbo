import { adminAuditLogTable } from '@nombaone/core-db/schema';

import type { InfraDb } from '@nombaone/sara/context';

/**
 * PARADIGM — the append-only operator audit trail.
 *
 * Distinct from `domain_events` (the tenant-facing, per-org event spine): this
 * is the PLATFORM-side record of privileged actions taken by internal operators
 * through the admin console. Every privileged operator mutation writes exactly
 * one row here — who (operatorId), what (action), against which resource
 * (targetType/targetReference), and a human-readable summary. Rows are never
 * updated or deleted; the table is the immutable answer to "who did this".
 *
 * Because it is the system of record for accountability, `recordAudit` is
 * intentionally minimal and non-throwing in spirit: it takes a plain read handle
 * (the write is a single statement) and is NOT tenant-scoped — operators act
 * across organizations, so the row deliberately carries no `(org, env)` filter.
 * Callers pass an already-resolved `operatorId`; this function never trusts a
 * client-supplied actor.
 */
export const recordAudit = async (
  db: InfraDb,
  entry: {
    operatorId: string;
    action: string;
    targetType?: string;
    targetReference?: string;
    summary: string;
  }
): Promise<void> => {
  await db.insert(adminAuditLogTable).values({
    operatorId: entry.operatorId,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetReference: entry.targetReference ?? null,
    summary: entry.summary,
  });
};
