import { formatKobo, type Kobo } from '@nombaone/sara/money';

import { cn } from '@/lib/cn';

/**
 * Render an integer-kobo amount as formatted NGN (e.g. `123450` → "₦1,234.50").
 * Money is ALWAYS integer minor units in this stack; this component is the one
 * place the panel turns kobo into a display string, so formatting never drifts.
 * Tabular numerals keep columns aligned in tables.
 */
export function MoneyAmount({
  kobo,
  className,
}: {
  kobo: Kobo;
  className?: string;
}) {
  return (
    <span className={cn('font-medium tabular-nums', className)}>{formatKobo(kobo)}</span>
  );
}
