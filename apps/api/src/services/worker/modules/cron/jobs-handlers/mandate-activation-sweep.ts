import { pollMandateActive, selectPendingMandates } from '@nombaone/sara/payment-methods';

import { db } from '@shared/config/db';
import { env } from '@shared/config/env';
import { availableNombaModes, getNombaClient } from '@shared/config/nomba';
import { logger } from '@shared/observability/logger';

import type { DomainContext } from '@nombaone/sara/context';

export interface MandateActivationResult {
  checked: number;
  activated: number;
  skipped?: boolean;
}

/**
 * Direct-debit mandate activation sweep. A NIBSS e-mandate has NO consent webhook —
 * after the customer completes the ₦50 validation, the mandate flips to ACTIVE on
 * Nomba's side silently. This tick polls each `consent_pending` mandate's status and
 * promotes it (idempotent: `pollMandateActive` only flips to `active` on ACTIVE +
 * ADVICE_SENT and emits `payment_method.updated` once; a poll failure is not fatal,
 * the next tick retries). ONE deployment serves both modes, so it runs per mode that
 * has a usable Nomba client; skips entirely when no mode is configured.
 */
export async function handleMandateActivationSweep(): Promise<MandateActivationResult> {
  const modes = availableNombaModes();
  if (modes.length === 0) {
    logger.info('[cron] mandate-activation-sweep skipped (Nomba not configured)');
    return { checked: 0, activated: 0, skipped: true };
  }

  let checked = 0;
  let activated = 0;

  for (const mode of modes) {
    const pending = await selectPendingMandates(db, mode, env.BILLING_BATCH_SIZE);
    if (pending.length === 0) continue;

    const client = getNombaClient(mode);
    for (const mandate of pending) {
      checked += 1;
      const ctx: DomainContext = { organizationId: mandate.organizationId, mode };
      try {
        const method = await pollMandateActive(client, db, ctx, { reference: mandate.reference });
        if (method.status === 'active') activated += 1;
      } catch (error) {
        logger.warn('[cron] mandate-activation-sweep poll failed', {
          mode,
          organizationId: mandate.organizationId,
          reference: mandate.reference,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  logger.info('[cron] mandate-activation-sweep ran', { checked, activated });
  return { checked, activated };
}
