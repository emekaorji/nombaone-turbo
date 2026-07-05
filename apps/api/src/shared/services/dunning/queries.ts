import { and, asc, desc, eq, isNull, isNotNull, lte } from 'drizzle-orm';

import {
  dunningAttemptsTable,
  invoicesTable,
  subscriptionsTable,
  type DunningAttemptRow,
  type InvoiceRow,
  type SubscriptionRow,
} from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { resolveBillingSettings } from './policy';
import { graceAccessUntil } from './schedule';
import { serializeDunningAttempt } from './serialize';

import type { DunningStateResponseData, Mode } from '@nombaone/core-contracts/types';
import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';

export interface PastDueNeedingDunning {
  invoice: InvoiceRow;
  subscription: SubscriptionRow;
}

/**
 * DETECT (cross-tenant operational read): `past_due` subscriptions whose open,
 * finalized invoice has NO dunning attempt yet — the sweep starts dunning for each.
 * A left join + `dunning.id IS NULL` selects exactly the not-yet-dunned invoices.
 */
export async function selectPastDueNeedingDunning(
  db: InfraTxDb,
  mode: Mode,
  limit: number
): Promise<PastDueNeedingDunning[]> {
  const rows = await db
    .select({ invoice: invoicesTable, subscription: subscriptionsTable })
    .from(invoicesTable)
    .innerJoin(subscriptionsTable, eq(subscriptionsTable.id, invoicesTable.subscriptionId))
    .leftJoin(dunningAttemptsTable, eq(dunningAttemptsTable.invoiceId, invoicesTable.id))
    .where(
      and(
        eq(invoicesTable.mode, mode),
        eq(subscriptionsTable.status, 'past_due'),
        isNotNull(invoicesTable.finalizedAt),
        isNull(invoicesTable.paidAt),
        isNull(invoicesTable.voidedAt),
        isNull(invoicesTable.uncollectibleAt),
        isNull(dunningAttemptsTable.id)
      )
    )
    .limit(limit);
  return rows;
}

/**
 * EXECUTE: due `scheduled` attempts (`next_attempt_at ≤ now`). Uses the partial
 * `WHERE status = 'scheduled'` index — cross-tenant, oldest-due first.
 */
export async function selectDueDunningAttempts(
  db: InfraTxDb,
  mode: Mode,
  now: Date,
  limit: number
): Promise<DunningAttemptRow[]> {
  return db
    .select()
    .from(dunningAttemptsTable)
    .where(
      and(
        eq(dunningAttemptsTable.mode, mode),
        eq(dunningAttemptsTable.status, 'scheduled'),
        lte(dunningAttemptsTable.nextAttemptAt, now)
      )
    )
    .orderBy(asc(dunningAttemptsTable.nextAttemptAt))
    .limit(limit);
}

/** All dunning attempts for an invoice, in attempt order (audit — D11). */
export async function listDunningAttemptsForInvoice(
  db: InfraTxDb,
  ctx: DomainContext,
  invoiceId: string
): Promise<DunningAttemptRow[]> {
  return db
    .select()
    .from(dunningAttemptsTable)
    .where(
      and(
        eq(dunningAttemptsTable.organizationId, ctx.organizationId),
        eq(dunningAttemptsTable.mode, ctx.mode),
        eq(dunningAttemptsTable.invoiceId, invoiceId)
      )
    )
    .orderBy(asc(dunningAttemptsTable.attemptNumber));
}

async function loadSubscriptionByRef(
  db: InfraTxDb,
  ctx: DomainContext,
  reference: string
): Promise<SubscriptionRow> {
  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(
      and(
        eq(subscriptionsTable.organizationId, ctx.organizationId),
        eq(subscriptionsTable.mode, ctx.mode),
        eq(subscriptionsTable.reference, reference)
      )
    )
    .limit(1);
  if (!sub) {
    throw AppError.NotFound(
      'subscription not found',
      { reference },
      NOMBAONE_ERROR_CODES.SUBSCRIPTION_NOT_FOUND
    );
  }
  return sub;
}

/** The subscription's current open/most-recent invoice under dunning. */
async function loadDunnableInvoice(
  db: InfraTxDb,
  ctx: DomainContext,
  subscriptionId: string
): Promise<InvoiceRow | null> {
  const [inv] = await db
    .select()
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.organizationId, ctx.organizationId),
        eq(invoicesTable.mode, ctx.mode),
        eq(invoicesTable.subscriptionId, subscriptionId),
        isNull(invoicesTable.paidAt),
        isNull(invoicesTable.voidedAt)
      )
    )
    .orderBy(desc(invoicesTable.periodIndex))
    .limit(1);
  return inv ?? null;
}

/** Roll up the dunning view for a subscription + its open invoice (D11 inspect). */
export async function getDunningStateBySubscriptionRef(
  db: InfraTxDb,
  ctx: DomainContext,
  reference: string
): Promise<{ subscription: SubscriptionRow; invoice: InvoiceRow | null; attempts: DunningAttemptRow[] }> {
  const subscription = await loadSubscriptionByRef(db, ctx, reference);
  const invoice = await loadDunnableInvoice(db, ctx, subscription.id);
  const attempts = invoice ? await listDunningAttemptsForInvoice(db, ctx, invoice.id) : [];
  return { subscription, invoice, attempts };
}

/** Compute the DTO-facing dunning state (grace anchor = first attempt). */
export async function buildDunningState(
  db: InfraTxDb,
  ctx: DomainContext,
  reference: string
): Promise<DunningStateResponseData> {
  const { subscription, invoice, attempts } = await getDunningStateBySubscriptionRef(db, ctx, reference);
  const policy = await resolveBillingSettings(db, ctx);
  const latest = attempts[attempts.length - 1];
  const firstFailedAt = attempts[0]?.createdAt ?? null;

  return {
    domain: 'dunning_state',
    subscriptionRef: subscription.reference,
    invoiceRef: invoice?.reference ?? null,
    status: latest?.status ?? 'none',
    attemptsUsed: attempts.length,
    maxAttempts: policy.dunningMaxAttempts,
    nextAttemptAt: latest?.nextAttemptAt?.toISOString() ?? null,
    graceAccessUntil: firstFailedAt ? graceAccessUntil(firstFailedAt, policy).toISOString() : null,
    attempts: attempts.map(serializeDunningAttempt),
  };
}
