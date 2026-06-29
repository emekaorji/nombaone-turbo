import { cn } from '@/lib/cn';
import type { StatusVariant } from '@/lib/status';

/**
 * The canonical state chip. `variant` chooses the colour set (sourced from the
 * `status.ts` registry, which maps each domain status to one of these); the dot
 * + label follow. A single shape for every "this resource is in state X" badge.
 */
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
