'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';

import { attachTestMethodAction, createSubscriptionAction, type EngineActionState } from '@/lib/engine-actions';
import type { MethodOption, PriceOption } from '@/lib/subscription-form';

const initial: EngineActionState = {};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-[420px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-xl">
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

const inputCls = 'rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border';
const cancelCls = 'rounded border border-border-strong bg-surface-2 px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-3';
const submitCls = 'rounded bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50';

export function AttachTestMethodButton({ customerReference, canManage, isSandbox }: { customerReference: string; canManage: boolean; isSandbox: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(attachTestMethodAction.bind(null, customerReference), initial);
  const router = useRouter();

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    const t = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(t);
  }, [state.ok, router]);

  if (!canManage || !isSandbox) {
    return (
      <button disabled title={!isSandbox ? 'Switch to sandbox to attach a test method' : 'Only owners can attach methods'} className="text-[12px] text-accent disabled:opacity-50">
        Add
      </button>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-[12px] text-accent transition-opacity hover:opacity-80">
        Add
      </button>
      {open ? (
        <Modal title="Attach a test payment method" onClose={() => setOpen(false)}>
          <form action={formAction} className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-muted-foreground">Rail</span>
              <select name="kind" defaultValue="card" className={inputCls}>
                <option value="card">Card</option>
                <option value="mandate">Direct debit (mandate)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-muted-foreground">Charge outcome</span>
              <select name="behavior" defaultValue="success" className={inputCls}>
                <option value="success">Success</option>
                <option value="decline_insufficient_funds">Decline — insufficient funds</option>
                <option value="decline_expired_card">Decline — expired card</option>
                <option value="decline_do_not_honor">Decline — do not honor</option>
                <option value="requires_otp">Requires OTP</option>
              </select>
            </label>
            {state.error ? <span className="text-[12px] text-danger">{state.error}</span> : null}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className={cancelCls}>Cancel</button>
              <button type="submit" disabled={pending} className={submitCls}>{pending ? 'Attaching…' : 'Attach method'}</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </>
  );
}

export function NewSubscriptionButton({
  customerReference,
  canManage,
  prices,
  methods,
}: {
  customerReference: string;
  canManage: boolean;
  prices: PriceOption[];
  methods: MethodOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createSubscriptionAction.bind(null, customerReference), initial);
  const router = useRouter();

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    const t = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(t);
  }, [state.ok, router]);

  const disabledReason = !canManage ? 'Only owners can start subscriptions' : prices.length === 0 ? 'Create a plan and price first' : undefined;

  if (disabledReason) {
    return (
      <button
        disabled
        title={disabledReason}
        className="flex items-center gap-[7px] rounded bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-foreground disabled:opacity-50"
      >
        <Plus className="size-4" strokeWidth={2} />
        New subscription
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-[7px] rounded bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
      >
        <Plus className="size-4" strokeWidth={2} />
        New subscription
      </button>
      {open ? (
        <Modal title="Start a subscription" onClose={() => setOpen(false)}>
          <form action={formAction} className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium text-muted-foreground">Price</span>
              <select name="priceId" required defaultValue={prices[0]?.reference} className={inputCls}>
                {prices.map((p) => (
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
              <select name="paymentMethodId" defaultValue={methods[0]?.reference ?? ''} className={inputCls}>
                <option value="">None (invoice / trial)</option>
                {methods.map((m) => (
                  <option key={m.reference} value={m.reference}>{m.label}</option>
                ))}
              </select>
              {methods.length === 0 ? (
                <span className="text-[11px] text-subtle-foreground">No methods on file — attach a test method, use a trial, or send an invoice.</span>
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
        </Modal>
      ) : null}
    </>
  );
}
