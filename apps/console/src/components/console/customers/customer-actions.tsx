'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, X } from 'lucide-react';

import { applyDiscountToCustomerAction, editCustomerAction, removeDiscountFromCustomerAction, type EngineActionState } from '@/lib/engine-actions';

const initial: EngineActionState = {};

export function CustomerActions({
  customerReference,
  name,
  phone,
  canManage,
}: {
  customerReference: string;
  name: string;
  phone: string | null;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [state, formAction, pending] = useActionState(editCustomerAction.bind(null, customerReference), initial);
  const [discountState, discountAction, discountPending] = useActionState(applyDiscountToCustomerAction.bind(null, customerReference), initial);
  const [removePending, startRemove] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  function removeDiscount() {
    setOpen(false);
    startRemove(async () => {
      await removeDiscountFromCustomerAction(customerReference);
      router.refresh();
    });
  }

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    const t = setTimeout(() => setEditOpen(false), 0);
    return () => clearTimeout(t);
  }, [state.ok, router]);

  useEffect(() => {
    if (!discountState.ok) return;
    router.refresh();
    const t = setTimeout(() => setDiscountOpen(false), 0);
    return () => clearTimeout(t);
  }, [discountState.ok, router]);

  const btnCls = 'flex items-center gap-[7px] rounded border border-border bg-surface-2 px-[13px] py-2 text-[13px] font-medium text-foreground transition-colors hover:border-border-strong disabled:opacity-50';

  if (!canManage) {
    return (
      <button disabled title="Only owners can edit customers" className={btnCls}>
        Actions
        <ChevronDown className="size-[15px] text-muted-foreground" strokeWidth={1.75} />
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className={btnCls}>
        Actions
        <ChevronDown className="size-[15px] text-muted-foreground" strokeWidth={1.75} />
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 flex w-[170px] flex-col overflow-hidden rounded-lg border border-border bg-surface-1 py-1 shadow-2xl">
          <button
            type="button"
            onClick={() => { setOpen(false); setEditOpen(true); }}
            className="px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-surface-2"
          >
            Edit details
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setDiscountOpen(true); }}
            className="px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-surface-2"
          >
            Apply discount
          </button>
          <button
            type="button"
            onClick={removeDiscount}
            disabled={removePending}
            className="px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            Remove discount
          </button>
        </div>
      ) : null}

      {discountOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={() => setDiscountOpen(false)} />
          <div className="relative z-10 flex w-full max-w-[400px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-foreground">Apply discount</span>
              <button type="button" onClick={() => setDiscountOpen(false)} className="text-subtle-foreground hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <form action={discountAction} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Coupon code or reference</span>
                <input name="coupon" required autoFocus placeholder="e.g. WELCOME20 or nbo…cpn" className="rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border" />
              </label>
              <span className="text-[11px] text-subtle-foreground">Applies to this customer&apos;s future invoices across their subscriptions.</span>
              {discountState.error ? <span className="text-[12px] text-danger">{discountState.error}</span> : null}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setDiscountOpen(false)} className="rounded border border-border-strong bg-surface-2 px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-3">
                  Cancel
                </button>
                <button type="submit" disabled={discountPending} className="rounded bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50">
                  {discountPending ? 'Applying…' : 'Apply discount'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={() => setEditOpen(false)} />
          <div className="relative z-10 flex w-full max-w-[400px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-foreground">Edit customer</span>
              <button type="button" onClick={() => setEditOpen(false)} className="text-subtle-foreground hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <form action={formAction} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Name</span>
                <input name="name" required defaultValue={name} className="rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Phone</span>
                <input name="phone" defaultValue={phone ?? ''} placeholder="Optional" className="rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border" />
              </label>
              <span className="text-[11px] text-subtle-foreground">Email is the customer&apos;s identity and can&apos;t be changed.</span>
              {state.error ? <span className="text-[12px] text-danger">{state.error}</span> : null}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setEditOpen(false)} className="rounded border border-border-strong bg-surface-2 px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-3">
                  Cancel
                </button>
                <button type="submit" disabled={pending} className="rounded bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50">
                  {pending ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
