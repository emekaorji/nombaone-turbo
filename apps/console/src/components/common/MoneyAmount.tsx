import { formatKoboAsNGN } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * Money formatting wrapper — all console money renders through this so the
 * locale/currency convention lives in one place. Input is integer kobo (NGN
 * minor unit); output is "₦12,500.00", tabular for column alignment.
 */
export function MoneyAmount({ kobo, className }: { kobo: number; className?: string }) {
  return <span className={cn('tabular-nums', className)}>{formatKoboAsNGN(kobo)}</span>;
}
