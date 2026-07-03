'use client';

import { useMemo } from 'react';
import { Flash } from 'iconsax-react';
import { useQueryState } from 'nuqs';
import type { ColumnDef } from '@tanstack/react-table';

import { Button } from '@nombaone/ui/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nombaone/ui/components/ui/select';
import type { ExampleKind, ExampleResponseData } from '@nombaone/core-contracts/types';

import { DataTable } from '@/components/common/DataTable';
import { Reference } from '@/components/common/Reference';
import { StatusPill } from '@/components/common/StatusPill';
import { MoneyAmount } from '@/components/common/MoneyAmount';
import { EmptyState } from '@/components/common/EmptyState';
import { exampleStatusPill } from '@/lib/status';
import { absoluteDate } from '@/lib/format';

/**
 * Examples list island. List STATE is URL-DRIVEN via `nuqs` — `?kind=` (the
 * filter) and `?cursor=` (the keyset page) — so the view is shareable and
 * survives refresh. Changing the filter clears the cursor (a new filter starts a
 * fresh page). TanStack Table owns column/row STATE; the shared `DataTable`
 * renders it. The data itself is paged server-side by the RSC.
 */
export function ExamplesClient({
  rows,
  nextCursor,
  hasMore,
  activeKind,
}: {
  rows: ExampleResponseData[];
  nextCursor: string | null;
  hasMore: boolean;
  activeKind: ExampleKind | null;
}) {
  const [, setKind] = useQueryState('kind');
  const [, setCursor] = useQueryState('cursor');

  const onKindChange = (value: string) => {
    // Setting a filter starts a fresh page — clear the cursor.
    void setCursor(null);
    void setKind(value === 'all' ? null : value);
  };

  const columns = useMemo<ColumnDef<ExampleResponseData>[]>(
    () => [
      {
        header: 'Reference',
        accessorKey: 'id',
        cell: ({ row }) => <Reference value={row.original.id} />,
      },
      {
        header: 'Kind',
        accessorKey: 'kind',
        cell: ({ row }) => <span className="capitalize">{row.original.kind}</span>,
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ row }) => {
          const pill = exampleStatusPill(row.original.status);
          return <StatusPill variant={pill.variant}>{pill.label}</StatusPill>;
        },
      },
      {
        header: 'Amount',
        accessorKey: 'amountInKobo',
        cell: ({ row }) => <MoneyAmount kobo={row.original.amountInKobo} />,
      },
      {
        header: 'Created',
        accessorKey: 'createdAt',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{absoluteDate(row.original.createdAt)}</span>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={activeKind ?? 'all'} onValueChange={onKindChange}>
          <SelectTrigger className="h-9 w-40 text-sm">
            <SelectValue placeholder="All kinds" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        onRowHref={(row) => `/examples/${row.id}`}
        emptyState={
          <EmptyState
            icon={Flash}
            title="No examples yet"
            description="Create an example to watch the double-entry ledger move. This whole slice is deletable."
          />
        }
      />

      {hasMore && nextCursor ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => void setCursor(nextCursor)}>
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
