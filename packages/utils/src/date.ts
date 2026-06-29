/**
 * Converts an optional date-like value into a Date instance or null.
 */
export function toDateOrNull(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}
