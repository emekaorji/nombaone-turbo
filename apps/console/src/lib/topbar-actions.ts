'use server';

import { customersTable, plansTable, pricesTable, subscriptionsTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { and, eq, ilike, or } from 'drizzle-orm';

import { getSession } from '@/lib/auth';
import { getRecentEvents, type EventRow } from '@/lib/events';

export type SearchHit = { label: string; sublabel: string; href: string; kind: 'customer' | 'plan' | 'subscription' };

export async function searchConsole(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const session = await getSession();
  if (!session) return [];

  const like = `%${q}%`;
  const [customers, plans, subs] = await Promise.all([
    db
      .select({ name: customersTable.name, email: customersTable.email, reference: customersTable.reference })
      .from(customersTable)
      .where(
        and(
          eq(customersTable.organizationId, session.organizationId),
          eq(customersTable.mode, session.mode),
          or(ilike(customersTable.name, like), ilike(customersTable.email, like), ilike(customersTable.reference, like)),
        ),
      )
      .limit(5),
    db
      .select({ name: plansTable.name, reference: plansTable.reference })
      .from(plansTable)
      .where(
        and(
          eq(plansTable.organizationId, session.organizationId),
          eq(plansTable.mode, session.mode),
          or(ilike(plansTable.name, like), ilike(plansTable.reference, like)),
        ),
      )
      .limit(5),
    db
      .select({ reference: subscriptionsTable.reference, customerName: customersTable.name, planName: plansTable.name })
      .from(subscriptionsTable)
      .innerJoin(customersTable, eq(subscriptionsTable.customerId, customersTable.id))
      .innerJoin(pricesTable, eq(subscriptionsTable.priceId, pricesTable.id))
      .innerJoin(plansTable, eq(pricesTable.planId, plansTable.id))
      .where(
        and(
          eq(subscriptionsTable.organizationId, session.organizationId),
          eq(subscriptionsTable.mode, session.mode),
          or(ilike(customersTable.name, like), ilike(subscriptionsTable.reference, like)),
        ),
      )
      .limit(5),
  ]);

  return [
    ...customers.map((c) => ({
      label: c.name || c.email,
      sublabel: c.reference,
      href: `/customers/${encodeURIComponent(c.reference)}`,
      kind: 'customer' as const,
    })),
    ...plans.map((p) => ({
      label: p.name,
      sublabel: p.reference,
      href: `/plans?plan=${encodeURIComponent(p.reference)}`,
      kind: 'plan' as const,
    })),
    ...subs.map((s) => ({
      label: `${s.customerName} · ${s.planName}`,
      sublabel: s.reference,
      href: `/subscriptions/${encodeURIComponent(s.reference)}`,
      kind: 'subscription' as const,
    })),
  ];
}

export async function getNotifications(): Promise<EventRow[]> {
  return getRecentEvents(8);
}
