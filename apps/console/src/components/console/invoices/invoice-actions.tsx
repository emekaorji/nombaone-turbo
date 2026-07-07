'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, X } from 'lucide-react';

import { voidInvoiceAction, type EngineActionState } from '@/lib/engine-actions';

const initial: EngineActionState = {};
const btnCls = 'flex items-center gap-[7px] rounded border border-border bg-surface-2 px-[13px] py-2 text-[13px] font-medium text-foreground transition-colors hover:border-border-strong disabled:opacity-50';

export function InvoiceActions({ invoiceReference, status, canManage }: { invoiceReference: string; status: string; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [state, formAction, pending] = useActionState(voidInvoiceAction.bind(null, invoiceReference), initial);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

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
    const t = setTimeout(() => setVoidOpen(false), 0);
    return () => clearTimeout(t);
  }, [state.ok, router]);

  // Only draft/open invoices can be voided; paid/void/uncollectible cannot.
  const canVoid = status === 'open' || status === 'partially_paid';

  if (!canManage || !canVoid) {
    return (
      <button disabled title={!canManage ? 'Only owners can void invoices' : 'Only open invoices can be voided'} className={btnCls}>
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
          <button type="button" onClick={() => { setOpen(false); setVoidOpen(true); }} className="px-3 py-2 text-left text-[13px] text-danger transition-colors hover:bg-surface-2">
            Void invoice
          </button>
        </div>
      ) : null}

      {voidOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={() => setVoidOpen(false)} />
          <div className="relative z-10 flex w-full max-w-[400px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-foreground">Void invoice</span>
              <button type="button" onClick={() => setVoidOpen(false)} className="text-subtle-foreground hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <form action={formAction} className="flex flex-col gap-3.5">
              <p className="text-[12px] text-muted-foreground">Voiding cancels an unpaid invoice for good. It cannot be un-voided; a correction is a new invoice.</p>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Reason (optional)</span>
                <input name="comment" placeholder="Why void this invoice?" className="rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border" />
              </label>
              {state.error ? <span className="text-[12px] text-danger">{state.error}</span> : null}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setVoidOpen(false)} className="rounded border border-border-strong bg-surface-2 px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-3">Keep it</button>
                <button type="submit" disabled={pending} className="rounded bg-danger px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50">
                  {pending ? 'Voiding…' : 'Void invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
