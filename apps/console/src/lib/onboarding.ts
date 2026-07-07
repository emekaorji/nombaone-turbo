import {
  customersTable,
  invoicesTable,
  paymentMethodsTable,
  pricesTable,
  subscriptionsTable,
} from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { and, count, eq } from 'drizzle-orm';

import { getSession } from '@/lib/auth';

export type StepState = 'done' | 'current' | 'pending';
export type OnboardingStep = {
  n: number;
  title: string;
  desc: string;
  state: StepState;
  cta?: { label: string; href?: string };
};

export type OnboardingState = {
  userName: string;
  mode: 'sandbox' | 'live';
  steps: OnboardingStep[];
  doneCount: number;
  total: number;
  pct: number;
};

export async function getOnboardingState(): Promise<OnboardingState | null> {
  const session = await getSession();
  if (!session) return null;
  const org = session.organizationId;
  const mode = session.mode;
  const first = <T extends { c: number }>(rows: T[]): number => rows[0]?.c ?? 0;

  const [customers, prices, methods, subs, invoices] = await Promise.all([
    db.select({ c: count() }).from(customersTable).where(and(eq(customersTable.organizationId, org), eq(customersTable.mode, mode))).then(first),
    db.select({ c: count() }).from(pricesTable).where(and(eq(pricesTable.organizationId, org), eq(pricesTable.mode, mode))).then(first),
    db.select({ c: count() }).from(paymentMethodsTable).where(and(eq(paymentMethodsTable.organizationId, org), eq(paymentMethodsTable.mode, mode))).then(first),
    db.select({ c: count() }).from(subscriptionsTable).where(and(eq(subscriptionsTable.organizationId, org), eq(subscriptionsTable.mode, mode))).then(first),
    db.select({ c: count() }).from(invoicesTable).where(and(eq(invoicesTable.organizationId, org), eq(invoicesTable.mode, mode))).then(first),
  ]);

  const done = [customers > 0, prices > 0, methods > 0, subs > 0, invoices > 0];
  // First not-done step is "current"; the rest pending.
  const currentIdx = done.findIndex((d) => !d);
  const stateFor = (i: number): StepState => (done[i] ? 'done' : i === currentIdx ? 'current' : 'pending');

  const steps: OnboardingStep[] = [
    {
      n: 1,
      title: 'Create a customer',
      desc: customers > 0 ? `${customers} customer${customers === 1 ? '' : 's'} so far.` : 'Someone to bill — name and email.',
      state: stateFor(0),
      ...(done[0] ? {} : { cta: { label: 'Add a customer', href: '/customers' } }),
    },
    {
      n: 2,
      title: 'Create a plan and price',
      desc: prices > 0 ? `${prices} price${prices === 1 ? '' : 's'} defined.` : 'What they pay, and how often.',
      state: stateFor(1),
      ...(done[1] ? {} : { cta: { label: 'Create a plan', href: '/plans' } }),
    },
    {
      n: 3,
      title: 'Add a payment method',
      desc: 'Use a test card to stand in for a real one. No real money moves.',
      state: stateFor(2),
      ...(done[2] ? {} : { cta: { label: 'Open test instruments', href: '/developers/test' } }),
    },
    {
      n: 4,
      title: 'Start your first subscription',
      desc: 'Pick the customer, the price, and the rail.',
      state: stateFor(3),
      ...(done[3] ? {} : { cta: { label: 'Start a subscription', href: '/subscriptions' } }),
    },
    {
      n: 5,
      title: 'Watch it bill in sandbox mode',
      desc: 'Advance the clock and see the invoice, the charge, and a recovery, on real API calls.',
      state: stateFor(4),
    },
  ];

  const doneCount = done.filter(Boolean).length;
  return {
    userName: session.user.name,
    mode,
    steps,
    doneCount,
    total: steps.length,
    pct: Math.round((doneCount / steps.length) * 100),
  };
}
