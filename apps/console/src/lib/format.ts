/**
 * Pure formatting helpers for the console. Money is always integer kobo (NGN
 * minor unit); the "₦" prefix + 2-decimal convention lives here so it reads
 * identically everywhere (the `MoneyAmount` component renders through this).
 */

/**
 * Convert kobo (NGN minor unit) to the canonical "₦12,500.00" display string.
 * Negative kobo becomes "−₦12,500.00" (U+2212 proper minus).
 */
export function formatKoboAsNGN(kobo: number): string {
  const naira = Math.abs(kobo) / 100;
  const formatted = naira.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return kobo < 0 ? `−₦${formatted}` : `₦${formatted}`;
}

/** Long absolute date: "12 Feb 2026". */
export function absoluteDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Date + time: "12 Feb 2026, 14:08". */
export function absoluteDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
