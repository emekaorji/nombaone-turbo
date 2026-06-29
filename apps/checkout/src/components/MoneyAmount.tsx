import { formatKoboAsNGN } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * Money formatting wrapper — all checkout money renders through this so the
 * locale/currency convention lives in one place (mirrors the console).
 * Renders tabular-nums for alignment.
 */
export function MoneyAmount({ kobo, className }: { kobo: number; className?: string }) {
  return <span className={cn('tabular-nums', className)}>{formatKoboAsNGN(kobo)}</span>;
}
