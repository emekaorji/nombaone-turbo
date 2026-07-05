import { and, eq } from 'drizzle-orm';

import { settlementsTable, type SettlementRow } from '@nombaone/core-db/schema';

import { ensureSystemAccounts } from '@nombaone/sara/config';
import { emitEvent } from '@nombaone/sara/events';
import { ensureAccount, postTransaction } from '@nombaone/sara/ledger';
import { mintReference } from '@nombaone/sara/reference';
import { resolveTenantSubAccount } from './accounts';
import { resolvePlatformFee } from './fees';
import { assertSplitBalances } from './split';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';

export interface RecordSettlementInput {
  invoiceId: string;
  customerId: string;
  merchantTxRef: string; // the per-collection idempotency key (the invoice reference)
  grossKobo: number;
  splitReference?: string | null;
}

export interface RecordSettlementResult {
  settlement: SettlementRow;
  alreadyRecorded: boolean;
}

/**
 * Record the settlement of a VERIFIED collection (H5 ★ / J5 / K2). In one tx:
 * resolve fee + net, `assertSplitBalances`, CLAIM the `settlements` row
 * (`onConflictDoNothing` on the unique `merchant_tx_ref`), then — only the claim
 * winner — post ONE balanced double-entry that reclassifies the provisional
 * gross platform revenue into the platform fee (`platform_fees`) + the tenant share
 * (`tenant_settlement:{ref}` liability), link it, and emit `settlement.created`.
 * Idempotent: a replay finds the existing row and posts nothing (no double ledger).
 */
export async function recordSettlement(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: RecordSettlementInput
): Promise<RecordSettlementResult> {
  const sub = await resolveTenantSubAccount(txDb, ctx);
  const platformFeeKobo = await resolvePlatformFee(txDb, ctx, input.grossKobo);
  const netToTenantKobo = input.grossKobo - platformFeeKobo;
  assertSplitBalances({ grossKobo: input.grossKobo, platformFeeKobo, netToTenantKobo });

  const [claimed] = await txDb
    .insert(settlementsTable)
    .values({
      reference: mintReference('STL'),
      organizationId: ctx.organizationId,
      mode: ctx.mode,
      invoiceId: input.invoiceId,
      customerId: input.customerId,
      subAccountRef: sub.accountRef,
      splitReference: input.splitReference ?? null,
      merchantTxRef: input.merchantTxRef,
      grossKobo: input.grossKobo,
      platformFeeKobo,
      netToTenantKobo,
      status: 'settled',
    })
    .onConflictDoNothing({ target: settlementsTable.merchantTxRef })
    .returning();

  if (!claimed) {
    const [existing] = await txDb
      .select()
      .from(settlementsTable)
      .where(
        and(
          eq(settlementsTable.organizationId, ctx.organizationId),
          eq(settlementsTable.merchantTxRef, input.merchantTxRef)
        )
      )
      .limit(1);
    return { settlement: existing!, alreadyRecorded: true };
  }

  await ensureSystemAccounts(txDb, ctx);
  const platformRevenue = await ensureAccount(txDb, ctx, { key: 'platform_revenue', kind: 'revenue' });
  const platformFees = await ensureAccount(txDb, ctx, { key: 'platform_fees', kind: 'revenue' });
  const tenantSettlement = await ensureAccount(txDb, ctx, {
    key: `tenant_settlement:${sub.accountRef}`,
    kind: 'liability',
  });

  // Reclassify the provisional full-gross revenue (posted by the charge) into the
  // platform fee + the tenant's settled share. Zero-amount legs are dropped so a
  // fee-only or share-only split still balances.
  const entries = [
    { accountId: platformRevenue.id, direction: 'debit' as const, amount: input.grossKobo },
    { accountId: platformFees.id, direction: 'credit' as const, amount: platformFeeKobo },
    { accountId: tenantSettlement.id, direction: 'credit' as const, amount: netToTenantKobo },
  ].filter((e) => e.amount > 0);

  const posted = await postTransaction(txDb, ctx, {
    kind: 'settlement',
    memo: `settlement ${claimed.reference}`,
    entries,
  });

  const [linked] = await txDb
    .update(settlementsTable)
    .set({ ledgerTransactionId: posted.transactionId })
    .where(eq(settlementsTable.id, claimed.id))
    .returning();

  await emitEvent(txDb, {
    ...ctx,
    type: 'settlement.created',
    payload: { reference: claimed.reference },
  });

  return { settlement: linked ?? claimed, alreadyRecorded: false };
}
