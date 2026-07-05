import type { SubscriptionStatus } from '@nombaone/core-contracts/types';
import type { Kobo } from '@nombaone/sara/money';

export type ProrationBehavior = 'create_prorations' | 'none';

/** A signed proration line: a negative credit for unused old time, a positive
 *  charge for the new price's remaining window. */
export interface ProrationLine {
  kind: 'proration';
  description: string;
  amount: Kobo; // signed
  periodStart: Date;
  periodEnd: Date;
}

export interface BuildProrationInput {
  /** old effective amount for the period = oldUnit × oldQuantity (kobo). */
  oldAmountKobo: Kobo;
  /** new effective amount for the period = newUnit × newQuantity (kobo). */
  newAmountKobo: Kobo;
  periodStart: Date;
  periodEnd: Date;
  changeAt: Date;
  status: SubscriptionStatus;
  prorationBehavior: ProrationBehavior;
}
