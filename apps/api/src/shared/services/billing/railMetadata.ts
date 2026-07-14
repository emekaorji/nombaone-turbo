import { loadCustomerById } from '../payment-methods/internal';

import type { InvoiceRow, PaymentMethodRow } from '@nombaone/core-db/schema';
import type { DomainContext, InfraTxScope } from '@nombaone/sara/context';
import type { RailCollectMetadata } from '@nombaone/sara/rails';

/**
 * ── THE one builder of `RailCollectMetadata` ─────────────────────────────────
 *
 * Both collect sites — the renewal path (`billing/collectForInvoice`) and the
 * dunning retry (`dunning/attempt`) — MUST build the rail's metadata here and
 * nowhere else. They used to hand-roll their own bags, and the two drifted: the
 * renewal path passed neither `tokenKey` nor `mandateId`, so on live every card
 * charge failed `no_token_on_method` and every mandate `no_mandate_on_method`.
 * The sandbox simulator short-circuits before the rail, which is exactly why no
 * test saw it.
 *
 * Two reads, zero writes (safe before a rail's network call — no transaction is
 * held open across it; the collect sites run on the pool handle):
 *   1. the customer — `customerRef` (the `CUS…` reference Nomba tokenized under,
 *      never our UUID) + `customerEmail`;
 *   2. the method row — `tokenKey` / `mandateId` / the mandate's `maxAmount`
 *      ceiling (stored in kobo in `method.metadata` at attach).
 *
 * ⚠ NO `accountId`. Every charge collects into the ONE platform Nomba account —
 * there is no per-merchant Nomba account to scope to (sub-accounts cannot be
 * minted; a virtual account holds no balance). Whose money it is, is decided by
 * OUR ledger at settlement (`recordSettlement` credits
 * `tenant_settlement:{accountRef}`), not by a field on the Nomba order. This used
 * to thread the tenant's sub-account id and warn when it was missing — which was
 * every tenant, always, because no merchant could ever obtain one.
 *
 * `accountRef` is pinned to the INVOICE reference on purpose: the transfer rail's
 * NUBAN alias is the inbound reconciliation key (`aliasAccountReference` → invoice
 * lookup). A per-customer "stable" NUBAN here would orphan the money.
 */
export async function buildRailCollectMetadata(
  db: InfraTxScope,
  ctx: DomainContext,
  input: { invoice: InvoiceRow; method: PaymentMethodRow }
): Promise<RailCollectMetadata> {
  const { invoice, method } = input;

  const customer = await loadCustomerById(db, ctx, invoice.customerId);

  const methodMeta = (method.metadata ?? {}) as Record<string, unknown>;
  const maxAmountKobo =
    typeof methodMeta.maxAmount === 'number' ? methodMeta.maxAmount : undefined;

  return {
    invoice: invoice.reference,
    paymentMethod: method.reference,
    customerRef: customer?.reference ?? '',
    customerEmail: customer?.email ?? '',
    // card
    tokenKey: method.tokenKey ?? undefined,
    // mandate
    mandateId: method.mandateId ?? undefined,
    maxAmountKobo,
    // transfer — the invoice ref IS the reconciliation alias (see doc above).
    accountRef: invoice.reference,
    accountName: customer?.name ?? undefined,
  };
}
