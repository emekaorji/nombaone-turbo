import { and, eq, gt, inArray, isNotNull, lte, or, isNull, sql } from 'drizzle-orm';

import {
  customersTable,
  plansTable,
  pricesTable,
  subscriptionsTable,
} from '@nombaone/core-db/schema';
import { cadenceApproxMs } from '@nombaone/core-contracts/billing';
import { getOrgBillingSettings } from '@nombaone/sara/org';

import { enqueueCustomerEmail } from '@shared/services/comms';
import { db } from '@shared/config/db';
import { env } from '@shared/config/env';
import { logger } from '@shared/observability/logger';

import type { DomainContext, Mode } from '@nombaone/sara/context';

export interface RenewalReminderResult {
  scanned: number;
  reminded: number;
}

/**
 * The "you will be billed soon" tick — the user's line 10a, verbatim: warn the
 * subscriber `lead` before the charge (a day for a monthly plan, ~a minute for
 * a `minute × 10` one, because the lead is CAPPED at one period length).
 *
 * Selection: active/trialing `charge_automatically` subs whose `next_billing_at`
 * falls inside `[now, now + lead]` and whose `reminder_sent_for_index` has not
 * yet stamped the period about to bill. The stamp is CAS-written, so a racing
 * tick reminds at most once. send_invoice subs are skipped — their actionable
 * email is the invoice link at issue time, not a heads-up.
 */
export async function handleRenewalReminder(): Promise<RenewalReminderResult> {
  let scanned = 0;
  let reminded = 0;

  for (const mode of ['sandbox', 'live'] as Mode[]) {
    // Widest possible lead first (24h default ceiling); the per-org lead narrows below.
    const horizon = new Date(Date.now() + 24 * 3_600_000);
    const candidates = await db
      .select({
        id: subscriptionsTable.id,
        organizationId: subscriptionsTable.organizationId,
        currentPeriodIndex: subscriptionsTable.currentPeriodIndex,
        nextBillingAt: subscriptionsTable.nextBillingAt,
        reminderSentForIndex: subscriptionsTable.reminderSentForIndex,
        customerEmail: customersTable.email,
        interval: pricesTable.interval,
        intervalCount: pricesTable.intervalCount,
        unitAmount: pricesTable.unitAmount,
        planName: plansTable.name,
      })
      .from(subscriptionsTable)
      .innerJoin(customersTable, eq(customersTable.id, subscriptionsTable.customerId))
      .innerJoin(pricesTable, eq(pricesTable.id, subscriptionsTable.priceId))
      .innerJoin(plansTable, eq(plansTable.id, pricesTable.planId))
      .where(
        and(
          eq(subscriptionsTable.mode, mode),
          inArray(subscriptionsTable.status, ['active', 'trialing']),
          eq(subscriptionsTable.collectionMethod, 'charge_automatically'),
          isNotNull(subscriptionsTable.nextBillingAt),
          gt(subscriptionsTable.nextBillingAt, new Date()),
          lte(subscriptionsTable.nextBillingAt, horizon),
          or(
            isNull(subscriptionsTable.reminderSentForIndex),
            sql`${subscriptionsTable.reminderSentForIndex} < ${subscriptionsTable.currentPeriodIndex}`
          )
        )
      )
      .limit(env.BILLING_BATCH_SIZE);

    for (const sub of candidates) {
      scanned += 1;
      const ctx: DomainContext = { organizationId: sub.organizationId, mode };
      try {
        const settings = await getOrgBillingSettings(db, ctx);
        // The lead never exceeds one period — reminding a 10-minute plan a day
        // early is noise about a charge that hasn't even accrued yet.
        const periodMs = cadenceApproxMs(sub.interval, sub.intervalCount);
        const leadMs = Math.min(settings.renewalReminderLeadHours * 3_600_000, periodMs);
        if (!sub.nextBillingAt || sub.nextBillingAt.getTime() > Date.now() + leadMs) continue;

        // CAS the stamp BEFORE mailing: at most one reminder per period, even
        // across racing ticks. Losing the race means someone else reminded.
        const [claimed] = await db
          .update(subscriptionsTable)
          .set({ reminderSentForIndex: sub.currentPeriodIndex })
          .where(
            and(
              eq(subscriptionsTable.id, sub.id),
              or(
                isNull(subscriptionsTable.reminderSentForIndex),
                sql`${subscriptionsTable.reminderSentForIndex} < ${sub.currentPeriodIndex}`
              )
            )
          )
          .returning({ id: subscriptionsTable.id });
        if (!claimed) continue;

        await enqueueCustomerEmail(db, ctx, {
          template: 'renewal_upcoming',
          to: sub.customerEmail,
          dedupeKey: `${sub.id}:${sub.currentPeriodIndex}`,
          data: {
            amountKobo: sub.unitAmount,
            planName: sub.planName,
            renewsAt: sub.nextBillingAt.toISOString(),
          },
        });
        reminded += 1;
      } catch (error) {
        logger.warn('[cron] renewal-reminder failed for subscription', {
          mode,
          subscriptionId: sub.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  if (reminded > 0) logger.info('[cron] renewal-reminder ran', { scanned, reminded });
  return { scanned, reminded };
}
