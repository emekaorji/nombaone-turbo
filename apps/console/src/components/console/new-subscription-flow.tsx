'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';

import { createSubscriptionPickCustomerAction, type EngineActionState } from '@/lib/engine-actions';
import type { NewSubscriptionData } from '@/lib/subscription-form';

const initial: EngineActionState = {};
const inputCls = 'rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border';
const cancelCls = 'rounded border border-border-strong bg-surface-2 px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-3';
const submitCls = 'rounded bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50';

/**
 * Top-level "New subscription" — a self-contained customer→price→method→trial flow used from
 * Overview and the Subscriptions list, where no customer is pre-selected. Methods filter to the
 * chosen customer. Delegates to the same bridge-backed action as the customer-detail flow.
 */
export function NewSubscriptionFlow({
  canManage,
  data,
  triggerClassName,
  label = 'New subscription',
  iconClassName = 'size-4',
}: {
  canManage: boolean;
  data: NewSubscriptionData;
  triggerClassName: string;
  label?: string;
  iconClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [customerRef, setCustomerRef] = useState(data.customers[0]?.reference ?? '');
  const [state, formAction, pending] = useActionState(createSubscriptionPickCustomerAction, initial);
  const router = useRouter();

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    const t = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(t);
  }, [state.ok, router]);

  const methods = useMemo(
    () => data.customers.find((c) => c.reference === customerRef)?.methods ?? [],
    [data.customers, customerRef],
  );

  const disabledReason = !canManage
    ? 'Only owners can start subscriptions'
    : data.customers.length === 0
      ? 'Add a customer first'
      : data.prices.length === 0
        ? 'Create a plan and price first'
        : undefined;

  if (disabledReason) {
    return (
      <button disabled title={disabledReason} className={triggerClassName}>
        <Plus className={iconClassName} strokeWidth={2} />
        {label}
      </button>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        <Plus className={iconClassName} strokeWidth={2} />
        {label}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative z-10 flex w-full max-w-[420px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-foreground">Start a subscription</span>
              <button type="button" onClick={() => setOpen(false)} className="text-subtle-foreground hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <form action={formAction} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Customer</span>
                <select
                  name="customerId"
                  required
                  value={customerRef}
                  onChange={(e) => setCustomerRef(e.target.value)}
                  className={inputCls}
                >
                  {data.customers.map((c) => (
                    <option key={c.reference} value={c.reference}>
                      {c.name} · {c.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Price</span>
                <select name="priceId" required defaultValue={data.prices[0]?.reference} className={inputCls}>
                  {data.prices.map((p) => (
                    <option key={p.reference} value={p.reference}>{p.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Collection</span>
                <select name="collectionMethod" defaultValue="charge_automatically" className={inputCls}>
                  <option value="charge_automatically">Charge automatically</option>
                  <option value="send_invoice">Send invoice</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Payment method</span>
                <select name="paymentMethodId" defaultValue="" key={customerRef} className={inputCls}>
                  <option value="">None (invoice / trial)</option>
                  {methods.map((m) => (
                    <option key={m.reference} value={m.reference}>{m.label}</option>
                  ))}
                </select>
                {methods.length === 0 ? (
                  <span className="text-[11px] text-subtle-foreground">No methods on file for this customer — use a trial or send an invoice.</span>
                ) : null}
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Trial days (optional)</span>
                <input name="trialDays" type="number" min="0" placeholder="0" className={inputCls} />
              </label>
              {state.error ? <span className="text-[12px] text-danger">{state.error}</span> : null}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className={cancelCls}>Cancel</button>
                <button type="submit" disabled={pending} className={submitCls}>{pending ? 'Starting…' : 'Start subscription'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
