import { creditGrantsTable, customersTable, pricesTable, subscriptionsTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { and, desc, eq } from 'drizzle-orm';

import { getSession } from '@/lib/auth';
import { naira } from '@/lib/money';
import { toMonthlyKobo } from '@nombaone/core-contracts/billing';

export type CustomerHealth = 'healthy' | 'at_risk' | 'delinquent' | 'trialing' | 'new';

export type CustomerListItem = {
  reference: string;
  name: string;
  email: string;
  active: number;
  total: number;
  mrr: string | null;
  credit: string | null;
  health: CustomerHealth;
  joined: string;
  createdAt: string; // ISO — serializable to the client
};

export type CustomersView = {
  items: CustomerListItem[];
  stats: { total: number; newThisMonth: number; withActiveSubs: number; creditOutstandingKobo: number };
};

export type CustomerSortKey = 'mrr' | 'newest' | 'name' | 'credit';
/** Sort options for the list. Default = MRR (per design). */
export const CUSTOMER_SORTS: { key: CustomerSortKey; label: string }[] = [
  { key: 'mrr', label: 'MRR' },
  { key: 'newest', label: 'Newest' },
  { key: 'name', label: 'Name' },
  { key: 'credit', label: 'Credit balance' },
];

const fmtDate = (d: Date): string => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d);

const EMPTY: CustomersView = {
  items: [],
  stats: { total: 0, newThisMonth: 0, withActiveSubs: 0, creditOutstandingKobo: 0 },
};

/**
 * The customers list, scoped to the session's organization + mode (the isolation
 * invariant — every domain row carries both, and the app filters explicitly
 * because RLS is dormant). Derived columns are computed from REAL joins: active/
 * total subs, credit-outstanding. MRR needs the price-resolution join built for
 * the subscriptions surface, so it renders "—" honestly until then, never faked.
 */
export async function listCustomers(sort: CustomerSortKey = 'mrr'): Promise<CustomersView> {
  const session = await getSession();
  if (!session) return EMPTY;
  const { organizationId, mode } = session;

  const [customers, subs, credits] = await Promise.all([
    db
      .select()
      .from(customersTable)
      .where(and(eq(customersTable.organizationId, organizationId), eq(customersTable.mode, mode)))
      .orderBy(desc(customersTable.createdAt)),
    db
      .select({
        customerId: subscriptionsTable.customerId,
        status: subscriptionsTable.status,
        unitAmount: pricesTable.unitAmount,
        interval: pricesTable.interval,
        intervalCount: pricesTable.intervalCount,
      })
      .from(subscriptionsTable)
      .innerJoin(pricesTable, eq(subscriptionsTable.priceId, pricesTable.id))
      .where(and(eq(subscriptionsTable.organizationId, organizationId), eq(subscriptionsTable.mode, mode))),
    db
      .select({ customerId: creditGrantsTable.customerId, remaining: creditGrantsTable.remaining })
      .from(creditGrantsTable)
      .where(and(eq(creditGrantsTable.organizationId, organizationId), eq(creditGrantsTable.mode, mode))),
  ]);

  const statusesByCustomer = new Map<string, string[]>();
  const mrrByCustomer = new Map<string, number>();
  for (const s of subs) {
    const arr = statusesByCustomer.get(s.customerId) ?? [];
    arr.push(s.status);
    statusesByCustomer.set(s.customerId, arr);
    // MRR = active subscriptions only, each normalized to monthly kobo.
    if (s.status === 'active') {
      mrrByCustomer.set(s.customerId, (mrrByCustomer.get(s.customerId) ?? 0) + toMonthlyKobo(s.unitAmount, s.interval, s.intervalCount));
    }
  }
  const creditByCustomer = new Map<string, number>();
  for (const c of credits) {
    creditByCustomer.set(c.customerId, (creditByCustomer.get(c.customerId) ?? 0) + Number(c.remaining));
  }

  const now = new Date();
  const built = customers.map((c) => {
    const statuses = statusesByCustomer.get(c.id) ?? [];
    const creditKobo = creditByCustomer.get(c.id) ?? 0;
    const mrrKobo = mrrByCustomer.get(c.id) ?? 0;
    const health: CustomerHealth = statuses.includes('past_due')
      ? 'at_risk'
      : statuses.includes('active')
        ? 'healthy'
        : statuses.includes('trialing')
          ? 'trialing'
          : 'new';
    const item: CustomerListItem = {
      reference: c.reference,
      name: c.name,
      email: c.email,
      active: statuses.filter((s) => s === 'active').length,
      total: statuses.length,
      mrr: mrrKobo > 0 ? naira(mrrKobo) : null,
      credit: creditKobo > 0 ? naira(creditKobo) : null,
      health,
      joined: fmtDate(c.createdAt),
      createdAt: c.createdAt.toISOString(),
    };
    return { item, mrrKobo, creditKobo, createdAt: c.createdAt.getTime(), name: c.name };
  });

  // `customers` arrives createdAt-desc, so index preserves "newest".
  built.sort((a, b) => {
    if (sort === 'newest') return b.createdAt - a.createdAt;
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'credit') return b.creditKobo - a.creditKobo || b.mrrKobo - a.mrrKobo;
    return b.mrrKobo - a.mrrKobo || b.createdAt - a.createdAt; // mrr (default)
  });
  const items: CustomerListItem[] = built.map((x) => x.item);

  return {
    items,
    stats: {
      total: items.length,
      newThisMonth: customers.filter(
        (c) => c.createdAt.getUTCFullYear() === now.getUTCFullYear() && c.createdAt.getUTCMonth() === now.getUTCMonth(),
      ).length,
      withActiveSubs: items.filter((i) => i.active > 0).length,
      creditOutstandingKobo: [...creditByCustomer.values()].reduce((a, b) => a + b, 0),
    },
  };
}
