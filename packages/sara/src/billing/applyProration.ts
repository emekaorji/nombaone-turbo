
import { grantCredit } from '../credits';
import { createInvoice, finalizeInvoiceWithAdjustments } from '../invoices';
import {
  buildIntervalSwitchLines,
  buildProrationLines,
  prorationNet,
  type ProrationBehavior,
  type ProrationLine,
} from '../proration';
import { collectForInvoice } from './collectForInvoice';
import { resolveCollectionMethod } from './effects';

import type { SubscriptionRow } from '@nombaone/core-db/schema';
import type { DomainContext, InfraTxDb } from '../context';

export interface ApplyProrationInput {
  subscription: SubscriptionRow;
  customerRef: string;
  /** old effective period amount = oldUnit × oldQty (kobo). */
  oldAmountKobo: number;
  /** new effective period amount = newUnit × newQty (kobo). */
  newAmountKobo: number;
  changeAt: Date;
  prorationBehavior: ProrationBehavior;
}

export interface ApplyProrationResult {
  lines: ProrationLine[];
  /** the immediate proration invoice (upgrade — net positive). */
  prorationInvoiceRef?: string;
  /** the banked credit grant (downgrade — net negative, C2). */
  creditGrantRef?: string;
}

/**
 * Apply a mid-cycle change's proration (C1/C2/C7). Builds the signed proration
 * lines; NET POSITIVE (upgrade) → an immediate `subscription_update` invoice,
 * finalized with adjustments (discount/credit/J8) and charged now (C1); NET
 * NEGATIVE (downgrade) → the surplus is BANKED as a `downgrade_proration` credit
 * grant applied to a future invoice, NOT refunded to rail (C2). Returns no
 * invoice/grant during a trial or with `prorationBehavior: 'none'` (C6).
 */
export async function applyProration(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: ApplyProrationInput
): Promise<ApplyProrationResult> {
  const sub = input.subscription;
  if (!sub.currentPeriodStart || !sub.currentPeriodEnd) return { lines: [] };

  const lines = buildProrationLines({
    oldAmountKobo: input.oldAmountKobo,
    newAmountKobo: input.newAmountKobo,
    periodStart: sub.currentPeriodStart,
    periodEnd: sub.currentPeriodEnd,
    changeAt: input.changeAt,
    status: sub.status,
    prorationBehavior: input.prorationBehavior,
  });
  if (lines.length === 0) return { lines: [] };

  const net = prorationNet(lines);

  if (net > 0) {
    const invoice = await createInvoice(txDb, ctx, {
      customerId: sub.customerId,
      subscriptionId: sub.id,
      billingReason: 'subscription_update',
      periodStart: input.changeAt,
      periodEnd: sub.currentPeriodEnd,
      lines: lines.map((l) => ({
        kind: 'proration' as const,
        description: l.description,
        amount: l.amount,
        periodStart: l.periodStart,
        periodEnd: l.periodEnd,
      })),
    });
    const result = await finalizeInvoiceWithAdjustments(txDb, ctx, invoice.reference);
    if (!result.paid && result.amountDue > 0) {
      const method = await resolveCollectionMethod(txDb, ctx, sub);
      if (method) await collectForInvoice(txDb, ctx, result.invoice, method);
    }
    return { lines, prorationInvoiceRef: invoice.reference };
  }

  if (net < 0) {
    const grant = await grantCredit(txDb, ctx, {
      customerRef: input.customerRef,
      amount: -net,
      source: 'downgrade_proration',
      sourceReference: sub.reference,
    });
    return { lines, creditGrantRef: grant.id };
  }

  return { lines };
}

export interface ApplyIntervalSwitchInput {
  /** the PRE-switch subscription row (its current period is the old-cadence window). */
  subscription: SubscriptionRow;
  customerRef: string;
  oldAmountKobo: number;
  newAmountKobo: number;
  /** the fresh new-cadence period end (from `reanchorForIntervalSwitch`). */
  newPeriodEnd: Date;
  changeAt: Date;
  prorationBehavior: ProrationBehavior;
}

/**
 * Apply an interval switch's money (C4): credit the unused old-cadence remainder +
 * charge a FULL fresh new-cadence period. Same net+/net− shape as `applyProration`
 * (net positive → immediate `subscription_update` invoice charged now; net negative
 * → a `downgrade_proration` credit grant). The caller re-anchors the cycle fields.
 */
export async function applyIntervalSwitch(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: ApplyIntervalSwitchInput
): Promise<ApplyProrationResult> {
  const sub = input.subscription;
  if (!sub.currentPeriodStart || !sub.currentPeriodEnd) return { lines: [] };

  const lines = buildIntervalSwitchLines({
    oldAmountKobo: input.oldAmountKobo,
    newAmountKobo: input.newAmountKobo,
    oldPeriodStart: sub.currentPeriodStart,
    oldPeriodEnd: sub.currentPeriodEnd,
    newPeriodEnd: input.newPeriodEnd,
    changeAt: input.changeAt,
    status: sub.status,
    prorationBehavior: input.prorationBehavior,
  });
  if (lines.length === 0) return { lines: [] };

  const net = prorationNet(lines);

  if (net > 0) {
    const invoice = await createInvoice(txDb, ctx, {
      customerId: sub.customerId,
      subscriptionId: sub.id,
      billingReason: 'subscription_update',
      periodStart: input.changeAt,
      periodEnd: input.newPeriodEnd,
      lines: lines.map((l) => ({
        kind: 'proration' as const,
        description: l.description,
        amount: l.amount,
        periodStart: l.periodStart,
        periodEnd: l.periodEnd,
      })),
    });
    const result = await finalizeInvoiceWithAdjustments(txDb, ctx, invoice.reference);
    if (!result.paid && result.amountDue > 0) {
      const method = await resolveCollectionMethod(txDb, ctx, sub);
      if (method) await collectForInvoice(txDb, ctx, result.invoice, method);
    }
    return { lines, prorationInvoiceRef: invoice.reference };
  }

  if (net < 0) {
    const grant = await grantCredit(txDb, ctx, {
      customerRef: input.customerRef,
      amount: -net,
      source: 'downgrade_proration',
      sourceReference: sub.reference,
    });
    return { lines, creditGrantRef: grant.id };
  }

  return { lines };
}
