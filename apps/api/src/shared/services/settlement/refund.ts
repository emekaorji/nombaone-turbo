import { and, eq, inArray, sql } from 'drizzle-orm';

import { refundsTable, settlementsTable, type RefundRow } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { emitEvent } from '@nombaone/sara/events';
import { ensureAccount, postTransaction } from '@nombaone/sara/ledger';
import { mintReference } from '@nombaone/sara/reference';

import { tenantSettlementAccountKey } from './accounts';
import { serializeRefund } from './serialize';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';
import type { RefundResponseData } from '@nombaone/core-contracts/types';

/**
 * Refund a settlement's TENANT share (F3) — reverse ONLY the tenant leg, never the
 * platform fee (the fee is earned at collection and non-refundable). A `FOR UPDATE`
 * lock on the settlement row (held for the transaction) serializes concurrent refunds
 * so different-key requests can't over-refund; the `unique(merchant_tx_ref)` claim
 * gives durable same-key idempotency (a replay returns the existing refund, posts
 * nothing). The reversal debits `tenant_settlement` + credits `platform_revenue`
 * (books stay balanced, `platform_fees` untouched). Supports repeated PARTIAL refunds
 * up to `net_to_tenant`. The real money return to the end-user is a separate,
 * provider-guarded step (the row stays `ledger_only`, `provider_reference` null).
 */
export async function refundSettlement(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: { reference: string; amountKobo?: number; merchantTxRef: string }
): Promise<RefundResponseData> {
  const outcome = await txDb.transaction(async (tx) => {
    // Lock the settlement row → concurrent refunds serialize here (over-refund guard).
    const [settlement] = await tx
      .select()
      .from(settlementsTable)
      .where(
        and(
          eq(settlementsTable.organizationId, ctx.organizationId),
          eq(settlementsTable.mode, ctx.mode),
          eq(settlementsTable.reference, input.reference)
        )
      )
      .limit(1)
      .for('update');
    if (!settlement) {
      throw AppError.NotFound(
        'settlement not found',
        { reference: input.reference },
        NOMBAONE_ERROR_CODES.SETTLEMENT_NOT_FOUND
      );
    }

    const [agg] = await tx
      .select({ total: sql<number>`coalesce(sum(${refundsTable.amountKobo}), 0)` })
      .from(refundsTable)
      .where(
        and(
          eq(refundsTable.settlementId, settlement.id),
          inArray(refundsTable.status, ['ledger_only', 'succeeded', 'pending'])
        )
      );
    const alreadyRefunded = Number(agg?.total ?? 0);
    const remaining = settlement.netToTenantKobo - alreadyRefunded;
    const refundKobo = input.amountKobo ?? remaining;

    if (remaining <= 0 || refundKobo <= 0) {
      throw AppError.UnprocessableEntity(
        'settlement tenant share is already fully refunded',
        { reference: input.reference },
        NOMBAONE_ERROR_CODES.REFUND_ALREADY_REFUNDED
      );
    }
    if (refundKobo > remaining) {
      throw AppError.UnprocessableEntity(
        'refund exceeds the refundable tenant share',
        { reference: input.reference, remaining },
        NOMBAONE_ERROR_CODES.REFUND_AMOUNT_EXCEEDS_NET
      );
    }

    // Durable idempotency: claim the refunds row first.
    const [claimed] = await tx
      .insert(refundsTable)
      .values({
        reference: mintReference('REF'),
        organizationId: ctx.organizationId,
        mode: ctx.mode,
        settlementId: settlement.id,
        subAccountRef: settlement.subAccountRef,
        amountKobo: refundKobo,
        merchantTxRef: input.merchantTxRef,
        status: 'ledger_only',
      })
      .onConflictDoNothing({ target: refundsTable.merchantTxRef })
      .returning();
    if (!claimed) {
      // Replay of the same idempotency key — return the existing refund, no reversal.
      const [existing] = await tx
        .select()
        .from(refundsTable)
        .where(eq(refundsTable.merchantTxRef, input.merchantTxRef))
        .limit(1);
      if (!existing) {
        throw AppError.InternalServerError(
          'refund claim lost but no existing row',
          { merchantTxRef: input.merchantTxRef },
          NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
        );
      }
      return { row: existing, settlementReference: settlement.reference, fresh: false };
    }

    // Reverse ONLY the tenant leg (fee non-refundable → platform_fees untouched).
    const tenantAccount = await ensureAccount(tx, ctx, {
      key: tenantSettlementAccountKey(settlement.subAccountRef),
      kind: 'liability',
    });
    const revenue = await ensureAccount(tx, ctx, { key: 'platform_revenue', kind: 'revenue' });
    const posted = await postTransaction(tx, ctx, {
      kind: 'reversal',
      memo: `refund ${claimed.reference} (settlement ${settlement.reference})`,
      entries: [
        { accountId: tenantAccount.id, direction: 'debit', amount: refundKobo },
        { accountId: revenue.id, direction: 'credit', amount: refundKobo },
      ],
    });
    const [linked] = await tx
      .update(refundsTable)
      .set({ ledgerTransactionId: posted.transactionId })
      .where(eq(refundsTable.id, claimed.id))
      .returning();

    // Coarse flag: flip the settlement to `refunded` once cumulative == net.
    if (alreadyRefunded + refundKobo >= settlement.netToTenantKobo) {
      await tx
        .update(settlementsTable)
        .set({ status: 'refunded' })
        .where(eq(settlementsTable.id, settlement.id));
    }

    return { row: (linked ?? claimed) as RefundRow, settlementReference: settlement.reference, fresh: true };
  });

  // Events fan out on the pool AFTER the tx commits (emitEvent takes the pool handle).
  if (outcome.fresh) {
    await emitEvent(txDb, {
      ...ctx,
      type: 'settlement.refunded',
      payload: { reference: outcome.settlementReference },
    });
  }
  return serializeRefund(outcome.row, outcome.settlementReference);
}
