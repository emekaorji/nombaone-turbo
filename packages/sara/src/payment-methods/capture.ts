import { eq } from 'drizzle-orm';

import { paymentMethodsTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '../events';
import { NOMBA_ENDPOINTS } from '../nomba/endpoints';
import { nombaData } from './internal';
import { loadByReference } from './queries';
import { serializePaymentMethod } from './serialize';

import type { DomainContext, InfraTxDb } from '../context';
import type { NombaClient } from '../nomba/client';
import type { PaymentMethodResponseData, TokenizedCardData } from './types';

/**
 * Promote a `setup_pending` card method to `active`, persisting the captured
 * `tokenKey` + display fields from the `payment_success` webhook (E1). **N1: only
 * the last 4 of the (masked) PAN is kept — never the full number.** Idempotent: a
 * replayed capture on an already-`active` method is a no-op (F2/K).
 */
export async function captureCardToken(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: { reference: string; tokenizedCardData: TokenizedCardData }
): Promise<PaymentMethodResponseData> {
  const found = await loadByReference(txDb, ctx, input.reference);
  if (found.method.status === 'active') {
    return serializePaymentMethod(found.method, found.customerRef);
  }

  const tcd = input.tokenizedCardData;
  const last4 = tcd.cardPan ? tcd.cardPan.replace(/\D/g, '').slice(-4) : null;
  const toInt = (v: string | number | undefined): number | null =>
    v === undefined || v === null || v === '' ? null : Number(v);

  const [row] = await txDb
    .update(paymentMethodsTable)
    .set({
      status: 'active',
      tokenKey: tcd.tokenKey,
      brand: tcd.cardType ?? null,
      last4,
      expMonth: toInt(tcd.tokenExpiryMonth),
      expYear: toInt(tcd.tokenExpiryYear),
    })
    .where(eq(paymentMethodsTable.id, found.method.id))
    .returning();

  if (!row) {
    throw AppError.InternalServerError(
      'failed to capture card token',
      { reference: input.reference },
      NOMBAONE_ERROR_CODES.SYSTEM_INTERNAL_ERROR
    );
  }

  await emitEvent(txDb, {
    ...ctx,
    type: 'payment_method.updated',
    payload: { reference: input.reference, kind: 'card', status: 'active' },
  });

  return serializePaymentMethod(row, found.customerRef);
}

/**
 * Poll the mandate's status and promote it to `active` once `ACTIVE`+`ADVICE_SENT`
 * (there is no consent webhook — activation is poll-only). Safe to call repeatedly;
 * returns the current method either way.
 */
export async function pollMandateActive(
  client: NombaClient,
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: { reference: string }
): Promise<PaymentMethodResponseData> {
  const found = await loadByReference(txDb, ctx, input.reference);
  if (found.method.kind !== 'mandate') {
    throw AppError.UnprocessableEntity(
      'payment method is not a mandate',
      { reference: input.reference },
      NOMBAONE_ERROR_CODES.PAYMENT_METHOD_KIND_MISMATCH
    );
  }
  if (found.method.status === 'active') {
    return serializePaymentMethod(found.method, found.customerRef);
  }

  const res = await client.request({
    method: 'GET',
    endpoint: NOMBA_ENDPOINTS.mandateStatus,
    query: { mandateId: found.method.mandateId ?? '' },
    idempotencyRef: input.reference,
  });
  const data = nombaData(res);
  const status = String(data.status ?? '').toUpperCase();
  const advice = String(data.adviceStatus ?? data.advice ?? '').toUpperCase();

  if (status === 'ACTIVE' && advice.includes('ADVICE_SENT')) {
    const [row] = await txDb
      .update(paymentMethodsTable)
      .set({ status: 'active' })
      .where(eq(paymentMethodsTable.id, found.method.id))
      .returning();
    if (row) {
      await emitEvent(txDb, {
        ...ctx,
        type: 'payment_method.updated',
        payload: { reference: input.reference, kind: 'mandate', status: 'active' },
      });
      return serializePaymentMethod(row, found.customerRef);
    }
  }

  return serializePaymentMethod(found.method, found.customerRef);
}
