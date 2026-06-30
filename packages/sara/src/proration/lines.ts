import { prorate } from './math';

import type { BuildProrationInput, ProrationLine } from './types';

const SECOND_MS = 1000;

/**
 * Build the signed proration lines for a mid-cycle change (C1/C2/C4/C5/C7):
 *  • a NEGATIVE `proration` credit for the unused remainder of the OLD amount;
 *  • a POSITIVE `proration` charge for the NEW amount over the remaining window.
 * Net positive ⇒ upgrade (charge now); net negative ⇒ downgrade (banked as credit).
 *
 * Returns **no lines** when the subscription is `trialing` (C6 — nothing has been
 * charged, nothing to prorate) or when `prorationBehavior === 'none'`. Pure: the
 * window is measured in whole seconds and prorated by floor-division (no float).
 */
export function buildProrationLines(input: BuildProrationInput): ProrationLine[] {
  if (input.status === 'trialing' || input.prorationBehavior === 'none') return [];

  const totalUnits = Math.max(
    1,
    Math.floor((input.periodEnd.getTime() - input.periodStart.getTime()) / SECOND_MS)
  );
  const remainingUnits = Math.max(
    0,
    Math.floor((input.periodEnd.getTime() - input.changeAt.getTime()) / SECOND_MS)
  );

  const unusedOld = prorate(input.oldAmountKobo, remainingUnits, totalUnits);
  const newCharge = prorate(input.newAmountKobo, remainingUnits, totalUnits);

  const lines: ProrationLine[] = [];
  if (unusedOld > 0) {
    lines.push({
      kind: 'proration',
      description: 'Unused time on previous price',
      amount: -unusedOld,
      periodStart: input.changeAt,
      periodEnd: input.periodEnd,
    });
  }
  if (newCharge > 0) {
    lines.push({
      kind: 'proration',
      description: 'Remaining time on new price',
      amount: newCharge,
      periodStart: input.changeAt,
      periodEnd: input.periodEnd,
    });
  }
  return lines;
}

/** The net effect of proration lines (positive = charge now, negative = credit). */
export const prorationNet = (lines: ProrationLine[]): number =>
  lines.reduce((sum, l) => sum + l.amount, 0);
