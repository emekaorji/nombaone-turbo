import { Badge } from '@nombaone/ui/components/ui/badge';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { RelativeDate } from '@/components/common/RelativeDate';
import { requireCapability } from '@/lib/rbac';
import { listAuditLog, type AuditLogEntry } from '@/lib/reads';

export const metadata = { title: 'Audit log · Nombaone Admin' };

const COLUMNS: ReadonlyArray<Column<AuditLogEntry>> = [
  {
    key: 'createdAt',
    header: 'When',
    cell: (row) => (
      <RelativeDate value={row.createdAt} className="text-xs text-muted-foreground" />
    ),
  },
  {
    key: 'operator',
    header: 'Operator',
    cell: (row) => (
      <span className="font-medium">{row.operatorName ?? row.operatorId.slice(0, 8)}</span>
    ),
  },
  {
    key: 'action',
    header: 'Action',
    cell: (row) => (
      <Badge variant="secondary" className="font-mono text-[11px]">
        {row.action}
      </Badge>
    ),
  },
  {
    key: 'target',
    header: 'Target',
    cell: (row) =>
      row.targetReference ? (
        <span className="text-xs text-muted-foreground">
          {row.targetType ? `${row.targetType}: ` : ''}
          {row.targetReference}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground/60">—</span>
      ),
  },
  { key: 'summary', header: 'Summary', cell: (row) => row.summary },
];

/**
 * Audit log. Read-gated by `audit:read`. Lists the append-only operator audit
 * trail (`admin_audit_log`), newest first — the immutable "who did this" record
 * written by every privileged mutation. Not environment-scoped: operators act
 * across rings.
 */
export default async function AuditLogPage() {
  await requireCapability('audit:read');
  const entries = await listAuditLog(100);

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only record of privileged operator actions."
      />
      <DataTable
        columns={COLUMNS}
        rows={entries}
        getRowKey={(row) => row.id}
        emptyMessage="No audit entries yet."
      />
    </>
  );
}
