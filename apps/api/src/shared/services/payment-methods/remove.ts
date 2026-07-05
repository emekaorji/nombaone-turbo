import { eq } from 'drizzle-orm';

import { paymentMethodsTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '@nombaone/sara/events';
import { NOMBA_ENDPOINTS } from '@nombaone/sara/nomba/endpoints';
import { loadByReference } from './queries';
import { serializePaymentMethod } from './serialize';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';
import type { NombaClient } from '@nombaone/sara/nomba/client';
import type { PaymentMethodResponseData } from './types';

/**
 * Remove a payment method (E7). For a card, the tokenized card is DELETE'd at
 * Nomba first so no stale token is ever chargeable; then the row is marked
 * `removed` and un-defaulted. Idempotent: removing an already-`removed` method is
 * a no-op. (DELETE path is a T0 ⚠ item — the call is best-effort and non-fatal so
 * a provider-side 404 on an already-gone token still completes the local removal.)
 */
export async function removePaymentMethod(
  client: NombaClient,
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: { reference: string }
): Promise<PaymentMethodResponseData> {
  const found = await loadByReference(txDb, ctx, input.reference);
  if (found.method.status === 'removed') {
    return serializePaymentMethod(found.method, found.customerRef);
  }

  if (found.method.kind === 'card' && found.method.tokenKey) {
    await client
      .request({
        method: 'DELETE',
        endpoint: `${NOMBA_ENDPOINTS.tokenizedCardDelete}/${found.method.tokenKey}`,
        idempotencyRef: input.reference,
      })
      .catch(() => undefined);
  }

  const [row] = await txDb
    .update(paymentMethodsTable)
    .set({ status: 'removed', isDefault: false })
    .where(eq(paymentMethodsTable.id, found.method.id))
    .returning();

  if (!row) {
    throw AppError.InternalServerError(
      'failed to remove payment method',
      { reference: input.reference },
      NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
    );
  }

  await emitEvent(txDb, {
    ...ctx,
    type: 'payment_method.updated',
    payload: { reference: input.reference, status: 'removed' },
  });

  return serializePaymentMethod(row, found.customerRef);
}
