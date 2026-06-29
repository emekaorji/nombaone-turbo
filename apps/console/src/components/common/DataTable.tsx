'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@nombaone/ui/components/ui/table';
import { cn } from '@/lib/cn';

/**
 * PARADIGM — TanStack Table for STATE, not rendering. The library owns column
 * definitions and the (here, server-driven) row model; the actual markup is the
 * shared shadcn `Table`. Pagination + filtering live in the URL via `nuqs` and
 * the data arrives already-paged from the RSC, so we only wire the core row
 * model — no client sorting/pagination plugin. `onRowHref` makes a row a link to
 * its detail page.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  onRowHref,
  emptyState,
  className,
}: {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onRowHref?: (row: TData) => string;
  emptyState?: React.ReactNode;
  className?: string;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border', className)}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="h-10 text-xs font-medium text-muted-foreground">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => {
            const href = onRowHref?.(row.original);
            return (
              <TableRow
                key={row.id}
                className={cn(href && 'cursor-pointer')}
                onClick={
                  href
                    ? () => {
                        window.location.href = href;
                      }
                    : undefined
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-3 text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
