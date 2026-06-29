/**
 * Static catalogue of ad-hoc-triggerable maintenance jobs + their human
 * consequence text. Kept SEPARATE from the `'use server'` action module
 * (`actions.ts`) because a server-action file may only export async functions;
 * this plain module is safe to import from both the server action and the
 * client confirm-dialog island.
 */
export const TRIGGERABLE_JOBS = [
  {
    task: 'reconcile-ledger',
    label: 'Reconcile ledger',
    consequences: [
      'Re-derives debit/credit totals across every organization in the current ring.',
      'Flags any zero-sum drift for investigation. Read-only — moves no money.',
    ],
  },
  {
    task: 'deliver-webhooks',
    label: 'Flush pending webhooks',
    consequences: [
      'Enqueues delivery of every pending outbound webhook.',
      'Endpoints may receive duplicate deliveries; consumers must be idempotent.',
    ],
  },
  {
    task: 'expire-sessions',
    label: 'Expire stale sessions',
    consequences: ['Revokes org sessions past their TTL. Affected users must re-authenticate.'],
  },
] as const;

export type TriggerableTask = (typeof TRIGGERABLE_JOBS)[number]['task'];

/** Fast membership check for action-side validation. */
export const VALID_TASKS = new Set<string>(TRIGGERABLE_JOBS.map((job) => job.task));
