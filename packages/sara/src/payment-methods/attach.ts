import { paymentMethodsTable } from '@nombaone/core-db/schema';
import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';

import { emitEvent } from '../events';
import { NOMBA_ENDPOINTS } from '../nomba/endpoints';
import { koboToNombaAmount } from '../nomba/money';
import { mintReference } from '../reference';
import { nombaData, resolveCustomer } from './internal';

import type {
  CheckoutSetupResponseData,
  MandateSetupResponseData,
  VirtualAccountResponseData,
} from '@nombaone/core-contracts/types';
import type { DomainContext, InfraTxDb } from '../context';
import type { NombaClient } from '../nomba/client';
import type { CreateMandateInput, IssueVirtualAccountInput, SetupCardInput } from './types';

const requireOk = (ok: boolean, message: string): void => {
  if (!ok) {
    throw AppError.ThirdPartyServiceError(
      message,
      undefined,
      NOMBAONE_ERROR_CODES.NOMBA_REQUEST_FAILED
    );
  }
};

/**
 * Card capture — hosted-checkout tokenize. Mints an order with `tokenizeCard:true`
 * tied to OUR payment-method reference, creates a `setup_pending` row, and returns
 * the `checkoutLink`. The `payment_success` webhook later carries the `tokenKey`,
 * which `captureCardToken` promotes the row to `active` with (E1). **No PAN here.**
 */
export async function setupCard(
  client: NombaClient,
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: SetupCardInput
): Promise<CheckoutSetupResponseData> {
  const customer = await resolveCustomer(txDb, ctx, input.customerRef);
  const reference = mintReference('PMT');

  const res = await client.request({
    method: 'POST',
    endpoint: NOMBA_ENDPOINTS.checkoutOrder,
    idempotencyRef: reference,
    body: {
      tokenizeCard: true,
      order: {
        orderReference: reference,
        amount: koboToNombaAmount(input.amount), // kobo → naira decimal string (D.1)
        currency: 'NGN',
        callbackUrl: input.callbackUrl,
        customerId: input.customerRef,
        customerEmail: customer.email,
      },
    },
  });
  requireOk(res.ok, 'nomba checkout setup failed');

  const data = nombaData(res);
  const checkoutLink = String(data.checkoutLink ?? data.checkoutUrl ?? '');

  await txDb.insert(paymentMethodsTable).values({
    reference,
    organizationId: ctx.organizationId,
    environment: ctx.environment,
    customerId: customer.id,
    kind: 'card',
    status: 'setup_pending',
  });

  await emitEvent(txDb, {
    ...ctx,
    type: 'payment_method.attached',
    payload: { reference, kind: 'card', status: 'setup_pending' },
  });

  return { reference, checkoutLink };
}

/**
 * Mandate create — direct debit. Creates the mandate and a `consent_pending` row;
 * the customer authorises via the NIBSS ₦50 validation transfer. `pollMandateActive`
 * promotes it to `active` once `ACTIVE`+`ADVICE_SENT`. `maxAmount` is the hard
 * per-debit ceiling (stored in metadata; enforced by the mandate rail).
 */
export async function createMandate(
  client: NombaClient,
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: CreateMandateInput
): Promise<MandateSetupResponseData> {
  const customer = await resolveCustomer(txDb, ctx, input.customerRef);
  const reference = mintReference('PMT');

  // Nomba wants java LocalDateTime (date+time, NO zone) in the present/future — a
  // UTC `now` can read as past against Nomba's WAT clock, so default the start to
  // tomorrow. Normalize any caller-supplied date to the same shape.
  const DAY = 24 * 3600 * 1000;
  const toLocalDateTime = (iso: string): string => new Date(iso).toISOString().slice(0, 19);
  const startDate = input.startDate
    ? toLocalDateTime(input.startDate)
    : new Date(Date.now() + DAY).toISOString().slice(0, 19);
  const endDate = input.endDate
    ? toLocalDateTime(input.endDate)
    : new Date(Date.parse(startDate) + 365 * DAY).toISOString().slice(0, 19);

  const res = await client.request({
    method: 'POST',
    endpoint: NOMBA_ENDPOINTS.mandateCreate,
    idempotencyRef: reference,
    body: {
      customerAccountNumber: input.customerAccountNumber,
      bankCode: input.bankCode,
      customerName: input.customerName,
      // T0 prod: all four API-required (docs said optional).
      customerAccountName: input.customerAccountName,
      customerEmail: customer.email,
      customerPhoneNumber: input.customerPhoneNumber,
      customerAddress: input.customerAddress,
      narration: input.narration,
      amount: koboToNombaAmount(input.maxAmount), // maxAmount kobo → naira decimal string (D.1)
      frequency: input.frequency, // NIBSS uppercase vocabulary
      startDate,
      endDate,
      merchantReference: reference,
      // NOTE: `subscriberCode` (NIBSS biller code) is provisioned to the merchant
      // account on Nomba's side — not sent here. Create fails with "Invalid
      // parameter entered for SubscriberCode" until the account is provisioned.
    },
  });
  requireOk(res.ok, 'nomba mandate create failed');

  const data = nombaData(res);
  const mandateId = String(data.mandateId ?? '');
  const consentInstruction = String(
    data.description ??
      'Transfer the NIBSS ₦50 validation token from the mandated account to complete authorisation.'
  );

  await txDb.insert(paymentMethodsTable).values({
    reference,
    organizationId: ctx.organizationId,
    environment: ctx.environment,
    customerId: customer.id,
    kind: 'mandate',
    status: 'consent_pending',
    mandateId,
    metadata: { maxAmount: input.maxAmount, frequency: input.frequency },
  });

  await emitEvent(txDb, {
    ...ctx,
    type: 'payment_method.attached',
    payload: { reference, kind: 'mandate', status: 'consent_pending' },
  });

  return { reference, mandateRef: mandateId, status: 'consent_pending', consentInstruction };
}

/**
 * Virtual account issue — the transfer/push rail. Issues a dedicated NUBAN tied to
 * our `accountRef`, `active` immediately; funding reconciles later via the inbound
 * `payment_success` (`vact_transfer`) by `aliasAccountReference`.
 */
export async function issueVirtualAccount(
  client: NombaClient,
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: IssueVirtualAccountInput
): Promise<VirtualAccountResponseData> {
  const customer = await resolveCustomer(txDb, ctx, input.customerRef);
  const reference = mintReference('PMT');
  const accountRef = reference;

  const res = await client.request({
    method: 'POST',
    endpoint: NOMBA_ENDPOINTS.virtualAccountCreate,
    idempotencyRef: accountRef,
    body: {
      accountRef,
      accountName: customer.name,
      // kobo → naira decimal string (D.1); omit when no expected amount (open VA).
      expectedAmount: input.expectedAmount != null ? koboToNombaAmount(input.expectedAmount) : undefined,
      expiryDate: input.expiryDate,
    },
  });
  requireOk(res.ok, 'nomba virtual account issue failed');

  const data = nombaData(res);

  await txDb.insert(paymentMethodsTable).values({
    reference,
    organizationId: ctx.organizationId,
    environment: ctx.environment,
    customerId: customer.id,
    kind: 'virtual_account',
    status: 'active',
    accountRef,
  });

  await emitEvent(txDb, {
    ...ctx,
    type: 'payment_method.attached',
    payload: { reference, kind: 'virtual_account', status: 'active' },
  });

  return {
    reference,
    bankName: String(data.bankName ?? ''),
    accountNumber: String(data.bankAccountNumber ?? ''),
    accountName: String(data.bankAccountName ?? ''),
    accountRef,
  };
}
