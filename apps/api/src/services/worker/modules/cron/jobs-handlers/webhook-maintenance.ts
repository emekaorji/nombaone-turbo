import { autoReplayDeadLetters, deliverPending } from '@nombaone/sara/webhooks';

import { db } from '@shared/config/db';
import { env } from '@shared/config/env';
import { logger } from '@shared/observability/logger';

/**
 * The webhook-maintenance tick (07): drain due deliveries (pending/failed/re-armed
 * replays) then auto-replay recovered dead-letters. Both passes are idempotent and
 * platform-wide — the drain marks outcomes only after the POST resolves
 * (at-least-once), and auto-replay only touches `dead` rows under the ceiling.
 */
export async function handleWebhookMaintenance(): Promise<void> {
  const drained = await deliverPending(db, { limit: env.BILLING_BATCH_SIZE });
  const replayed = await autoReplayDeadLetters(db, { limit: env.BILLING_BATCH_SIZE });
  logger.info('[cron] webhook-maintenance ran', { ...drained, rearmed: replayed.rearmed });
}
