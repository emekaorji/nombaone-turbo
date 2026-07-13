import { confirmInvoiceFromWebhook } from '@shared/services/billing';
import { getReconcilableInvoicesSince, type ReconcilableInvoice } from '@shared/services/invoices';
import {
  diffAgainstNomba,
  type LocalPaidInvoice,
  type NombaChargeTransaction,
} from '@shared/services/reconciliation';
import { db } from '@shared/config/db';
import { env } from '@shared/config/env';
import { availableNombaModes, getNombaClient } from '@shared/config/nomba';
import { logger } from '@shared/observability/logger';
import { recordReconcileDiscrepancy, recordReconcileHealed } from '@shared/observability/prometheus';

import type { DomainContext } from '@nombaone/sara/context';
import type { InboundVerification } from '@shared/services/billing';
import type { RequeryResult } from '@nombaone/sara/nomba';

export interface ReconcileNombaResult {
  tenants: number;
  checked: number;
  discrepancies: number;
  healed: number;
  skipped?: boolean;
}

/**
 * The nightly local↔Nomba reconcile tick (item 6). It is a BACKSTOP for the inline
 * paths (the webhook confirm + the dunning bridge): those settle in real time, this
 * catches anything a dropped/late webhook missed.
 *
 * Per environment it pulls every recently-active finalized invoice (`updated_at`
 * within the window), groups by tenant, and for each invoice **requeries Nomba**
 * (join key = our `reference`, which is the `merchantTxRef` we send). It then runs
 * the pure `diffAgainstNomba` over (locally-paid, Nomba-succeeded) and:
 *   • `settled_at_nomba_missing_locally` → **self-heal**: re-drive
 *     `confirmInvoiceFromWebhook` idempotently (requery-confirmed, E4 — only settles
 *     when Nomba's amount equals our `amount_due`, and is a no-op if already paid);
 *   • `local_paid_missing_at_nomba` / `amount_mismatch` → flag (log + metric) for
 *     human review.
 *
 * Nomba exposes only a single-transaction requery (no confirmed bulk-list endpoint —
 * a ⚠ to revisit; a `/transactions` list would let us also catch the inverse class
 * without per-invoice requeries), so we requery each recent invoice.
 */
export async function handleReconcileNomba(): Promise<ReconcileNombaResult> {
  const modes = availableNombaModes();
  if (modes.length === 0) {
    logger.info('[cron] reconcile-nomba skipped (Nomba not configured)');
    return { tenants: 0, checked: 0, discrepancies: 0, healed: 0, skipped: true };
  }

  const since = new Date(Date.now() - env.RECONCILE_NOMBA_WINDOW_HOURS * 3_600_000);
  let tenants = 0;
  let checked = 0;
  let discrepancies = 0;
  let healed = 0;

  // ONE deployment serves both modes: reconcile each mode's slice of the shared DB
  // against its OWN Nomba account (separate creds + token cache).
  for (const mode of modes) {
    const invoices = await getReconcilableInvoicesSince(db, mode, since);
    if (invoices.length === 0) {
      logger.info('[cron] reconcile-nomba: no recently-active invoices', { mode, since });
      continue;
    }

    const client = getNombaClient(mode);

    // Group by tenant so each self-heal runs under the owning org's context.
    const byOrg = new Map<string, ReconcilableInvoice[]>();
    for (const inv of invoices) {
      const list = byOrg.get(inv.organizationId) ?? [];
      list.push(inv);
      byOrg.set(inv.organizationId, list);
    }
    tenants += byOrg.size;

    for (const [organizationId, list] of byOrg) {
      const ctx: DomainContext = { organizationId, mode };
      const localPaid: LocalPaidInvoice[] = [];
      const nombaTx: NombaChargeTransaction[] = [];
      const requeries = new Map<string, RequeryResult>();

      for (const inv of list) {
        checked += 1;
        if (inv.paidLocally) localPaid.push({ reference: inv.reference, amountKobo: inv.amountDueKobo });
        try {
          // Requery by NOMBA's transaction id when the inbound path stamped one —
          // the live requery 404s on our own reference, so without the stamp this
          // backstop was inert against real Nomba. An invoice with no stamp (no
          // webhook ever named it) still tries our reference: correct in sandbox;
          // on live a 404 leaves an unpaid invoice consistent, and a paid-but-
          // stampless one flagged for a human rather than silently trusted.
          const requeryKey = inv.providerTransactionId ?? inv.reference;
          const rq = await client.requeryTransaction(ctx, { reference: requeryKey });
          requeries.set(inv.reference, rq);
          if (rq.found && rq.succeeded && typeof rq.amount === 'number') {
            nombaTx.push({ reference: inv.reference, amountKobo: rq.amount });
          }
        } catch (error) {
          // A requery failure is not a discrepancy — Nomba may be briefly down. Log and
          // move on; the next nightly run re-checks the same (still-open) invoice.
          logger.warn('[cron] reconcile-nomba requery failed', {
            mode,
            organizationId,
            reference: inv.reference,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      for (const d of diffAgainstNomba(localPaid, nombaTx)) {
        discrepancies += 1;
        recordReconcileDiscrepancy(d.class);
        logger.warn('[cron] reconcile-nomba discrepancy', { mode, organizationId, ...d });

        if (d.class === 'settled_at_nomba_missing_locally') {
          const rq = requeries.get(d.reference);
          const verification: InboundVerification = {
            status: 'settled',
            settledAmountKobo: rq?.amount ?? d.nombaKobo ?? 0,
            providerReference: rq?.providerReference,
          };
          // confirmInvoiceFromWebhook is idempotent (claim CAS) and only settles when
          // the provider-confirmed amount equals amount_due (E4); a mismatch stays flagged.
          const res = await confirmInvoiceFromWebhook(db, ctx, d.reference, verification);
          if (res.settled) {
            healed += 1;
            recordReconcileHealed();
            logger.info('[cron] reconcile-nomba self-healed invoice', {
              mode,
              organizationId,
              reference: d.reference,
            });
          }
        }
      }
    }
  }

  logger.info('[cron] reconcile-nomba ran', { tenants, checked, discrepancies, healed });
  return { tenants, checked, discrepancies, healed };
}
