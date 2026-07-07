import { customersTable, paymentMethodsTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { and, desc, eq } from 'drizzle-orm';

import { getSession } from '@/lib/auth';

import type { Rail } from '@/components/console/rail-badge';

export type MethodStatus = 'active' | 'expired' | 'consent_pending' | 'setup_pending' | 'removed';
export type MethodRow = {
  reference: string;
  customer: string;
  kind: 'card' | 'mandate' | 'virtual_account';
  method: string;
  sub: string;
  rail: Rail;
  status: MethodStatus;
  def: boolean;
  added: string;
};

export type RailCard = {
  kind: 'card' | 'mandate' | 'virtual_account';
  name: string;
  activeCount: number;
  detail: string;
  chip: { text: string; tone: 'success' | 'warning' | 'info' | 'danger' };
  note: string;
};

export type PaymentsView = {
  rails: RailCard[];
  methods: MethodRow[];
  totalMethods: number;
};

const RAIL_BY_KIND: Record<string, Rail> = { card: 'card', mandate: 'ddebit', virtual_account: 'transfer' };

const NOTE: Record<string, string> = {
  card: 'Best-effort recharge. When the bank forces OTP, we fall back to a checkout link.',
  mandate: 'NIBSS mandate pulls on payday. No customer action once consent is granted.',
  virtual_account: 'Push payments reconciled to the kobo against Nomba.',
};

function shortDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function statusOf(s: string): MethodStatus {
  switch (s) {
    case 'active':
    case 'expired':
    case 'consent_pending':
    case 'setup_pending':
    case 'removed':
      return s;
    default:
      return 'setup_pending';
  }
}

function emptyRails(): RailCard[] {
  return [
    { kind: 'card', name: 'Card', activeCount: 0, detail: 'No cards on file yet', chip: { text: 'No cards yet', tone: 'info' }, note: NOTE.card },
    { kind: 'mandate', name: 'Direct debit', activeCount: 0, detail: 'No mandates yet', chip: { text: 'No mandates yet', tone: 'info' }, note: NOTE.mandate },
    { kind: 'virtual_account', name: 'Bank transfer', activeCount: 0, detail: 'No virtual accounts yet', chip: { text: 'No accounts yet', tone: 'info' }, note: NOTE.virtual_account },
  ];
}

export async function getPaymentsView(): Promise<PaymentsView> {
  const session = await getSession();
  if (!session) return { rails: emptyRails(), methods: [], totalMethods: 0 };

  const rows = await db
    .select({
      reference: paymentMethodsTable.reference,
      kind: paymentMethodsTable.kind,
      status: paymentMethodsTable.status,
      brand: paymentMethodsTable.brand,
      last4: paymentMethodsTable.last4,
      expMonth: paymentMethodsTable.expMonth,
      expYear: paymentMethodsTable.expYear,
      accountRef: paymentMethodsTable.accountRef,
      isDefault: paymentMethodsTable.isDefault,
      createdAt: paymentMethodsTable.createdAt,
      customerName: customersTable.name,
      customerEmail: customersTable.email,
    })
    .from(paymentMethodsTable)
    .innerJoin(customersTable, eq(paymentMethodsTable.customerId, customersTable.id))
    .where(
      and(eq(paymentMethodsTable.organizationId, session.organizationId), eq(paymentMethodsTable.mode, session.mode)),
    )
    .orderBy(desc(paymentMethodsTable.createdAt));

  if (rows.length === 0) return { rails: emptyRails(), methods: [], totalMethods: 0 };

  const tally = {
    card: { active: 0, needUpdate: 0, total: 0 },
    mandate: { active: 0, pending: 0, total: 0 },
    virtual_account: { active: 0, pending: 0, total: 0 },
  };

  const methods: MethodRow[] = rows.map((r) => {
    const status = statusOf(r.status);
    const t = tally[r.kind];
    t.total += 1;
    if (status === 'active') t.active += 1;
    if (r.kind === 'card' && (status === 'expired' || status === 'setup_pending')) tally.card.needUpdate += 1;
    if (r.kind !== 'card' && (status === 'consent_pending' || status === 'setup_pending')) {
      (tally[r.kind] as { pending: number }).pending += 1;
    }

    let method: string;
    let sub: string;
    if (r.kind === 'card') {
      method = `${r.brand ?? 'Card'} ·${r.last4 ?? '••••'}`;
      sub = r.expMonth && r.expYear ? `exp ${String(r.expMonth).padStart(2, '0')}/${String(r.expYear).slice(-2)}` : 'card on file';
    } else if (r.kind === 'mandate') {
      method = 'NIBSS mandate';
      sub = status === 'active' ? 'pull on payday' : 'awaiting consent';
    } else {
      method = `Virtual account${r.accountRef ? ` ·${r.accountRef.slice(-4)}` : ''}`;
      sub = 'dedicated · push to pay';
    }

    return {
      reference: r.reference,
      customer: r.customerName ?? r.customerEmail,
      kind: r.kind,
      method,
      sub,
      rail: RAIL_BY_KIND[r.kind],
      status,
      def: r.isDefault,
      added: shortDate(r.createdAt),
    };
  });

  const rails: RailCard[] = [
    {
      kind: 'card',
      name: 'Card',
      activeCount: tally.card.active,
      detail: `${tally.card.active} active${tally.card.needUpdate > 0 ? ` · ${tally.card.needUpdate} need update` : ''}`,
      chip:
        tally.card.needUpdate > 0
          ? { text: `${tally.card.needUpdate} need update`, tone: 'warning' }
          : { text: 'OTP on recharge', tone: 'warning' },
      note: NOTE.card,
    },
    {
      kind: 'mandate',
      name: 'Direct debit',
      activeCount: tally.mandate.active,
      detail: `${tally.mandate.active} active${tally.mandate.pending > 0 ? ` · ${tally.mandate.pending} pending consent` : ''}`,
      chip:
        tally.mandate.pending > 0
          ? { text: `${tally.mandate.pending} pending`, tone: 'warning' }
          : { text: 'Healthy', tone: 'success' },
      note: NOTE.mandate,
    },
    {
      kind: 'virtual_account',
      name: 'Bank transfer',
      activeCount: tally.virtual_account.active,
      detail: `${tally.virtual_account.active} active${tally.virtual_account.pending > 0 ? ` · ${tally.virtual_account.pending} pending` : ''}`,
      chip: { text: 'Reconciled', tone: 'info' },
      note: NOTE.virtual_account,
    },
  ];

  return { rails, methods, totalMethods: methods.length };
}
