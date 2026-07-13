import { createSubscription, getSubscriptionByReference } from '../subscriptions';
import { runCycle } from './runCycle';

import type { DomainContext, InfraTxDb } from '@nombaone/sara/context';
import type { CreateSubscriptionInput, SubscriptionResponseData } from '../subscriptions';

/**
 * Create a subscription AND kick its first billing cycle — the create-path
 * composer the API calls (keeps `subscriptions/create` free of any billing
 * dependency, so there is no submodule import cycle).
 *
 * A `charge_automatically` subscription with no trial starts `incomplete` and
 * runs its first cycle immediately:
 *   • a stored payment method → charge now (→ `active` | `past_due`);
 *   • NO stored method → the HOSTED-CHECKOUT entry: the first invoice is issued
 *     and the response carries a Nomba `checkoutLink` (tokenizing) — the sub
 *     stays `incomplete` until the settle webhook activates it. This is the
 *     storefront flow: "Subscribe" → redirect → pay → active.
 * A trialing / send_invoice / zero subscription is returned as created (its
 * first charge is the trial-end / scheduler / inbound path).
 */
export async function startSubscription(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: CreateSubscriptionInput
): Promise<SubscriptionResponseData> {
  const created = await createSubscription(txDb, ctx, input);
  if (created.status === 'incomplete') {
    const cycle = await runCycle(txDb, ctx, created.id, {
      checkoutCallbackUrl: input.callbackUrl,
    });
    const fresh = await getSubscriptionByReference(txDb, ctx, created.id);
    return cycle.outcome === 'awaiting_payment'
      ? { ...fresh, checkoutLink: cycle.checkoutLink ?? null }
      : fresh;
  }
  return created;
}
