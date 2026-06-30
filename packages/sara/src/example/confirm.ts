import { and, eq } from 'drizzle-orm';

import { examplesTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '../events';
import { ensureAccount, postTransaction } from '../ledger';

import type { DomainContext, InfraTxDb } from '../context';
import type { ConfirmExampleFromWebhookInput } from './types';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * confirmExampleFromWebhook — the INBOUND-CONFIRM path: "confirmed by webhook,
 * THEN re-verified, never assumed".
 *
 * A PUSH rail (transfer to a virtual account) settles out of band: the payer
 * moves money and the provider notifies us via a webhook. A webhook is an
 * UNTRUSTED hint, not proof of payment — it can be spoofed, replayed, or stale.
 * So the confirm path is:
 *
 *   1. Resolve OUR example by OUR reference, within the caller's pinned scope.
 *      The route/webhook body never selects the tenant; ctx does.
 *
 *   2. RE-VERIFY against the provider before recording anything. (Stub below —
 *      this is where you call the provider's "get transaction" API using the
 *      provider reference and confirm amount + status server-side. Never settle
 *      on the strength of the webhook alone.)
 *
 *   3. Only then record the money movement: a `settlement` ledger transaction
 *      (the funds the payer pushed are now recognized) and an `example.settled`
 *      domain event (outbox fan-out to subscribers).
 *
 * Idempotency: the reference is the join key, so a duplicate webhook re-resolves
 * the same example; a production confirm would additionally guard against posting
 * a second settlement for an already-settled reference (a documented seam — the
 * boilerplate keeps the happy path readable).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function confirmExampleFromWebhook(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: ConfirmExampleFromWebhookInput
): Promise<void> {
  // 1. Resolve our resource by our reference, server-side, within scope.
  const [row] = await txDb
    .select()
    .from(examplesTable)
    .where(
      and(
        eq(examplesTable.organizationId, ctx.organizationId),
        eq(examplesTable.environment, ctx.environment),
        eq(examplesTable.reference, input.reference)
      )
    )
    .limit(1);

  if (!row) {
    throw AppError.NotFound(
      'example not found',
      { reference: input.reference },
      NOMBAONE_ERROR_CODES.EXAMPLE_NOT_FOUND
    );
  }

  // 2. Re-verify against the provider here, never trust the webhook alone:
  //    call the provider's API with `input.providerReference`, confirm the
  //    amount equals `row.amount` and the provider-side status is settled, and
  //    bail out (without throwing) if it has not actually settled. The mock rail
  //    has no real provider, so this is a documented no-op seam.

  // 3. Record settlement: a balanced double-entry transaction tagged `settlement`
  //    (debit `cash`, credit `platform_revenue`, amount = row.amount), then emit.
  const cash = await ensureAccount(txDb, ctx, { key: 'cash', kind: 'asset' });
  const platformRevenue = await ensureAccount(txDb, ctx, {
    key: 'platform_revenue',
    kind: 'revenue',
  });

  await postTransaction(txDb, ctx, {
    kind: 'settlement',
    memo: `settle ${input.reference} (provider ${input.providerReference})`,
    entries: [
      { accountId: cash.id, direction: 'debit', amount: row.amount },
      { accountId: platformRevenue.id, direction: 'credit', amount: row.amount },
    ],
  });

  await emitEvent(txDb, {
    ...ctx,
    type: 'example.settled',
    payload: {
      reference: input.reference,
      providerReference: input.providerReference,
      amount: row.amount,
    },
  });
}
