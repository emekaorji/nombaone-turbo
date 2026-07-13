import { cn } from '@/lib/cn';

import type { ExampleStatus } from '@nombaone/core-contracts/types';

/**
 * StatusPill — the canonical state chip (DESIGN-SYSTEM §11), the same shape and
 * colour vocabulary the console uses. `variant` chooses the colour set;
 * `children` is the label.
 */
export type StatusVariant = 'pending' | 'success' | 'error' | 'neutral' | 'info';

const VARIANTS: Record<StatusVariant, { container: string; dot: string }> = {
  pending: { container: 'bg-warning-50 text-warning-700 border-warning-200', dot: 'bg-warning-500' },
  success: { container: 'bg-success-50 text-success-700 border-success-200', dot: 'bg-success-500' },
  error: { container: 'bg-error-50 text-error-700 border-error-200', dot: 'bg-error-500' },
  neutral: { container: 'bg-neutral-100 text-neutral-600 border-neutral-200', dot: 'bg-neutral-400' },
  info: { container: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
};

export function StatusPill({
  variant,
  className,
  children,
}: {
  variant: StatusVariant;
  className?: string;
  children: React.ReactNode;
}) {
  const v = VARIANTS[variant];
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium leading-none',
        v.container,
        className
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', v.dot)} />
      <span>{children}</span>
    </span>
  );
}

/**
 * Resource status → pill descriptor for an example (mirrors console `status.ts`).
 * The example slice derives status from the ledger as `pending | settled`, and the
 * contract DTO additionally allows `failed`; all three are mapped here so an
 * unexpected value still degrades to a neutral pill rather than crashing.
 */
const EXAMPLE_STATUS: Record<ExampleStatus, StatusVariant> = {
  pending: 'pending',
  settled: 'success',
  failed: 'error',
};

const STATUS_LABEL: Record<ExampleStatus, string> = {
  pending: 'Pending',
  settled: 'Paid',
  failed: 'Failed',
};

export function exampleStatusPill(status: string): { variant: StatusVariant; label: string } {
  return {
    variant: (EXAMPLE_STATUS as Record<string, StatusVariant>)[status] ?? 'neutral',
    label: (STATUS_LABEL as Record<string, string>)[status] ?? status,
  };
}

/**
 * Invoice status → pill descriptor for the end-customer pay page (`/i/<token>`).
 * Status is DERIVED from the row's timestamp signals (see `lib/billing.ts`),
 * same vocabulary as the console. Unknown values degrade to a neutral pill.
 */
const INVOICE_STATUS: Record<string, StatusVariant> = {
  draft: 'neutral',
  open: 'pending',
  partially_paid: 'pending',
  paid: 'success',
  void: 'neutral',
  uncollectible: 'error',
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  open: 'Awaiting payment',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  void: 'Void',
  uncollectible: 'Uncollectible',
};

export function invoiceStatusPill(status: string): { variant: StatusVariant; label: string } {
  return {
    variant: INVOICE_STATUS[status] ?? 'neutral',
    label: INVOICE_STATUS_LABEL[status] ?? status,
  };
}
