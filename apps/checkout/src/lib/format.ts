/**
 * Pure formatting helpers for the checkout. Mirrors apps/console's `format.ts`
 * so money + dates read identically across the platform (DESIGN-SYSTEM §13:
 * "₦" prefix, 2 decimals). Money is always in kobo (NGN minor unit).
 */

/**
 * Convert kobo (NGN minor unit) to the canonical "₦ 12,500.00" display string.
 * Negative kobo becomes "−₦ 12,500.00" (U+2212 proper minus).
 */
export function formatKoboAsNGN(kobo: number): string {
  const naira = Math.abs(kobo) / 100;
  const formatted = naira.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return kobo < 0 ? `−₦ ${formatted}` : `₦ ${formatted}`;
}

/** Long absolute date: "12 Feb 2026". */
export function absoluteDate(date: Date | string | null): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
