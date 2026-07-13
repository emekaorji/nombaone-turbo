import { and, eq } from 'drizzle-orm';

import { ledgerAccountsTable, payoutsTable, type PayoutRow } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { emitEvent } from '@nombaone/sara/events';
import { ensureAccount, postTransaction } from '@nombaone/sara/ledger';
import { koboToNombaAmount, NOMBA_ENDPOINTS, type NombaClient } from '@nombaone/sara/nomba';
import { getOrgBillingSettings } from '@nombaone/sara/org';
import { mintReference } from '@nombaone/sara/reference';

import { logger } from '@shared/observability/logger';

import {
  assertBalanceMatchesLedger,
  getTenantSettlementBalance,
  resolveTenantAccountRef,
  tenantSettlementAccountKey,
} from './accounts';
import { computeTenantEscrow } from './escrow';
import { requirePayoutAccount, resolveAccountName } from './payoutAccounts';
import { serializePayout } from './serialize';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';
import type { PayoutResponseData } from '@nombaone/core-contracts/types';

export interface PayoutInput {
  amountKobo: number;
  /**
   * The idempotency key — BOTH ours and Nomba's. The daily sweep uses a deterministic
   * one (`SWP:{orgRef}:{mode}:{lagosDate}`) so a replayed tick can't pay twice; a manual
   * withdrawal uses the request's `Idempotency-Key`.
   */
  merchantTxRef: string;
  client: NombaClient;
  /**
   * Provider-transfer flag (`NOMBA_PAYOUT_ENABLED`). OFF ⇒ ledger-only: we post the
   * debit and record `ledger_posted`, but send nothing. The money is still correctly
   * accounted for; it just hasn't left yet.
   */
  payoutEnabled?: boolean;
}

/**
 * WITHDRAWAL — the merchant's money leaves us.
 *
 * The destination is NOT a parameter. It is read from `org_payout_accounts`, whose
 * `account_name` came from the bank (name enquiry), not from anyone's keyboard. A
 * caller cannot name a destination, so an API key cannot be used to push a merchant's
 * balance to an attacker's NUBAN.
 *
 * ── The transaction boundary is the whole design ────────────────────────────────
 * This used to run `claim → HTTP lookup → ledger debit → HTTP transfer` inside ONE
 * database transaction. A crash (or a timeout, or a redeploy) after Nomba accepted the
 * transfer but before COMMIT rolled back the claim AND the debit — while the money was
 * already on its way. The merchant would receive the naira and keep the balance, and
 * nothing in our system would remember it had happened. It also held a `FOR UPDATE`
 * lock across two network round-trips.
 *
 * So the money moves in three separate steps, and the durable record always precedes
 * the irreversible act:
 *
 *   TX 1  lock the tenant's ledger row → re-derive `available` UNDER the lock → claim
 *         the `payouts` row (`unique(merchant_tx_ref)`) → post the ledger debit →
 *         COMMIT as `ledger_posted`.
 *   HTTP  send the transfer. No transaction is open. If we die here, the payout is
 *         durably `ledger_posted` — the funds are already debited, so nothing can be
 *         double-spent, and the reaper/webhook resolves it.
 *   TX 2  record the outcome under a CAS (`WHERE status = 'ledger_posted'`), so the
 *         webhook, a retry and the reaper cannot each apply it.
 *
 * `ledger_posted` is the honest intermediate state: "the merchant's balance is gone,
 * the bank leg is unconfirmed". It is never a lie in either direction.
 */
export async function payoutToTenant(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: PayoutInput
): Promise<PayoutResponseData> {
  const accountRef = await resolveTenantAccountRef(txDb, ctx);

  // The destination — bank-verified at the time it was added. Throws
  // PAYOUT_ACCOUNT_MISSING if the merchant hasn't added one, which is the first (and
  // only) moment we ask them for a bank account.
  const destination = await requirePayoutAccount(txDb, ctx);

  // ── TX 1 ─ durably commit the debit before anything irreversible happens.
  const claim = await txDb.transaction(async (tx) => {
    const tenantAccount = await ensureAccount(tx, ctx, {
      key: tenantSettlementAccountKey(accountRef),
      kind: 'liability',
    });

    // Serialize concurrent withdrawals (a "Pay me now" racing the daily sweep) on the
    // tenant's ledger row. `available` is re-derived INSIDE the lock, so the loser sees
    // the winner's debit and cannot overdraw. The DB CHECK on
    // `tenant_settlement:%` balance is the structural backstop beneath this.
    await tx
      .select({ id: ledgerAccountsTable.id })
      .from(ledgerAccountsTable)
      .where(eq(ledgerAccountsTable.id, tenantAccount.id))
      .limit(1)
      .for('update');

    const balance = await getTenantSettlementBalance(tx, ctx);

    // 🔒 PROVE THE MONEY IS THEIRS before we send any. `balance` is a materialized
    // counter; the truth is the sum of the append-only ledger entries. Recompute it and
    // refuse to pay on any disagreement — a payout is the one irreversible act here, and
    // the naira would come out of the POOLED account, i.e. out of another merchant's
    // money. Inside the FOR UPDATE lock, so nothing can post between this and the debit.
    await assertBalanceMatchesLedger(tx, ctx, tenantAccount.id, balance);

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
    // Prefer the precise ESCROW_LOCKED code when the shortfall is specifically the lock —
    // "your money is here but too fresh to withdraw" is a very different thing to
    // "you don't have that much".
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

    // Durable idempotency. A replayed sweep tick / retried request loses this claim and
    // returns the existing row, having posted nothing and sent nothing.
    const [claimed] = await tx
      .insert(payoutsTable)
      .values({
        reference: mintReference('PAY'),
        organizationId: ctx.organizationId,
        mode: ctx.mode,
        subAccountRef: accountRef,
        amountKobo: input.amountKobo,
        bankCode: destination.bankCode,
        accountNumber: destination.accountNumber,
        resolvedAccountName: destination.accountName,
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

    // The debit. After this commits, the merchant's balance is gone — which is exactly
    // why it must commit BEFORE we ask Nomba to move anything.
    const payoutClearing = await ensureAccount(tx, ctx, { key: 'tenant_payout', kind: 'system' });
    const posted = await postTransaction(tx, ctx, {
      kind: 'adjustment',
      memo: `payout ${claimed.reference}`,
      entries: [
        { accountId: tenantAccount.id, direction: 'debit', amount: input.amountKobo },
        { accountId: payoutClearing.id, direction: 'credit', amount: input.amountKobo },
      ],
    });

    const [posted_] = await tx
      .update(payoutsTable)
      .set({ status: 'ledger_posted', ledgerTransactionId: posted.transactionId })
      .where(eq(payoutsTable.id, claimed.id))
      .returning();

    return { row: posted_ ?? claimed, fresh: true };
  });

  // An idempotent replay: the money already moved (or is moving). Do nothing.
  if (!claim.fresh) return serializePayout(claim.row);

  await emitEvent(txDb, {
    ...ctx,
    type: 'settlement.payout_created',
    payload: { reference: claim.row.reference },
  });

  if (!input.payoutEnabled) {
    // Ledger-only: correctly accounted, not yet sent. Honest, and safe to leave.
    return serializePayout(claim.row);
  }

  // ── HTTP ─ the irreversible act. NO transaction is open across this.
  const settled = await sendTransfer(txDb, ctx, {
    payout: claim.row,
    client: input.client,
    destination: {
      bankCode: destination.bankCode,
      accountNumber: destination.accountNumber,
      accountName: destination.accountName,
    },
  });

  return serializePayout(settled);
}

/**
 * Send the bank transfer and record its outcome. Split out precisely so that no
 * database transaction is held open across the network call.
 */
async function sendTransfer(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: {
    payout: PayoutRow;
    client: NombaClient;
    destination: { bankCode: string; accountNumber: string; accountName: string };
  }
): Promise<PayoutRow> {
  const { payout, client, destination } = input;

  // Re-confirm the holder with the bank immediately before sending. The account was
  // verified when it was added, but "verified once, months ago" is not the same claim as
  // "this NUBAN belongs to this name right now", and this is the last moment we can
  // refuse. A mismatch means the destination changed under us — stop.
  let liveName: string;
  try {
    liveName = await resolveAccountName(client, {
      bankCode: destination.bankCode,
      accountNumber: destination.accountNumber,
    });
  } catch (error) {
    await failPayout(txDb, ctx, payout, 'bank_lookup_failed');
    throw AppError.ServiceUnavailable(
      'could not confirm the destination account with the bank',
      { payout: payout.reference, cause: error instanceof Error ? error.message : String(error) },
      NOMBAONE_ERROR_CODES.SETTLEMENT_PAYOUT_FAILED
    );
  }

  if (normalizeName(liveName) !== normalizeName(destination.accountName)) {
    await failPayout(txDb, ctx, payout, 'account_name_mismatch');
    throw AppError.UnprocessableEntity(
      'the destination account no longer matches the name it was verified under',
      { payout: payout.reference },
      NOMBAONE_ERROR_CODES.SETTLEMENT_PAYOUT_FAILED
    );
  }

  const transfer = await client.request<{ data?: { id?: string; reference?: string } }>({
    method: 'POST',
    endpoint: NOMBA_ENDPOINTS.bankTransfer,
    idempotencyRef: payout.merchantTxRef,
    body: {
      amount: koboToNombaAmount(payout.amountKobo),
      bankCode: destination.bankCode,
      accountNumber: destination.accountNumber,
      accountName: destination.accountName,
      // ⚠ `merchantTxRef`, NOT `merchantReference`. Live-probed: Nomba's validator names
      // this exact key, AND it is Nomba's idempotency key — under the old (ignored) name,
      // a retry was a SECOND TRANSFER.
      merchantTxRef: payout.merchantTxRef,
    },
  });

  const providerReference =
    String(transfer.data?.data?.id ?? transfer.data?.data?.reference ?? '') || null;

  if (transfer.pending) {
    // 🔴 ACCEPTED AND IN FLIGHT. Nomba answers `{code:"201", description:"PROCESSING",
    // status:false}` for a transfer it IS sending; the outcome arrives by webhook.
    // Reversing here would credit the merchant back while the money leaves — they would
    // receive the naira AND keep the balance. Nomba's own instruction: "mark the
    // transaction as pending and do not retry with a new reference."
    // We hold at `ledger_posted` — debited, unconfirmed — and record the provider id so
    // the webhook can be joined back to this payout (`payout_success` carries only the
    // transaction id, not our ref).
    logger.info('[payout] accepted by Nomba, awaiting confirmation', {
      payout: payout.reference,
      providerReference,
    });
    const held = await casUpdateProviderRef(txDb, payout, providerReference);
    return held ?? payout;
  }

  if (transfer.ok) {
    return (await casUpdate(txDb, payout, { status: 'succeeded', providerReference })) ?? payout;
  }

  // Genuinely REJECTED — Nomba never sent it (e.g. INSUFFICIENT_BALANCE). Give the
  // merchant their balance back.
  const reason = transfer.providerMessage ?? 'bank_transfer_failed';
  return (await failPayout(txDb, ctx, payout, reason)) ?? payout;
}

/** Bank names come back with punctuation/case noise ("Nomba/ADA EZE" vs "ADA  Eze"). */
const normalizeName = (s: string): string =>
  s
    .toUpperCase()
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * `WHERE id = ? AND status = 'ledger_posted'` — the COMPARE-AND-SET that makes a
 * payout's outcome exactly-once.
 *
 * A `payout_success` webhook, the stuck-payout reaper, and the inline response can all
 * race to resolve the same payout. Only the transition OUT OF `ledger_posted` may apply
 * an outcome, so the reversal below can never post twice — which would credit the
 * merchant their money back twice over.
 */
const stillInFlight = (id: string) =>
  and(eq(payoutsTable.id, id), eq(payoutsTable.status, 'ledger_posted'));

/** Stamp the provider's transaction id WITHOUT resolving the payout — it is still in
 *  flight. `payout_success` carries only that id (never our ref), so this is the join
 *  key the webhook needs to find its way back here. */
async function casUpdateProviderRef(
  txDb: InfraTxDb,
  payout: PayoutRow,
  providerReference: string | null
): Promise<PayoutRow | null> {
  const [row] = await txDb
    .update(payoutsTable)
    .set({ providerReference })
    .where(stillInFlight(payout.id))
    .returning();
  return row ?? null;
}

/** Record a terminal outcome, but only if nobody else already has. */
async function casUpdate(
  txDb: InfraTxDb,
  payout: PayoutRow,
  set: { status?: 'succeeded'; providerReference?: string | null }
): Promise<PayoutRow | null> {
  const [row] = await txDb
    .update(payoutsTable)
    .set(set)
    .where(stillInFlight(payout.id))
    .returning();
  return row ?? null;
}

/**
 * Reverse a REJECTED payout: the transfer never left, so the merchant must get their
 * balance back. The compensating ledger entry and the status flip happen in ONE
 * transaction, gated by the CAS — so the balance is restored exactly once.
 *
 * ⚠ Only ever call this on an EXPLICIT provider rejection. NEVER on a timeout, a 5xx, or
 * a PROCESSING: in those cases the money may well be in flight, and crediting the
 * balance back would hand the merchant the naira AND the balance.
 */
async function failPayout(
  txDb: InfraTxDb,
  ctx: DomainContext,
  payout: PayoutRow,
  failureReason: string
): Promise<PayoutRow | null> {
  return txDb.transaction(async (tx) => {
    const [claimed] = await tx
      .update(payoutsTable)
      .set({ status: 'failed', failureReason })
      .where(stillInFlight(payout.id))
      .returning();
    if (!claimed) return null; // already resolved by someone else — post nothing

    const accountRef = await resolveTenantAccountRef(tx, ctx);
    const tenantAccount = await ensureAccount(tx, ctx, {
      key: tenantSettlementAccountKey(accountRef),
      kind: 'liability',
    });
    const payoutClearing = await ensureAccount(tx, ctx, { key: 'tenant_payout', kind: 'system' });

    await postTransaction(tx, ctx, {
      kind: 'adjustment',
      memo: `payout reversal ${payout.reference} (${failureReason})`,
      entries: [
        { accountId: payoutClearing.id, direction: 'debit', amount: payout.amountKobo },
        { accountId: tenantAccount.id, direction: 'credit', amount: payout.amountKobo },
      ],
    });

    logger.warn('[payout] rejected by the bank — merchant balance restored', {
      payout: payout.reference,
      failureReason,
    });
    return claimed;
  });
}
