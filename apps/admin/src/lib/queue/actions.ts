'use server';

import { schedulerQueue, SCHEDULER_QUEUE_NAME } from '@nombaone/queue';
import { recordAudit } from '@nombaone/sara/audit';

import { actionError, actionOk, withRevalidation, type ActionResult } from '@/lib/action-helpers';
import { requireCapability } from '@/lib/rbac';
import { getDb } from '@/lib/db';
import { VALID_TASKS } from '@/lib/queue/jobs';

/**
 * GUARDED AD-HOC JOB TRIGGERS.
 *
 * Operators can fire a scheduled maintenance task on demand (out of its normal
 * cron cadence) — e.g. force a reconciliation sweep now. Each trigger:
 *   • requires the `jobs:trigger` capability (RBAC, server-side);
 *   • enqueues a ONE-OFF run of the same scheduler task the cron registers, so
 *     the ad-hoc path and the scheduled path share one worker handler;
 *   • is wrapped in `withRevalidation` so the Jobs screen refreshes;
 *   • writes an audit row (who triggered what) — every privileged mutation does.
 *
 * The UI fronts this with a consequence-listing confirm dialog so an operator
 * sees what the job will do before firing it. The job CATALOGUE lives in
 * `./jobs` (a `'use server'` file may only export async functions).
 */

/**
 * Trigger a one-off run of a scheduler task now. Gated by `jobs:trigger`,
 * audited, and revalidates the Jobs screen on success.
 */
export async function triggerJob(task: string): Promise<ActionResult<{ jobId: string }>> {
  return withRevalidation('/jobs', async () => {
    const operator = await requireCapability('jobs:trigger');

    if (!VALID_TASKS.has(task)) {
      return actionError('invalid_task', `Unknown job '${task}'.`);
    }

    const job = await schedulerQueue.add(SCHEDULER_QUEUE_NAME, { task });

    await recordAudit(getDb(), {
      operatorId: operator.id,
      action: 'jobs.trigger',
      targetType: 'scheduler_task',
      targetReference: task,
      summary: `Triggered an ad-hoc run of '${task}'.`,
    });

    return actionOk({ jobId: String(job.id ?? task) });
  });
}
