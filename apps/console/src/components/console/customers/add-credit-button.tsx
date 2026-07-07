'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

import { grantCreditAction, type GrantCreditState } from '@/lib/credit-actions';

const initial: GrantCreditState = {};

export function AddCreditButton({ customerReference, canManage }: { customerReference: string; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const action = grantCreditAction.bind(null, customerReference);
  const [state, formAction, pending] = useActionState(action, initial);
  const router = useRouter();

  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    const t = setTimeout(() => setOpen(false), 0);
    return () => clearTimeout(t);
  }, [state.ok, router]);

  if (!canManage) {
    return (
      <button disabled title="Only owners can grant credit" className="text-[12px] text-accent disabled:opacity-50">
        Add credit
      </button>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-[12px] text-accent transition-opacity hover:opacity-80">
        Add credit
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative z-10 flex w-full max-w-[400px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-foreground">Grant account credit</span>
              <button type="button" onClick={() => setOpen(false)} className="text-subtle-foreground hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <form action={formAction} className="flex flex-col gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Amount (₦)</span>
                <input
                  name="amount"
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="500"
                  className="rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Source</span>
                <select
                  name="source"
                  defaultValue="goodwill"
                  className="rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border"
                >
                  <option value="goodwill">Goodwill</option>
                  <option value="manual">Manual</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Note (optional)</span>
                <input
                  name="note"
                  placeholder="Reason for the credit"
                  className="rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent-border"
                />
              </label>
              {state.error ? <span className="text-[12px] text-danger">{state.error}</span> : null}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded border border-border-strong bg-surface-2 px-3.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-surface-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  {pending ? 'Granting…' : 'Grant credit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
