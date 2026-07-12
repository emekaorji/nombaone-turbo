import { customersTable, paymentMethodsTable, plansTable, pricesTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { and, eq } from 'drizzle-orm';

import { getSession } from '@/lib/auth';
import { priceOptionLabel, type PriceOption } from '@/lib/price-options';

export type { PriceGroup, PriceOption } from '@/lib/price-options';
export type MethodOption = { reference: string; label: string; kind: string };
export type SubscriptionFormOptions = { prices: PriceOption[]; methods: MethodOption[] };
export type CustomerOption = { reference: string; name: string; email: string; methods: MethodOption[] };
export type NewSubscriptionData = { prices: PriceOption[]; customers: CustomerOption[] };

function methodLabel(kind: string, brand: string | null, last4: string | null): string {
  return kind === 'card'
    ? `${brand ?? 'Card'} ·${last4 ?? '••••'}`
    : kind === 'mandate'
      ? 'Direct debit · NIBSS'
      : 'Bank transfer';
}

/** The columns every price picker needs: the plan it belongs to (the group) and its own cadence. */
const priceOptionColumns = {
  reference: pricesTable.reference,
  unitAmount: pricesTable.unitAmount,
  interval: pricesTable.interval,
  intervalCount: pricesTable.intervalCount,
  planName: plansTable.name,
};

type PriceOptionRow = {
  reference: string;
  unitAmount: number;
  interval: PriceOption['interval'];
  intervalCount: number;
  planName: string;
};

/** A plan is a ladder now, so a price is `plan + cadence`, and the picker groups on the plan. */
const toPriceOption = (p: PriceOptionRow): PriceOption => ({
  reference: p.reference,
  planName: p.planName,
  label: priceOptionLabel(p.unitAmount, p.interval, p.intervalCount),
  interval: p.interval,
  intervalCount: p.intervalCount,
});

/** The org's active prices (no customer scope) — for the change-plan picker. */
export async function getActivePrices(): Promise<PriceOption[]> {
  const session = await getSession();
  if (!session) return [];
  const prices = await db
    .select(priceOptionColumns)
    .from(pricesTable)
    .innerJoin(plansTable, eq(pricesTable.planId, plansTable.id))
    .where(and(eq(pricesTable.organizationId, session.organizationId), eq(pricesTable.mode, session.mode), eq(pricesTable.active, true)));
  return prices.map(toPriceOption);
}

/**
 * All org customers (each with their active methods) + org-wide active prices — for the top-level
 * "New subscription" flow. Fail-soft: this only powers a secondary affordance, so a transient DB
 * blip returns empty options (button disables) rather than crashing the primary list it loads with.
 */
export async function getNewSubscriptionData(): Promise<NewSubscriptionData> {
  const session = await getSession();
  if (!session) return { prices: [], customers: [] };
  const { organizationId, mode } = session;

  try {
  const [prices, customers, methods] = await Promise.all([
    db
      .select(priceOptionColumns)
      .from(pricesTable)
      .innerJoin(plansTable, eq(pricesTable.planId, plansTable.id))
      .where(and(eq(pricesTable.organizationId, organizationId), eq(pricesTable.mode, mode), eq(pricesTable.active, true))),
    db
      .select({ reference: customersTable.reference, name: customersTable.name, email: customersTable.email })
      .from(customersTable)
      .where(and(eq(customersTable.organizationId, organizationId), eq(customersTable.mode, mode))),
    db
      .select({
        reference: paymentMethodsTable.reference,
        kind: paymentMethodsTable.kind,
        brand: paymentMethodsTable.brand,
        last4: paymentMethodsTable.last4,
        customerReference: customersTable.reference,
      })
      .from(paymentMethodsTable)
      .innerJoin(customersTable, eq(paymentMethodsTable.customerId, customersTable.id))
      .where(and(eq(paymentMethodsTable.organizationId, organizationId), eq(paymentMethodsTable.mode, mode), eq(paymentMethodsTable.status, 'active'))),
  ]);

  const methodsByCustomer = new Map<string, MethodOption[]>();
  for (const m of methods) {
    const list = methodsByCustomer.get(m.customerReference) ?? [];
    list.push({ reference: m.reference, kind: m.kind, label: methodLabel(m.kind, m.brand, m.last4) });
    methodsByCustomer.set(m.customerReference, list);
  }

  return {
    prices: prices.map(toPriceOption),
    customers: customers.map((c) => ({ reference: c.reference, name: c.name, email: c.email, methods: methodsByCustomer.get(c.reference) ?? [] })),
  };
  } catch {
    return { prices: [], customers: [] };
  }
}

export async function getSubscriptionFormOptions(customerReference: string): Promise<SubscriptionFormOptions> {
  const session = await getSession();
  if (!session) return { prices: [], methods: [] };
  const { organizationId, mode } = session;

  const [prices, methods] = await Promise.all([
    db
      .select(priceOptionColumns)
      .from(pricesTable)
      .innerJoin(plansTable, eq(pricesTable.planId, plansTable.id))
      .where(and(eq(pricesTable.organizationId, organizationId), eq(pricesTable.mode, mode), eq(pricesTable.active, true))),
    db
      .select({
        reference: paymentMethodsTable.reference,
        kind: paymentMethodsTable.kind,
        brand: paymentMethodsTable.brand,
        last4: paymentMethodsTable.last4,
      })
      .from(paymentMethodsTable)
      .innerJoin(customersTable, eq(paymentMethodsTable.customerId, customersTable.id))
      .where(
        and(
          eq(paymentMethodsTable.organizationId, organizationId),
          eq(paymentMethodsTable.mode, mode),
          eq(customersTable.reference, customerReference),
          eq(paymentMethodsTable.status, 'active'),
        ),
      ),
  ]);

  return {
    prices: prices.map(toPriceOption),
    methods: methods.map((m) => ({ reference: m.reference, kind: m.kind, label: methodLabel(m.kind, m.brand, m.last4) })),
  };
}
