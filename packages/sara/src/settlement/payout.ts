import { eq } from 'drizzle-orm';

import { ledgerAccountsTable, payoutsTable, type PayoutRow } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '../events';
import { ensureAccount, postTransaction } from '../ledger';
import { koboToNombaAmount, NOMBA_ENDPOINTS, type NombaClient } from '../nomba';
import { getOrgBillingSettings } from '../org';
import { mintReference } from '../reference';
import { getTenantSettlementBalance, resolveTenantSubAccount, tenantSettlementAccountKey } from './accounts';
import { computeTenantEscrow } from './escrow';
import { serializePayout } from './serialize';

import type { DomainContext, InfraTxDb } from '../context';
import type { PayoutResponseData } from '@nombaone/core-contracts/types';

export interface PayoutInput {
  amountKobo: number;
  bank: { code: string; accountNumber: string };
  merchantTxRef: string;
  client: NombaClient;
  /**
   * Provider-transfer flag (env `NOMBA_PAYOUT_ENABLED`). OFF ⇒ ledger-only: we post
   * the debit + record the payout as `ledger_posted` but DO NOT call the ⚠UNCONFIRMED
   * `bankTransfer`. Flip on only after a live bankTransfer confirmation.
   */
  payoutEnabled?: boolean;
}

/**
 * Tenant-level withdrawal of settled funds to the tenant's bank (F2). `available =
 * balance − lockedLast3h − minBuffer`; a `FOR UPDATE` lock on the `tenant_settlement`
 * account row (held for the transaction) serializes concurrent payouts (overdraw
 * guard) and `unique(merchant_tx_ref)` makes it idempotent. The ledger debit posts
 * first (funds leave our books once); the provider `bankTransfer` is flag-gated and,
 * on failure, compensated by a reversing entry so tenant funds are never stranded and
 * success is never faked.
 */
export async function payoutToTenant(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: PayoutInput
): Promise<PayoutResponseData> {
  const sub = await resolveTenantSubAccount(txDb, ctx);

  const outcome = await txDb.transaction(async (tx) => {
    const tenantAccount = await ensureAccount(tx, ctx, {
      key: tenantSettlementAccountKey(sub.accountRef),
      kind: 'liability',
    });
    // Lock the tenant_settlement account row → concurrent payouts serialize (overdraw guard).
    await tx
      .select({ id: ledgerAccountsTable.id })
      .from(ledgerAccountsTable)
      .where(eq(ledgerAccountsTable.id, tenantAccount.id))
      .limit(1)
      .for('update');

    const balance = await getTenantSettlementBalance(tx, ctx);
    const { lockedKobo } = await computeTenantEscrow(tx, ctx);
    const minBuffer = (await getOrgBillingSettings(tx, ctx)).minWithdrawableKobo ?? 0;
    const available = Math.max(0, balance - lockedKobo - minBuffer);

    if (input.amountKobo <= 0) {
      throw AppError.UnprocessableEntity(
        'payout amount must be positive',
        { amountKobo: input.amountKobo },
        NOMBAONE_ERROR_CODES.PAYOUT_EXCEEDS_AVAILABLE
      );
    }
    // Prefer the precise ESCROW_LOCKED code when the shortfall is specifically the lock.
    if (balance - input.amountKobo < lockedKobo) {
      throw AppError.UnprocessableEntity(
        'requested amount is within the rolling escrow lock window',
        { balance, lockedKobo },
        NOMBAONE_ERROR_CODES.ESCROW_LOCKED
      );
    }
    if (input.amountKobo > available) {
      throw AppError.UnprocessableEntity(
        'payout exceeds the available balance',
        { available },
        NOMBAONE_ERROR_CODES.PAYOUT_EXCEEDS_AVAILABLE
      );
    }

    // Durable idempotency: claim the payout row first.
    const [claimed] = await tx
      .insert(payoutsTable)
      .values({
        reference: mintReference('PAY'),
        organizationId: ctx.organizationId,
        mode: ctx.mode,
        subAccountRef: sub.accountRef,
        amountKobo: input.amountKobo,
        bankCode: input.bank.code,
        accountNumber: input.bank.accountNumber,
        merchantTxRef: input.merchantTxRef,
        status: 'pending',
      })
      .onConflictDoNothing({ target: payoutsTable.merchantTxRef })
      .returning();
    if (!claimed) {
      const [existing] = await tx
        .select()
        .from(payoutsTable)
        .where(eq(payoutsTable.merchantTxRef, input.merchantTxRef))
        .limit(1);
      if (!existing) {
        throw AppError.InternalServerError(
          'payout claim lost but no existing row',
          { merchantTxRef: input.merchantTxRef },
          NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
        );
      }
      return { row: existing, fresh: false };
    }

    // Resolve the beneficiary (confirmed-live bankLookup).
    const lookup = await input.client.request<{ data?: { accountName?: string } }>({
      method: 'GET',
      endpoint: NOMBA_ENDPOINTS.bankLookup,
      query: { bankCode: input.bank.code, accountNumber: input.bank.accountNumber },
      idempotencyRef: input.merchantTxRef,
    });
    if (!lookup.ok) {
      await tx
        .update(payoutsTable)
        .set({ status: 'failed', failureReason: 'bank_lookup_failed' })
        .where(eq(payoutsTable.id, claimed.id));
      throw AppError.ServiceUnavailable(
        'bank account lookup failed',
        { reference: claimed.reference },
        NOMBAONE_ERROR_CODES.SETTLEMENT_PAYOUT_FAILED
      );
    }
    const resolvedAccountName = String(lookup.data?.data?.accountName ?? '') || null;

    // Post the ledger debit (funds leave tenant_settlement → tenant_payout), guarded by the claim.
    const payoutAccount = await ensureAccount(tx, ctx, { key: 'tenant_payout', kind: 'system' });
    const posted = await postTransaction(tx, ctx, {
      kind: 'adjustment',
      memo: `payout ${claimed.reference}`,
      entries: [
        { accountId: tenantAccount.id, direction: 'debit', amount: input.amountKobo },
        { accountId: payoutAccount.id, direction: 'credit', amount: input.amountKobo },
      ],
    });
    await tx
      .update(payoutsTable)
      .set({ status: 'ledger_posted', resolvedAccountName, ledgerTransactionId: posted.transactionId })
      .where(eq(payoutsTable.id, claimed.id));

    // Provider transfer — GUARDED (bankTransfer ⚠ unconfirmed). Off ⇒ stays ledger_posted.
    let finalStatus: 'ledger_posted' | 'succeeded' | 'failed' = 'ledger_posted';
    let providerReference: string | null = null;
    let failureReason: string | null = null;
    if (input.payoutEnabled) {
      const transfer = await input.client.request<{ data?: { id?: string; reference?: string } }>({
        method: 'POST',
        endpoint: NOMBA_ENDPOINTS.bankTransfer,
        idempotencyRef: input.merchantTxRef,
        body: {
          amount: koboToNombaAmount(input.amountKobo),
          bankCode: input.bank.code,
          accountNumber: input.bank.accountNumber,
          accountName: resolvedAccountName ?? undefined,
          merchantReference: claimed.reference,
          currency: 'NGN',
        },
      });
      if (transfer.ok) {
        finalStatus = 'succeeded';
        providerReference =
          String(transfer.data?.data?.id ?? transfer.data?.data?.reference ?? '') || null;
      } else {
        // Compensating reversal — a failed transfer must not strand tenant funds.
        await postTransaction(tx, ctx, {
          kind: 'adjustment',
          memo: `payout reversal ${claimed.reference} (transfer failed)`,
          entries: [
            { accountId: payoutAccount.id, direction: 'debit', amount: input.amountKobo },
            { accountId: tenantAccount.id, direction: 'credit', amount: input.amountKobo },
          ],
        });
        finalStatus = 'failed';
        failureReason = 'bank_transfer_failed';
      }
    }

    const [final] = await tx
      .update(payoutsTable)
      .set({ status: finalStatus, providerReference, failureReason })
      .where(eq(payoutsTable.id, claimed.id))
      .returning();
    return { row: (final ?? claimed) as PayoutRow, fresh: true };
  });

  if (outcome.fresh) {
    await emitEvent(txDb, {
      ...ctx,
      type: 'settlement.payout_created',
      payload: { reference: outcome.row.reference },
    });
  }
  return serializePayout(outcome.row);
}
