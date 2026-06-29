import type { ReactNode } from 'react';
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
 * A small, generic, SERVER-RENDERABLE table. The operator panel's lists are
 * read views, so the table stays declarative — a `columns` config maps a row to
 * cells — rather than pulling in client-side table state. Each column owns its
 * header, a render function, and optional alignment. Empty data renders a
 * single centered empty-state row.
 */

export type Column<T> = {
  /** Stable key for the column. */
  key: string;
  /** Header label. */
  header: ReactNode;
  /** Cell renderer for a row. */
  cell: (row: T) => ReactNode;
  /** Optional cell/header alignment. */
  align?: 'left' | 'right' | 'center';
  /** Optional extra classes on the cell. */
  className?: string;
};

const ALIGN_CLASS: Record<NonNullable<Column<unknown>['align']>, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyMessage = 'No records to show.',
  className,
}: {
  columns: ReadonlyArray<Column<T>>;
  rows: ReadonlyArray<T>;
  getRowKey: (row: T, index: number) => string;
  emptyMessage?: string;
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-card', className)}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(
                  'h-10 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                  column.align && ALIGN_CLASS[column.align]
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => (
              <TableRow key={getRowKey(row, index)}>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      'text-sm',
                      column.align && ALIGN_CLASS[column.align],
                      column.className
                    )}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
