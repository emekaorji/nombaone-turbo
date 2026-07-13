import { eq } from 'drizzle-orm';

import { subscriptionsTable } from '@nombaone/core-db/schema';
import { mintActionToken } from '@nombaone/sara/actions';

import { env } from '@shared/config/env';

import type { InvoiceRow } from '@nombaone/core-db/schema';
import type { DomainContext, InfraTxScope } from '@nombaone/sara/context';

/**
 * End-customer ACTION URLS for emails — the /i (pay invoice) and /pm (update
 * payment method) pages in apps/checkout, authorized by a signed, expiring
 * token (`@nombaone/sara/actions`) instead of anyone's API key. Unset secret ⇒
 * `undefined` — emails go out without the link (degraded, never broken).
 */
const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60; // dunning can run for weeks

/** `/i/<token>` — view + pay an invoice. */
export function buildPayInvoiceUrl(invoiceReference: string): string | undefined {
  const secret = env.INFRA_ACTION_TOKEN_SECRET;
  if (!secret) return undefined;
  const token = mintActionToken(secret, {
    kind: 'pay-invoice',
    ref: invoiceReference,
    expSec: THIRTY_DAYS_SEC,
  });
  return `${env.CHECKOUT_BASE_URL}/i/${token}`;
}

/** `/pm/<token>` — the update-payment-method page, keyed by SUBSCRIPTION reference. */
export async function buildUpdatePaymentMethodUrl(
  db: InfraTxScope,
  _ctx: DomainContext,
  invoice: Pick<InvoiceRow, 'subscriptionId'>
): Promise<string | undefined> {
  const secret = env.INFRA_ACTION_TOKEN_SECRET;
  if (!secret || !invoice.subscriptionId) return undefined;
  const [sub] = await db
    .select({ reference: subscriptionsTable.reference })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.id, invoice.subscriptionId))
    .limit(1);
  if (!sub) return undefined;
  const token = mintActionToken(secret, {
    kind: 'update-pm',
    ref: sub.reference,
    expSec: THIRTY_DAYS_SEC,
  });
  return `${env.CHECKOUT_BASE_URL}/pm/${token}`;
}
