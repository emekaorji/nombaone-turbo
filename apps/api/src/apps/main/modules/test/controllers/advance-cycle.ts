import { AppError, NOMBAONE_ERROR_CODES } from '@nombaone/errors';
import { runCycle } from '@shared/services/billing';
import { getInvoiceByReference } from '@shared/services/invoices';
import { getSubscriptionByReference } from '@shared/services/subscriptions';

import { db } from '@shared/config/db';
import { env } from '@shared/config/env';
import { jsonHandler } from '@shared/http';

import type { AdvanceCycleResponseData } from '@nombaone/core-contracts/types';
import type { DomainContext } from '@nombaone/sara/context';
import type { RequestHandler } from 'express';

const ADVANCEABLE = new Set(['active', 'trialing']);

/**
 * POST /v1/sandbox/subscriptions/{id}/advance-cycle — force the subscription's next
 * billing cycle NOW (test deployments only), so a developer never waits on the
 * cron. Calls `runCycle` directly (clock-independent). Billing is exactly-once
 * PER PERIOD: while a period's invoice is unpaid a repeat call returns that same
 * invoice and never posts a second charge; once it is paid the subscription has
 * advanced, so the next call bills the FOLLOWING period (one call ⇒ one cycle).
 * Restricted to billable states to match the production sweep.
 */
export const advanceCycleController: RequestHandler = jsonHandler<AdvanceCycleResponseData>(
  async (req) => {
    if (!req.apiKey) throw AppError.Unauthorized('API key required');
    const ctx: DomainContext = {
      organizationId: req.apiKey.organizationId,
      mode: req.apiKey.mode,
    };
    // Defence in depth — the router is also only mounted on a test deployment.
    // advance-cycle bills a real cycle, so it must never run outside test.
    if (ctx.mode !== 'sandbox') {
      throw AppError.Forbidden(
        'The test clock is only available in sandbox mode',
        undefined,
        NOMBAONE_ERROR_CODES.CLIENT_FORBIDDEN
      );
    }
    const subscriptionId = req.params.id ?? '';

    const sub = await getSubscriptionByReference(db, ctx, subscriptionId);
    if (!ADVANCEABLE.has(sub.status)) {
      throw AppError.UnprocessableEntity(
        `Cannot advance a subscription in status "${sub.status}"; only active or trialing subscriptions bill a cycle.`,
        { status: sub.status },
        NOMBAONE_ERROR_CODES.SUBSCRIPTION_ILLEGAL_TRANSITION
      );
    }

    const result = await runCycle(db, ctx, subscriptionId, {
      maxCatchUpPeriods: env.BILLING_MAX_CATCH_UP_PERIODS,
    });
    const invoice = await getInvoiceByReference(db, ctx, result.invoice.reference);

    return {
      data: { domain: 'advance_cycle_result', subscriptionId, outcome: result.outcome, invoice },
      statusCode: 201,
    };
  }
);
