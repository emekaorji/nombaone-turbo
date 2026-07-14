import { chargeOrderRef, OTP_ORDER_REF_SUFFIX } from './actionLink';

import type { DomainContext } from '@nombaone/sara/context';
import type { NombaClient, RequeryResult } from '@nombaone/sara/nomba';

/**
 * ── ASKING NOMBA "DID THIS INVOICE GET PAID?" ────────────────────────────────
 *
 * Nomba has no idea what an invoice is. It knows ORDERS, and it answers `?orderReference=`. One
 * invoice can have several orders over its life, because Nomba permanently burns a reference the
 * first time it sees it, so every distinct payment attempt has to open a new one:
 *
 *   nbo…inv        the hosted-checkout entry order
 *   nbo…inv-c0     the first silent card charge
 *   nbo…inv-c1     the retry after that one declined
 *   nbo…inv-otp    the 3DS-completion link
 *
 * Any ONE of them settling means the invoice is paid. So "was this invoice paid?" is not a single
 * lookup — it is a question about a small, known set of references, and asking only about the bare
 * invoice reference (which is what the reconcile backstop did) misses every payment that arrived by
 * card. That is the difference between a safety net and a decoration.
 *
 * Ordered newest-first: the most recent attempt is the one most likely to have settled, so the
 * common case costs a single call.
 */
/** Everything this needs is the invoice's reference and how many attempts it has burnt. */
export interface InvoiceOrderIdentity {
  reference: string;
  attemptCount: number;
}

export function invoiceOrderReferences(invoice: InvoiceOrderIdentity): string[] {
  const refs: string[] = [];

  // Attempt counter is bumped AFTER a failure, so the CURRENT attempt is `attemptCount` and the one
  // that just failed is `attemptCount - 1`. Both can be outstanding at Nomba.
  for (let attempt = invoice.attemptCount; attempt >= 0; attempt -= 1) {
    refs.push(chargeOrderRef(invoice.reference, attempt));
  }

  refs.push(`${invoice.reference}${OTP_ORDER_REF_SUFFIX}`);
  refs.push(invoice.reference); // the hosted-checkout entry order

  return refs;
}

/**
 * The first order for this invoice that Nomba says SUCCEEDED, or the last answer it gave if none
 * did. Never invents a settlement: an invoice with no successful order comes back `succeeded:false`.
 */
export async function requeryInvoiceAtNomba(
  client: NombaClient,
  ctx: DomainContext,
  invoice: InvoiceOrderIdentity
): Promise<RequeryResult> {
  let last: RequeryResult = { found: false, status: '', succeeded: false };

  for (const reference of invoiceOrderReferences(invoice)) {
    const result = await client.requeryTransaction(ctx, { reference });
    if (result.found) last = result;
    if (result.succeeded) return result;
  }

  return last;
}
