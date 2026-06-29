import { Queue, QueueEvents } from 'bullmq';

import { connection } from '../config';
import { defaultJobOptions } from './options';

export const SCHEDULER_QUEUE_NAME = 'scheduler';

/**
 * A recurring/cron job. `name` selects which periodic task the worker runs
 * (e.g. 'reconcile-balances', 'expire-sessions').
 */
export interface SchedulerJobData {
  /** Logical task name the worker switches on. */
  task: string;
  payload?: Record<string, unknown>;
}

export type SchedulerJobResult = {
  task: string;
  ranAt: string;
};

export const schedulerQueue = new Queue<SchedulerJobData, SchedulerJobResult>(
  SCHEDULER_QUEUE_NAME,
  {
    connection,
    defaultJobOptions,
  },
);

export const schedulerQueueEvents = new QueueEvents(SCHEDULER_QUEUE_NAME, {
  connection,
});

/**
 * Register (or update) a repeatable job using BullMQ's Job Scheduler.
 *
 * The scheduler id IS the resource id: BullMQ keeps exactly one active
 * scheduler per id, so calling this again with the same `task` updates the
 * schedule in place rather than creating duplicates. jobId = resourceId.
 */
export function upsertCron(task: string, cron: string, payload?: Record<string, unknown>) {
  // jobId = resourceId -> the scheduler id is the task name, guaranteeing a
  // single recurring entry per task even if this runs on every boot.
  return schedulerQueue.upsertJobScheduler(
    task,
    { pattern: cron },
    {
      name: task,
      data: { task, payload },
    },
  );
}

/**
 * Remove a previously registered repeatable job by its task id.
 */
export function removeCron(task: string) {
  return schedulerQueue.removeJobScheduler(task);
}
