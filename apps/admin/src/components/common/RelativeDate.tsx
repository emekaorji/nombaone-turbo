import { cn } from '@/lib/cn';

/**
 * Render an ISO timestamp as a compact absolute date-time. Kept server-safe (no
 * client `Date.now()` drift / hydration mismatch) — operators want the exact
 * timestamp of a row, not a fuzzy "2h ago". The full ISO value is in the
 * `title` for hover.
 */
export function RelativeDate({
  value,
  className,
}: {
  value: string | Date;
  className?: string;
}) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const iso = date.toISOString();
  const formatted = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date);
  return (
    <time dateTime={iso} title={iso} className={cn('tabular-nums', className)}>
      {formatted} UTC
    </time>
  );
}
