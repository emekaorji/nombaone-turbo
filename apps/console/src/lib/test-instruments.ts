import { customersTable, subscriptionsTable, plansTable, pricesTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { and, desc, eq, inArray } from 'drizzle-orm';

import { getSession } from '@/lib/auth';

export type TestOption = { reference: string; label: string };
export type TestInstrumentData = {
  customers: TestOption[];
  subscriptions: TestOption[];
  eventTypes: string[];
};

/** A curated set of catalog events the simulate instrument can emit. */
export const SIMULATE_EVENT_TYPES = [
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.finalized',
  'subscription.created',
  'subscription.updated',
  'customer.updated',
  'settlement.payout_created',
];

export async function getTestInstrumentData(): Promise<TestInstrumentData> {
  const session = await getSession();
  if (!session) return { customers: [], subscriptions: [], eventTypes: SIMULATE_EVENT_TYPES };
  const { organizationId, mode } = session;

  const [customers, subs] = await Promise.all([
    db
      .select({ reference: customersTable.reference, name: customersTable.name, email: customersTable.email })
      .from(customersTable)
      .where(and(eq(customersTable.organizationId, organizationId), eq(customersTable.mode, mode)))
      .orderBy(desc(customersTable.createdAt))
      .limit(50),
    db
      .select({
        reference: subscriptionsTable.reference,
        status: subscriptionsTable.status,
        planName: plansTable.name,
        customerName: customersTable.name,
        customerEmail: customersTable.email,
      })
      .from(subscriptionsTable)
      .innerJoin(customersTable, eq(subscriptionsTable.customerId, customersTable.id))
      .innerJoin(pricesTable, eq(subscriptionsTable.priceId, pricesTable.id))
      .innerJoin(plansTable, eq(pricesTable.planId, plansTable.id))
      .where(
        and(
          eq(subscriptionsTable.organizationId, organizationId),
          eq(subscriptionsTable.mode, mode),
          inArray(subscriptionsTable.status, ['active', 'trialing']),
        ),
      )
      .orderBy(desc(subscriptionsTable.createdAt))
      .limit(50),
  ]);

  return {
    customers: customers.map((c) => ({ reference: c.reference, label: c.name || c.email })),
    subscriptions: subs.map((s) => ({
      reference: s.reference,
      label: `${s.customerName ?? s.customerEmail} · ${s.planName}`,
    })),
    eventTypes: SIMULATE_EVENT_TYPES,
  };
}
