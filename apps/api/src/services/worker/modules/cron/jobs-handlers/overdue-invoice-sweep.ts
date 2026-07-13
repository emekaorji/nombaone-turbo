import { and, eq, inArray, isNotNull, isNull, lte } from 'drizzle-orm';

import { invoicesTable, subscriptionsTable } from '@nombaone/core-db/schema';

import { loadSubscriptionRowById } from '@shared/services/billing';
import { scheduleFirstAttempt } from '@shared/services/dunning';
import { enterPastDue } from '@shared/services/subscriptions';
import { db } from '@shared/config/db';
import { env } from '@shared/config/env';
import { logger } from '@shared/observability/logger';

import type { DomainContext, Mode } from '@nombaone/sara/context';

export interface OverdueInvoiceSweepResult {
  scanned: number;
  entered: number;
}

/**
 * The PUSH-rail overdue sweep — the missing half of `send_invoice` billing.
 * Before it existed, an unpaid invoice on a send_invoice subscription simply sat
 * `open` forever: never `past_due`, never dunned, never churned, while service
 * kept accruing. This tick finds finalized, unpaid, non-terminal invoices whose
 * `due_date` has passed on an ACTIVE send_invoice/method-less sub, moves the sub
 * `past_due`, and starts `payment_reminder` dunning (reason `invoice_overdue`) —
 * the branch that re-sends the payment link on the cadence-aware ladder and
 * churns on exhaustion. Idempotent: `enterPastDue` is a legal-edge no-op on an
 * already-past_due sub, and attempt #1 is unique per invoice.
 */
export async function handleOverdueInvoiceSweep(): Promise<OverdueInvoiceSweepResult> {
  let scanned = 0;
  let entered = 0;

  for (const mode of ['sandbox', 'live'] as Mode[]) {
    const overdue = await db
      .select({
        id: invoicesTable.id,
        reference: invoicesTable.reference,
        organizationId: invoicesTable.organizationId,
        subscriptionId: invoicesTable.subscriptionId,
        customerId: invoicesTable.customerId,
        amountDue: invoicesTable.amountDue,
        amountPaid: invoicesTable.amountPaid,
        amountRemaining: invoicesTable.amountRemaining,
        attemptCount: invoicesTable.attemptCount,
        billingReason: invoicesTable.billingReason,
        currency: invoicesTable.currency,
        creditTotal: invoicesTable.creditTotal,
        discountTotal: invoicesTable.discountTotal,
        subtotal: invoicesTable.subtotal,
        total: invoicesTable.total,
        dueDate: invoicesTable.dueDate,
        periodIndex: invoicesTable.periodIndex,
        periodStart: invoicesTable.periodStart,
        periodEnd: invoicesTable.periodEnd,
        finalizedAt: invoicesTable.finalizedAt,
        paidAt: invoicesTable.paidAt,
        voidedAt: invoicesTable.voidedAt,
        uncollectibleAt: invoicesTable.uncollectibleAt,
        lastFailureReason: invoicesTable.lastFailureReason,
        lastGatewayMessage: invoicesTable.lastGatewayMessage,
        ledgerTransactionId: invoicesTable.ledgerTransactionId,
        metadata: invoicesTable.metadata,
        mode: invoicesTable.mode,
        createdAt: invoicesTable.createdAt,
        updatedAt: invoicesTable.updatedAt,
        subStatus: subscriptionsTable.status,
        subCollectionMethod: subscriptionsTable.collectionMethod,
      })
      .from(invoicesTable)
      .innerJoin(subscriptionsTable, eq(subscriptionsTable.id, invoicesTable.subscriptionId))
      .where(
        and(
          eq(invoicesTable.mode, mode),
          isNotNull(invoicesTable.finalizedAt),
          isNull(invoicesTable.paidAt),
          isNull(invoicesTable.voidedAt),
          isNull(invoicesTable.uncollectibleAt),
          isNotNull(invoicesTable.dueDate),
          lte(invoicesTable.dueDate, new Date()),
          eq(subscriptionsTable.collectionMethod, 'send_invoice'),
          inArray(subscriptionsTable.status, ['active', 'past_due'])
        )
      )
      .limit(env.BILLING_BATCH_SIZE);

    for (const row of overdue) {
      scanned += 1;
      if (!row.subscriptionId) continue;
      const ctx: DomainContext = { organizationId: row.organizationId, mode };
      try {
        let sub = await loadSubscriptionRowById(db, ctx, row.subscriptionId);
        if (sub.status === 'active') {
          sub = await enterPastDue(db, ctx, sub);
        }
        const { subStatus, subCollectionMethod, ...invoice } = row;
        void subStatus;
        void subCollectionMethod;
        const attempt = await scheduleFirstAttempt(db, ctx, {
          subscription: sub,
          invoice,
          reason: 'invoice_overdue',
        });
        if (attempt && attempt.attemptNumber === 1) entered += 1;
      } catch (error) {
        logger.warn('[cron] overdue-invoice-sweep failed for invoice', {
          mode,
          invoice: row.reference,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  if (entered > 0) logger.info('[cron] overdue-invoice-sweep ran', { scanned, entered });
  return { scanned, entered };
}
