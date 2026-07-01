import type { DunningAttemptRow } from '@nombaone/core-db/schema';
import type {
  DunningAttemptResponseData,
  DunningAttemptStatus,
  DunningBranch,
} from '@nombaone/core-contracts/types';

/** Row → public DTO (no PII; ISO-8601 UTC timestamps). */
export const serializeDunningAttempt = (row: DunningAttemptRow): DunningAttemptResponseData => ({
  id: row.reference,
  attemptNumber: row.attemptNumber,
  status: row.status as DunningAttemptStatus,
  branch: row.branch as DunningBranch,
  railKey: row.railKey,
  failureReason: row.failureReason,
  gatewayMessage: row.gatewayMessage,
  outcome: row.outcome,
  scheduledAt: row.scheduledAt.toISOString(),
  executedAt: row.executedAt?.toISOString() ?? null,
  nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});
