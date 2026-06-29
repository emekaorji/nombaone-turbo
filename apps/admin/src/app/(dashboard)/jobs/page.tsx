import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@nombaone/ui/components/ui/card';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusPill } from '@/components/common/StatusPill';
import { JobTriggerButton } from './JobTriggerButton';
import { requireCapability } from '@/lib/rbac';
import { operatorCan } from '@/lib/rbac';
import { readQueueStats, type QueueDepth } from '@/lib/queue/queue-stats';
import { TRIGGERABLE_JOBS } from '@/lib/queue/jobs';

export const metadata = { title: 'Jobs & workers · Nombaone Admin' };

const COLUMNS: ReadonlyArray<Column<QueueDepth>> = [
  { key: 'name', header: 'Queue', cell: (q) => <span className="font-medium">{q.name}</span> },
  { key: 'waiting', header: 'Waiting', align: 'right', cell: (q) => q.waiting.toLocaleString() },
  { key: 'active', header: 'Active', align: 'right', cell: (q) => q.active.toLocaleString() },
  { key: 'delayed', header: 'Delayed', align: 'right', cell: (q) => q.delayed.toLocaleString() },
  { key: 'completed', header: 'Completed', align: 'right', cell: (q) => q.completed.toLocaleString() },
  {
    key: 'failed',
    header: 'Failed',
    align: 'right',
    cell: (q) => (
      <span className={q.failed > 0 ? 'font-semibold text-red-600' : undefined}>
        {q.failed.toLocaleString()}
      </span>
    ),
  },
];

/**
 * Jobs & workers. Read-gated by `jobs:read`. Reads BullMQ queue depths via the
 * timeout-wrapped reader that degrades to an "unavailable" state when Redis is
 * unreachable. The ad-hoc job triggers are only enabled for operators who hold
 * `jobs:trigger` (the button is disabled otherwise; the action re-checks anyway).
 */
export default async function JobsPage() {
  const operator = await requireCapability('jobs:read');
  const stats = await readQueueStats();
  const canTrigger = operatorCan(operator.role, 'jobs:trigger');

  return (
    <>
      <PageHeader
        title="Jobs & workers"
        description="BullMQ queue depths and guarded ad-hoc job triggers."
        actions={
          <StatusPill
            group="queue"
            value={stats.status === 'ok' ? 'available' : 'unavailable'}
          />
        }
      />

      {stats.status === 'ok' ? (
        <DataTable
          columns={COLUMNS}
          rows={stats.queues}
          getRowKey={(q) => q.name}
          emptyMessage="No queues registered."
        />
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Queue metrics are unavailable — Redis could not be reached. Queue health will
            appear here once the connection recovers.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ad-hoc job triggers</CardTitle>
          <CardDescription>
            {canTrigger
              ? 'Run a maintenance task outside its schedule. Each trigger is audited.'
              : 'Your role can view queue health but cannot trigger jobs.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {TRIGGERABLE_JOBS.map((job) => (
            <div key={job.task} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{job.label}</p>
                <p className="truncate text-xs text-muted-foreground">{job.consequences[0]}</p>
              </div>
              <JobTriggerButton
                task={job.task}
                label={job.label}
                consequences={job.consequences}
                disabled={!canTrigger}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
