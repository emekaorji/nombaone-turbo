import type { Kobo } from '@nombaone/sara/money';

export interface GrantConsumption {
  grantId: string;
  grantReference: string;
  applied: Kobo;
}

/**
 * PURE oldest-first consumption (C8 ★). Given grants ALREADY ordered
 * `created_at asc, id asc`, consume each grant's `remaining` against `amountDue`
 * until the amount is covered or credit is exhausted. Deterministic and replayable
 * — the consumed set is a pure function of the (ordered) grant ledger.
 */
export function consumeGrants(
  grants: ReadonlyArray<{ id: string; reference: string; remaining: Kobo }>,
  amountDue: Kobo
): GrantConsumption[] {
  const out: GrantConsumption[] = [];
  let left = amountDue;
  for (const g of grants) {
    if (left <= 0) break;
    const applied = Math.min(g.remaining, left);
    if (applied > 0) {
      out.push({ grantId: g.id, grantReference: g.reference, applied });
      left -= applied;
    }
  }
  return out;
}
