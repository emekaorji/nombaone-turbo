'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, X } from 'lucide-react';

import { updateSubscriptionMethodAction, type EngineActionState } from '@/lib/engine-actions';

const initial: EngineActionState = {};

/**
 * The recovery cockpit's primary "Update card" action — points the subscription at a working
 * method so the next dunning retry can succeed. Same bridge action as Actions → Change payment
 * method; surfaced inline where a merchant is actually triaging a failing subscription.
 */
export function RecoveryUpdateCardButton({
  subscriptionReference,
  methods,
  canManage,
}: {
  subscriptionReference: string;
  methods: { reference: string; label: string }[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateSubscriptionMethodAction.bind(null, subscriptionReference), initial);
  const router = useRouter();

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    const t = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(t);
  }, [state.ok, router]);

  const btnCls = 'flex items-center gap-[7px] rounded bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50';

  const disabledReason = !canManage
    ? 'Only owners can update the card'
    : methods.length === 0
      ? 'No method on file — attach one on the customer first'
      : undefined;

  if (disabledReason) {
    return (
      <button disabled title={disabledReason} className={btnCls}>
        <CreditCard className="size-4" strokeWidth={2} />
        Update card
      </button>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btnCls}>
        <CreditCard className="size-4" strokeWidth={2} />
        Update card
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative z-10 flex w-full max-w-[400px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-foreground">Update payment method</span>
              <button type="button" onClick={() => setOpen(false)} className="text-subtle-foreground hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <form action={formAction} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Charge this method on the next retry</span>
                <select name="paymentMethodId" required defaultValue={methods[0]?.reference} className="rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border">
                  {methods.map((m) => (
                    <option key={m.reference} value={m.reference}>{m.label}</option>
                  ))}
                </select>
              </label>
              <span className="text-[11px] text-subtle-foreground">The next scheduled retry uses this method. Nigerian card rails require the customer for a fresh authorization — we never blind-retry a held card.</span>
              {state.error ? <span className="text-[12px] text-danger">{state.error}</span> : null}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="rounded border border-border-strong bg-surface-2 px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-3">Cancel</button>
                <button type="submit" disabled={pending} className="rounded bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50">
                  {pending ? 'Saving…' : 'Update card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
