/**
 * Money is integer kobo everywhere in the domain; the UI divides by 100 for
 * display and NEVER stores a float (engineering doc §7). These are the only
 * money formatters — and the only naira PARSER — the console uses, so the rule
 * is enforceable by inspection.
 */

const group = (n: number): string => n.toLocaleString('en-US');

/** Full naira, e.g. 500000 → "₦5,000". Fractional kobo shows up to 2 dp. */
export function naira(kobo: number): string {
  const n = Math.round(kobo) / 100;
  return `₦${group(Number.isInteger(n) ? n : Number(n.toFixed(2)))}`;
}

/** Abbreviated naira for headline figures, e.g. 34000000 → "₦340k", 482000000 → "₦4.82M". */
export function nairaShort(kobo: number): string {
  const n = Math.round(kobo) / 100;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `₦${trim(n / 1_000_000)}M`;
  if (abs >= 1_000) return `₦${trim(n / 1_000)}k`;
  return `₦${group(n)}`;
}

/**
 * Parse a naira string the merchant typed ("2,500", "₦2,500.00") to integer kobo.
 * Returns null on anything that is not a positive naira figure with at most 2 dp —
 * the caller turns that into a field error rather than sending a NaN to the engine.
 *
 * Shared by the server action that inserts the price and by the client-side
 * "Stored as N kobo" hint, so the field can never validate in the browser and
 * then round differently on the server.
 */
export function toKobo(raw: string): number | null {
  const cleaned = raw.replace(/[₦,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const kobo = Math.round(parseFloat(cleaned) * 100);
  return Number.isSafeInteger(kobo) && kobo > 0 ? kobo : null;
}

const trim = (n: number): string => {
  const s = n.toFixed(2);
  return s.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
};
