import { lt } from 'drizzle-orm';

import { requestLogsTable } from '@nombaone/core-db';

import { db } from '@shared/config/db';
import { env } from '@shared/config/env';
import { logger } from '@shared/observability/logger';

/**
 * Request-log retention: delete API request logs older than the retention window.
 * Request logs (which include response bodies) are debugging aids, not records of
 * account — capping their lifetime bounds storage and limits how long response
 * payloads are retained. Idempotent: a replayed tick simply deletes nothing new.
 */
export async function handleRequestLogRetention(): Promise<void> {
  const cutoff = new Date(Date.now() - env.REQUEST_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const deleted = await db.delete(requestLogsTable).where(lt(requestLogsTable.createdAt, cutoff)).returning({ id: requestLogsTable.id });
  logger.info('[cron] request-log-retention ran', { deleted: deleted.length, olderThanDays: env.REQUEST_LOG_RETENTION_DAYS });
}
