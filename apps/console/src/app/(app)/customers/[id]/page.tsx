export const dynamic = 'force-dynamic';

import { CreditCard, Landmark } from 'lucide-react';
import { notFound } from 'next/navigation';

import { can, type OrgUserRole } from '@nombaone/sara/auth';

import { AddCreditButton } from '@/components/console/customers/add-credit-button';
import { CustomerActions } from '@/components/console/customers/customer-actions';
import { AttachTestMethodButton, NewSubscriptionButton } from '@/components/console/customers/engine-buttons';
import { GrantVoidButton } from '@/components/console/customers/grant-void-button';
import { MethodActions } from '@/components/console/customers/method-actions';
import { getSession } from '@/lib/auth';
import { getCustomerDetail } from '@/lib/customer-detail';
import { getSubscriptionFormOptions } from '@/lib/subscription-form';
import { naira } from '@/lib/money';

function CardShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-border bg-surface-1 ${className}`}>{children}</div>;
}

const statusTone: Record<string, string> = {
  success: 'text-success',
  warning: 'text-warning',
  info: 'text-info',
  muted: 'text-muted-foreground',
};

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ref = decodeURIComponent(id);
  const [c, session, formOptions] = await Promise.all([getCustomerDetail(ref), getSession(), getSubscriptionFormOptions(ref)]);
  if (!c) notFound();
  const canManageMoney = session ? can(session.user.role as OrgUserRole, 'money:write') : false;
  const isSandbox = session?.mode === 'sandbox';

  return (
    <div className="flex h-full flex-col gap-3.5 px-4 py-4 lg:gap-[18px] lg:px-7 lg:py-[22px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[15px] font-medium text-muted-foreground">
            {c.initials}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate text-[22px] font-semibold tracking-[-0.3px] text-foreground">{c.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              <span className="truncate">{c.email}</span>
              {c.phone ? (
                <>
                  <span className="text-subtle-foreground">·</span>
                  <span>{c.phone}</span>
                </>
              ) : null}
              <span className="text-subtle-foreground">·</span>
              <span className="font-mono text-[12px] text-subtle-foreground">{c.reference}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <NewSubscriptionButton
            customerReference={c.reference}
            canManage={canManageMoney}
            prices={formOptions.prices}
            methods={formOptions.methods}
          />
          <CustomerActions customerReference={c.reference} name={c.name} phone={c.phone} canManage={canManageMoney} />
        </div>
      </div>

      {/* Columns */}
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] lg:flex-row">
        {/* Left */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Subscriptions */}
          <CardShell className="flex flex-col p-4">
            <div className="flex items-center justify-between pb-2">
              <span className="text-[14px] font-semibold text-foreground">Subscriptions</span>
              <span className="text-[12px] text-subtle-foreground">{c.subs.length} total</span>
            </div>
            {c.subs.length === 0 ? (
              <p className="py-6 text-center text-[12.5px] text-muted-foreground">No subscriptions yet.</p>
            ) : (
              c.subs.map((s, i) => (
                <div
                  key={s.reference}
                  className={`flex items-center gap-3.5 px-0.5 py-[11px] ${i < c.subs.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[13.5px] font-medium text-foreground">{s.plan}</span>
                    <span className="truncate font-mono text-[11px] text-subtle-foreground">{s.reference}</span>
                  </div>
                  <span className="w-[86px] text-right font-mono text-[13px] text-foreground">{s.mrr}</span>
                  <span className="w-[110px] text-[12px] text-muted-foreground">{s.renews}</span>
                </div>
              ))
            )}
          </CardShell>

          {/* Activity — domain-event feed is engine output; honest empty for now */}
          <CardShell className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 p-4 text-center">
            <span className="text-[13.5px] font-medium text-foreground">No activity yet</span>
            <span className="text-[12px] text-muted-foreground">
              Events for this customer appear here as they bill and pay.
            </span>
          </CardShell>
        </div>

        {/* Right */}
        <div className="flex w-full flex-col gap-4 lg:w-[344px] lg:shrink-0">
          {/* Details */}
          <CardShell className="flex flex-col gap-3 p-4">
            <span className="text-[13px] font-semibold text-foreground">Details</span>
            <div className="flex flex-col">
              {[
                { label: 'Status', value: c.status.label, tone: c.status.tone },
                { label: 'Customer since', value: c.since },
                { label: 'Subscriptions', value: String(c.subs.length) },
                { label: 'Currency', value: 'NGN' },
              ].map((f, i, arr) => (
                <div
                  key={f.label}
                  className={`flex items-center justify-between py-2 ${i < arr.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <span className="text-[12.5px] text-subtle-foreground">{f.label}</span>
                  <span className={`text-[12.5px] font-medium ${'tone' in f ? statusTone[f.tone as string] : 'text-foreground'}`}>
                    {f.value}
                  </span>
                </div>
              ))}
            </div>
          </CardShell>

          {/* Account credit */}
          <CardShell className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-foreground">Account credit</span>
              <AddCreditButton customerReference={c.reference} canManage={canManageMoney} />
            </div>
            <div className="flex items-baseline justify-end gap-2">
              <span className="text-[26px] font-semibold tracking-[-0.4px] text-accent">{naira(c.creditAvailableKobo)}</span>
              <span className="text-[12.5px] text-muted-foreground">available</span>
            </div>
            {c.grants.length > 0 ? (
              <>
                <span className="font-mono text-[10.5px] tracking-[0.4px] text-subtle-foreground">GRANTS · OLDEST FIRST</span>
                <div className="flex flex-col">
                  {c.grants.map((g) => (
                    <div
                      key={g.reference}
                      className="flex items-center justify-between gap-2 border-b border-border py-2 last:border-b-0"
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-[12.5px] capitalize text-foreground">{g.source}</span>
                        <span className="text-[11px] text-subtle-foreground">{g.date}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5">
                        <span className="font-mono text-[12.5px] text-foreground">{g.left}</span>
                        <GrantVoidButton grantReference={g.reference} customerReference={c.reference} canManage={canManageMoney} />
                      </div>
                    </div>
                  ))}
                </div>
                <span className="text-[11px] text-subtle-foreground">Applied oldest first to future invoices.</span>
              </>
            ) : (
              <span className="text-[11.5px] text-subtle-foreground">No credit granted.</span>
            )}
          </CardShell>

          {/* Payment methods */}
          <CardShell className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-foreground">Payment methods</span>
              <AttachTestMethodButton customerReference={c.reference} canManage={canManageMoney} isSandbox={isSandbox} />
            </div>
            {c.methods.length === 0 ? (
              <span className="text-[11.5px] text-subtle-foreground">No payment methods on file.</span>
            ) : (
              <div className="flex flex-col">
                {c.methods.map((m) => (
                  <div
                    key={m.reference}
                    className="flex items-center gap-[11px] border-b border-border py-[9px] last:border-b-0"
                  >
                    {m.kind === 'card' ? (
                      <CreditCard className="size-[17px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    ) : (
                      <Landmark className="size-[17px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[13px] font-medium capitalize text-foreground">{m.label}</span>
                      <span className="truncate text-[11px] capitalize text-subtle-foreground">{m.sub}</span>
                    </div>
                    <MethodActions methodReference={m.reference} customerReference={c.reference} isDefault={m.isDefault} canManage={canManageMoney} />
                  </div>
                ))}
              </div>
            )}
          </CardShell>
        </div>
      </div>
    </div>
  );
}
