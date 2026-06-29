import { Badge } from '@nombaone/ui/components/ui/badge';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { MoneyAmount } from '@/components/common/MoneyAmount';
import { RelativeDate } from '@/components/common/RelativeDate';
import { StatusPill } from '@/components/common/StatusPill';
import { requireCapability } from '@/lib/rbac';
import { getSelectedEnvironment } from '@/lib/env';
import { listPlatformExamples, type PlatformExampleRow } from '@/lib/reads';

export const metadata = { title: 'Examples · Nombaone Admin' };

const COLUMNS: ReadonlyArray<Column<PlatformExampleRow>> = [
  {
    key: 'reference',
    header: 'Reference',
    cell: (row) => <span className="font-mono text-xs">{row.reference}</span>,
  },
  {
    key: 'organization',
    header: 'Organization',
    cell: (row) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.organizationName}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">
          {row.organizationReference}
        </p>
      </div>
    ),
  },
  {
    key: 'kind',
    header: 'Kind',
    cell: (row) => (
      <Badge variant="outline" className="capitalize">
        {row.kind}
      </Badge>
    ),
  },
  { key: 'amount', header: 'Amount', align: 'right', cell: (row) => <MoneyAmount kobo={row.amount} /> },
  {
    key: 'attempts',
    header: 'Attempts',
    align: 'right',
    cell: (row) => row.attemptCount.toLocaleString(),
  },
  {
    key: 'createdAt',
    header: 'Created',
    cell: (row) => (
      <RelativeDate value={row.createdAt} className="text-xs text-muted-foreground" />
    ),
  },
];

/**
 * Examples — the operator read view of the deletable example money-path slice,
 * ACROSS every organization. Read-gated by `examples:read`. Filtered to the
 * selected ring server-side (the env cookie is a preference, not authority).
 * The example slice is a worked reference; replace this screen when the real
 * domain lands.
 */
export default async function ExamplesPage() {
  await requireCapability('examples:read');
  const environment = await getSelectedEnvironment();
  const rows = await listPlatformExamples(environment, 50);

  return (
    <>
      <PageHeader
        title="Examples"
        description="Platform-wide view of the example money-path slice."
        actions={<StatusPill group="environment" value={environment} />}
      />
      <DataTable
        columns={COLUMNS}
        rows={rows}
        getRowKey={(row) => row.reference}
        emptyMessage={`No examples in the ${environment} ring.`}
      />
    </>
  );
}
