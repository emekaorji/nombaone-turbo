/**
 * ── Money unit at the Nomba boundary (D.1) ─────────────────────────────────
 *
 * Our engine is integer KOBO end-to-end (₦1 = 100 kobo — invoices, prices, ledger).
 * Nomba amounts are NAIRA decimals. Confirmed two ways on 2026-07-01 (prod):
 *   • a live payment of `order.amount: 100` charged ₦100 and the transaction record
 *     reported `amount: "100.0"` (via `GET /v1/transactions/accounts/{subAccount}`);
 *   • the docs: the checkout amount is "a string e.g. `10000.00`" and "not in kobo".
 *
 * So EVERY amount crossing the Nomba boundary must be converted, or a real charge is
 * 100× off. Send with `koboToNombaAmount`, read with `nombaAmountToKobo`.
 */

/** SEND: integer kobo → a naira decimal STRING for a Nomba request body (500000 → "5000.00"). */
export const koboToNombaAmount = (kobo: number): string => (kobo / 100).toFixed(2);

/** READ: a Nomba naira amount (string `"5000.0"` or number) → integer kobo (500000).
 *  Returns 0 for null/undefined/non-numeric so a malformed amount never NaN-poisons math. */
export const nombaAmountToKobo = (naira: string | number | null | undefined): number => {
  const n = Number(naira);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
