'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, X } from 'lucide-react';

import { createPayoutAction, refundSettlementAction, type EngineActionState } from '@/lib/engine-actions';

const initial: EngineActionState = {};
const inputCls = 'rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border';
const cancelCls = 'rounded border border-border-strong bg-surface-2 px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-3';
const submitCls = 'rounded bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50';

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-[400px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold text-foreground">{title}</span>
          <button type="button" onClick={onClose} className="text-subtle-foreground hover:text-foreground">
            <X className="size-[18px]" strokeWidth={1.75} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function WithdrawButton({ availableShort, canManage }: { availableShort: string; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createPayoutAction, initial);
  const router = useRouter();
  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    const t = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(t);
  }, [state.ok, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!canManage}
        title={!canManage ? 'Only owners can withdraw' : undefined}
        className="flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        <Banknote className="size-4" strokeWidth={2} />
        Withdraw to bank
      </button>
      {open ? (
        <Overlay title="Withdraw to bank" onClose={() => setOpen(false)}>
          <form action={formAction} className="flex flex-col gap-3.5">
            <p className="text-[12px] text-muted-foreground">{availableShort} available after the 3-hour refund buffer.</p>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-muted-foreground">Amount (₦)</span>
              <input name="amount" type="number" min="1" step="0.01" required autoFocus placeholder="1000" className={inputCls} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-muted-foreground">Bank code</span>
              <input name="bankCode" required placeholder="000013" className={inputCls} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-muted-foreground">Account number</span>
              <input name="accountNumber" required placeholder="0123456789" className={inputCls} />
            </label>
            {state.error ? <span className="text-[12px] text-danger">{state.error}</span> : null}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className={cancelCls}>Cancel</button>
              <button type="submit" disabled={pending} className={submitCls}>{pending ? 'Starting…' : 'Withdraw'}</button>
            </div>
          </form>
        </Overlay>
      ) : null}
    </>
  );
}

export function RefundButton({ settlementReference, canManage }: { settlementReference: string; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(refundSettlementAction.bind(null, settlementReference), initial);
  const router = useRouter();
  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    const t = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(t);
  }, [state.ok, router]);

  if (!canManage) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-sm border border-border-strong bg-surface-2 px-2.5 py-1 text-[11.5px] font-medium text-foreground transition-colors hover:bg-surface-3"
      >
        Refund
      </button>
      {open ? (
        <Overlay title="Refund settlement" onClose={() => setOpen(false)}>
          <form action={formAction} className="flex flex-col gap-3.5">
            <p className="text-[12px] text-muted-foreground">Reverses the tenant share. Platform fees are earned and non-refundable.</p>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-muted-foreground">Amount (₦) — blank for full</span>
              <input name="amount" type="number" min="0" step="0.01" placeholder="Full refund" className={inputCls} />
            </label>
            {state.error ? <span className="text-[12px] text-danger">{state.error}</span> : null}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className={cancelCls}>Cancel</button>
              <button type="submit" disabled={pending} className={submitCls}>{pending ? 'Refunding…' : 'Issue refund'}</button>
            </div>
          </form>
        </Overlay>
      ) : null}
    </>
  );
}
