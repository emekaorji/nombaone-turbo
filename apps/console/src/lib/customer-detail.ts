import { intervalLabel } from '@nombaone/core-contracts/billing';
import { creditGrantsTable, customersTable, paymentMethodsTable, pricesTable, subscriptionsTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { and, asc, desc, eq } from 'drizzle-orm';

import { getSession } from '@/lib/auth';
import { naira } from '@/lib/money';

export type SubItem = { reference: string; plan: string; status: string; mrr: string; renews: string };
export type GrantItem = { reference: string; source: string; date: string; left: string };
export type MethodItem = { reference: string; kind: string; label: string; sub: string; isDefault: boolean };

export type CustomerDetail = {
  reference: string;
  name: string;
  email: string;
  phone: string | null;
  initials: string;
  since: string;
  subs: SubItem[];
  grants: GrantItem[];
  creditAvailableKobo: number;
  methods: MethodItem[];
  status: { label: string; tone: 'success' | 'warning' | 'info' | 'muted' };
};

const fmtDate = (d: Date): string => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d);
const fmtFull = (d: Date): string =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
const initialsOf = (n: string): string =>
  n.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '·';
export async function getCustomerDetail(reference: string): Promise<CustomerDetail | null> {
  const session = await getSession();
  if (!session) return null;
  const { organizationId, mode } = session;

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(and(eq(customersTable.organizationId, organizationId), eq(customersTable.mode, mode), eq(customersTable.reference, reference)))
    .limit(1);
  if (!customer) return null;

  const [subRows, grants, methods] = await Promise.all([
    db
      .select({
        reference: subscriptionsTable.reference,
        status: subscriptionsTable.status,
        currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
        unitAmount: pricesTable.unitAmount,
        interval: pricesTable.interval,
        intervalCount: pricesTable.intervalCount,
      })
      .from(subscriptionsTable)
      .innerJoin(pricesTable, eq(pricesTable.id, subscriptionsTable.priceId))
      .where(and(eq(subscriptionsTable.organizationId, organizationId), eq(subscriptionsTable.mode, mode), eq(subscriptionsTable.customerId, customer.id)))
      .orderBy(desc(subscriptionsTable.createdAt)),
    db
      .select({ reference: creditGrantsTable.reference, source: creditGrantsTable.source, remaining: creditGrantsTable.remaining, createdAt: creditGrantsTable.createdAt, sourceReference: creditGrantsTable.sourceReference })
      .from(creditGrantsTable)
      .where(and(eq(creditGrantsTable.organizationId, organizationId), eq(creditGrantsTable.mode, mode), eq(creditGrantsTable.customerId, customer.id)))
      .orderBy(asc(creditGrantsTable.createdAt)),
    db
      .select({ reference: paymentMethodsTable.reference, kind: paymentMethodsTable.kind, status: paymentMethodsTable.status, brand: paymentMethodsTable.brand, last4: paymentMethodsTable.last4, isDefault: paymentMethodsTable.isDefault })
      .from(paymentMethodsTable)
      .where(and(eq(paymentMethodsTable.organizationId, organizationId), eq(paymentMethodsTable.mode, mode), eq(paymentMethodsTable.customerId, customer.id)))
      .orderBy(desc(paymentMethodsTable.createdAt)),
  ]);

  const statuses = subRows.map((s) => s.status);
  const status = statuses.includes('past_due')
    ? ({ label: 'At risk', tone: 'warning' } as const)
    : statuses.includes('active')
      ? ({ label: 'Healthy', tone: 'success' } as const)
      : statuses.includes('trialing')
        ? ({ label: 'Trialing', tone: 'info' } as const)
        : ({ label: 'New', tone: 'muted' } as const);

  return {
    reference: customer.reference,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    initials: initialsOf(customer.name),
    since: fmtFull(customer.createdAt),
    subs: subRows.map((s) => ({
      reference: s.reference,
      plan: `${intervalLabel(s.interval, s.intervalCount)} · ${naira(Number(s.unitAmount))}`,
      status: s.status,
      mrr: s.status === 'active' ? naira(Number(s.unitAmount)) : '—',
      renews: s.currentPeriodEnd ? `renews ${fmtDate(s.currentPeriodEnd)}` : '—',
    })),
    grants: grants
      .filter((g) => Number(g.remaining) > 0)
      .map((g) => ({
        reference: g.reference,
        source: g.sourceReference ? `${g.source} · ${g.sourceReference}` : g.source,
        date: fmtDate(g.createdAt),
        left: `${naira(Number(g.remaining))} left`,
      })),
    creditAvailableKobo: grants.reduce((a, g) => a + Number(g.remaining), 0),
    methods: methods.map((m) => ({
      reference: m.reference,
      kind: m.kind,
      label: m.brand && m.last4 ? `${m.brand} ·${m.last4}` : m.kind.replace(/_/g, ' '),
      sub: m.status.replace(/_/g, ' '),
      isDefault: m.isDefault,
    })),
    status,
  };
}
