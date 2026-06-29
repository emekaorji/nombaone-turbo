import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@nombaone/ui/components/ui/card';

import { PageHeader } from '@/components/common/PageHeader';
import { MoneyAmount } from '@/components/common/MoneyAmount';
import { StatusPill } from '@/components/common/StatusPill';
import { requireCapability } from '@/lib/rbac';
import { getSelectedEnvironment } from '@/lib/env';
import { getDashboardStats } from '@/lib/reads';

export const metadata = { title: 'Dashboard · Nombaone Admin' };

/**
 * Operator dashboard home. Read-gated by `dashboard:read`. Shows platform
 * headline counters and a ledger zero-sum snapshot for the selected ring. The
 * environment is re-derived server-side (the cookie is a preference, not
 * authority).
 */
export default async function DashboardPage() {
  await requireCapability('dashboard:read');
  const environment = await getSelectedEnvironment();
  const stats = await getDashboardStats(environment);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Platform health at a glance for the selected environment."
        actions={<StatusPill group="environment" value={environment} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Organizations" value={stats.organizations.toLocaleString()} />
        <StatCard label="Examples (ring)" value={stats.examples.toLocaleString()} />
        <StatCard label="Operators" value={stats.operators.toLocaleString()} />
        <StatCard
          label="Ledger drift"
          value={<MoneyAmount kobo={stats.drift} />}
          hint={stats.drift === 0 ? 'Balanced' : 'Investigate'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ledger reconciliation</CardTitle>
          <CardDescription>
            Zero-sum check across every organization in the {environment} ring.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <span className="text-sm text-muted-foreground">Total debits</span>
            <MoneyAmount kobo={stats.totalDebits} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <span className="text-sm text-muted-foreground">Total credits</span>
            <MoneyAmount kobo={stats.totalCredits} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <span className="text-sm text-muted-foreground">Status</span>
            <StatusPill group="reconciliation" value={stats.drift === 0 ? 'balanced' : 'drift'} />
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent className="pt-0 text-xs text-muted-foreground">{hint}</CardContent>
      ) : null}
    </Card>
  );
}
