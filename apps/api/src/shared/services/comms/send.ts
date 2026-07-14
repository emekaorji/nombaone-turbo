import { getOrgBillingSettings } from '@nombaone/sara/org';
import { enqueueComms, type CommsJobData } from '@nombaone/queue';

import { logger } from '@shared/observability/logger';

import type { DomainContext, InfraTxScope } from '@nombaone/sara/context';

/**
 * Enqueue one end-customer email — the ONLY way the money path talks to mail.
 *
 * Fire-and-forget by design: the enqueue happens after the money decision, a
 * queue failure is logged and swallowed (a charge must never fail because Redis
 * hiccuped on a mail job), and the actual SMTP happens in the comms worker with
 * BullMQ retries. Gated on the tenant's `commsEnabled` — which, as of this
 * subsystem, finally means what the console always claimed it meant ("send
 * dunning emails"); before, it only gated merchant webhooks.
 */
export async function enqueueCustomerEmail(
  db: InfraTxScope,
  ctx: DomainContext,
  input: {
    template: CommsJobData['template'];
    to: string;
    dedupeKey: string;
    data: Record<string, unknown>;
  }
): Promise<void> {
  if (!input.to) return;
  try {
    const settings = await getOrgBillingSettings(db, ctx);
    if (!settings.commsEnabled) return;

    await enqueueComms(
      {
        organizationId: ctx.organizationId,
        mode: ctx.mode,
        template: input.template,
        to: input.to,
        data: input.data,
      },
      input.dedupeKey
    );
  } catch (error) {
    logger.warn('[comms] enqueue failed (money path unaffected)', {
      template: input.template,
      dedupeKey: input.dedupeKey,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
