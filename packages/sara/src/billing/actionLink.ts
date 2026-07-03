import { and, eq } from 'drizzle-orm';

import { customersTable, type InvoiceRow } from '@nombaone/core-db/schema';

import { NOMBA_ENDPOINTS } from '../nomba/endpoints';
import { getBillingNombaClient } from '../nomba/injected';
import { koboToNombaAmount } from '../nomba/money';
import { findTenantSubAccount } from '../settlement';

import type { DomainContext, InfraTxDb } from '../context';

/**
 * The suffix appended to an invoice reference to form the OTP/3DS-completion
 * checkout's `orderReference`. A DISTINCT order reference dodges Nomba's order
 * dedup on the ORIGINAL tokenized charge (which used the bare `invoice.reference`),
 * while `extractOurReference` de-suffixes `-otp` so the completion webhook still
 * resolves — and settles — this exact invoice. Our references are `nbo{digits}{domain}`
 * with no hyphens, so a trailing `-otp` is unambiguous.
 */
export const OTP_ORDER_REF_SUFFIX = '-otp';

/**
 * Mint a fresh hosted-checkout link for the customer to COMPLETE an invoice whose
 * card charge came back OTP/3DS-required (bank step-up). Sub-account-scoped so the
 * `payment_success` webhook fires; a pay-now checkout (no `tokenizeCard`). Because
 * the `orderReference` is the STABLE `${invoice.reference}-otp`, Nomba dedups a
 * repeat call and returns the same link (idempotent across retries). Returns `null`
 * when no client is injected (Nomba unconfigured) or the customer is missing — the
 * caller still emits `invoice.action_required`, just without a link.
 */
export async function mintInvoiceCheckoutLink(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow
): Promise<string | null> {
  const client = getBillingNombaClient();
  if (!client) return null;

  const [customer] = await txDb
    .select()
    .from(customersTable)
    .where(
      and(
        eq(customersTable.organizationId, ctx.organizationId),
        eq(customersTable.environment, ctx.environment),
        eq(customersTable.id, invoice.customerId)
      )
    )
    .limit(1);
  if (!customer) return null;

  const sub = await findTenantSubAccount(txDb, ctx);
  const orderReference = `${invoice.reference}${OTP_ORDER_REF_SUFFIX}`;
  const outstanding = invoice.amountDue - invoice.amountPaid;

  const res = await client.request<{ data?: { checkoutLink?: string; checkoutUrl?: string } }>({
    method: 'POST',
    endpoint: NOMBA_ENDPOINTS.checkoutOrder,
    idempotencyRef: orderReference,
    body: {
      order: {
        orderReference,
        amount: koboToNombaAmount(outstanding > 0 ? outstanding : invoice.amountDue),
        currency: 'NGN',
        customerId: customer.reference,
        customerEmail: customer.email,
        ...(sub?.subAccountId ? { accountId: sub.subAccountId } : {}),
      },
    },
  });
  if (!res.ok) return null;
  const data = res.data?.data ?? {};
  const link = String(data.checkoutLink ?? data.checkoutUrl ?? '');
  return link || null;
}
