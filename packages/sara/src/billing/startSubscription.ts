import { createSubscription, getSubscriptionByReference } from '../subscriptions';
import { runCycle } from './runCycle';

import type { DomainContext, InfraTxDb } from '../context';
import type { CreateSubscriptionInput, SubscriptionResponseData } from '../subscriptions';

/**
 * Create a subscription AND kick its first billing cycle — the create-path
 * composer the API calls (keeps `subscriptions/create` free of any billing
 * dependency, so there is no submodule import cycle). A `charge_automatically`
 * subscription with no trial starts `incomplete`; we run the first cycle
 * immediately (charge now), flipping it to `active` on success or `past_due` on a
 * failed first charge. A trialing / send_invoice / zero subscription is returned
 * as created (its first charge is the trial-end / scheduler / inbound path).
 */
export async function startSubscription(
  txDb: InfraTxDb,
  ctx: DomainContext,
  input: CreateSubscriptionInput
): Promise<SubscriptionResponseData> {
  const created = await createSubscription(txDb, ctx, input);
  if (created.status === 'incomplete') {
    await runCycle(txDb, ctx, created.id);
    return getSubscriptionByReference(txDb, ctx, created.id);
  }
  return created;
}
