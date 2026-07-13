import { and, eq } from 'drizzle-orm';

import { customersTable, invoicesTable, type InvoiceRow } from '@nombaone/core-db/schema';
import { NOMBA_ENDPOINTS } from '@nombaone/sara/nomba/endpoints';
import { getBillingNombaClient } from '@nombaone/sara/nomba/injected';
import { koboToNombaAmount } from '@nombaone/sara/nomba/money';


import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';

/**
 * The suffix appended to an invoice reference to form the OTP/3DS-completion
 * checkout's `orderReference`. A DISTINCT order reference dodges Nomba's order
 * dedup on the ORIGINAL tokenized charge (which used the bare `invoice.reference`),
 * while `extractOurReference` de-suffixes `-otp` so the completion webhook still
 * resolves — and settles — this exact invoice. Our references are `nbo{digits}{domain}`
 * with no hyphens, so a trailing `-otp` is unambiguous.
 */
export const OTP_ORDER_REF_SUFFIX = '-otp';

export interface MintCheckoutLinkOptions {
  /**
   * Tokenize the paying card so renewals can be pulled silently. ON for the
   * hosted-checkout FIRST payment (the whole point of the entry flow); OFF for
   * the OTP/3DS completion link (the token already exists — that is a pay-now).
   */
  tokenizeCard?: boolean;
  /** Where the hosted page returns the payer afterwards. */
  callbackUrl?: string;
  /**
   * The order-reference suffix. Defaults to `-otp` (the recovery link, whose
   * DISTINCT ref dodges Nomba's dedup on the original tokenized charge). The
   * hosted-checkout FIRST payment passes `''` — no prior charge used the bare
   * invoice ref, so the inbound path resolves it directly.
   */
  refSuffix?: string;
  /** Restrict the hosted page's payment methods. */
  allowedPaymentMethods?: string[];
}

/**
 * Mint a hosted-checkout link that PAYS an invoice. Sub-account-scoped so the
 * `payment_success` webhook fires. The `orderReference` is STABLE
 * (`invoice.reference + refSuffix`), so Nomba dedups a repeat call and returns
 * the same link (idempotent across retries). Returns `null` when no client is
 * injected (Nomba unconfigured) or the customer is missing — callers degrade
 * (emit their event without a link) rather than fail the money path.
 */
export async function mintInvoiceCheckoutLink(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow,
  options: MintCheckoutLinkOptions = {}
): Promise<string | null> {
  const client = getBillingNombaClient(ctx.mode);
  if (!client) return null;

  const [customer] = await txDb
    .select()
    .from(customersTable)
    .where(
      and(
        eq(customersTable.organizationId, ctx.organizationId),
        eq(customersTable.mode, ctx.mode),
        eq(customersTable.id, invoice.customerId)
      )
    )
    .limit(1);
  if (!customer) return null;

  const orderReference = `${invoice.reference}${options.refSuffix ?? OTP_ORDER_REF_SUFFIX}`;
  const outstanding = invoice.amountDue - invoice.amountPaid;

  const res = await client.request<{ data?: { checkoutLink?: string; checkoutUrl?: string } }>({
    method: 'POST',
    endpoint: NOMBA_ENDPOINTS.checkoutOrder,
    idempotencyRef: orderReference,
    body: {
      // `tokenizeCard` is a TOP-LEVEL sibling of `order` on Nomba's wire.
      ...(options.tokenizeCard ? { tokenizeCard: true } : {}),
      order: {
        orderReference,
        amount: koboToNombaAmount(outstanding > 0 ? outstanding : invoice.amountDue),
        currency: 'NGN',
        customerId: customer.reference,
        customerEmail: customer.email,
        ...(options.callbackUrl ? { callbackUrl: options.callbackUrl } : {}),
        ...(options.allowedPaymentMethods
          ? { allowedPaymentMethods: options.allowedPaymentMethods }
          : {}),
      },
    },
  });
  if (!res.ok) return null;
  const data = res.data?.data ?? {};
  const link = String(data.checkoutLink ?? data.checkoutUrl ?? '');
  return link || null;
}

/**
 * The hosted-checkout FIRST-payment link for an invoice, stamped into
 * `invoices.metadata.checkoutLink` so re-runs are free (no Nomba round-trip) and
 * later surfaces (emails, the /i/<token> page) reuse the same link. Tokenizing:
 * the paying card comes back as a reusable `tokenKey` on the settle webhook.
 */
export async function ensureInvoiceCheckoutLink(
  txDb: InfraTxDb,
  ctx: DomainContext,
  invoice: InvoiceRow,
  options: Omit<MintCheckoutLinkOptions, 'refSuffix'> = {}
): Promise<{ invoice: InvoiceRow; checkoutLink: string | null }> {
  const stamped = (invoice.metadata as Record<string, unknown> | null)?.checkoutLink;
  if (typeof stamped === 'string' && stamped.length > 0) {
    return { invoice, checkoutLink: stamped };
  }

  const checkoutLink = await mintInvoiceCheckoutLink(txDb, ctx, invoice, {
    tokenizeCard: true,
    refSuffix: '',
    ...options,
  });
  if (!checkoutLink) return { invoice, checkoutLink: null };

  const [updated] = await txDb
    .update(invoicesTable)
    .set({
      metadata: {
        ...((invoice.metadata as Record<string, unknown> | null) ?? {}),
        checkoutLink,
      },
    })
    .where(eq(invoicesTable.id, invoice.id))
    .returning();
  return { invoice: updated ?? invoice, checkoutLink };
}
