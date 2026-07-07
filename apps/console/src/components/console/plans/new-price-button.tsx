'use client';

import { Loader2, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

import { createPriceAction } from '@/lib/plans-actions';

const INTERVALS = [
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Annual' },
  { value: 'week', label: 'Weekly' },
  { value: 'day', label: 'Daily' },
];

export function NewPriceButton({ planRef }: { planRef: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const cleaned = amount.replace(/[₦,\s]/g, '');
  const kobo = /^\d+(\.\d{1,2})?$/.test(cleaned) ? Math.round(parseFloat(cleaned) * 100) : null;

  function close() {
    setOpen(false);
    setError(null);
    setAmount('');
    formRef.current?.reset();
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createPriceAction(fd);
      if (res.status === 'error') setError(res.message);
      else {
        close();
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded bg-accent px-3 py-[7px] text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
      >
        <Plus className="size-4" strokeWidth={2} />
        New price
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button aria-label="Close" onClick={close} className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 flex w-full max-w-[440px] flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-foreground">New price</h2>
              <button onClick={close} aria-label="Close" className="text-subtle-foreground hover:text-foreground">
                <X className="size-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-3.5">
              <input type="hidden" name="planRef" value={planRef} />
              <label className="flex flex-col gap-[7px]">
                <span className="text-[12.5px] font-medium text-foreground">Amount (₦)</span>
                <input
                  name="amount"
                  autoFocus
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="2,500.00"
                  className="rounded border border-border bg-surface-2 px-3 py-2.5 text-[13.5px] text-foreground outline-none focus:border-border-strong"
                />
                <span className="text-[11.5px] text-subtle-foreground">
                  {kobo !== null ? (
                    <>
                      Stored as <span className="font-mono text-foreground">{kobo.toLocaleString('en-US')} kobo</span>.
                      Prices are immutable.
                    </>
                  ) : (
                    'Enter the price in naira; it is stored as integer kobo.'
                  )}
                </span>
              </label>
              <label className="flex flex-col gap-[7px]">
                <span className="text-[12.5px] font-medium text-foreground">Billing interval</span>
                <select
                  name="interval"
                  defaultValue="month"
                  className="rounded border border-border bg-surface-2 px-3 py-2.5 text-[13.5px] text-foreground outline-none focus:border-border-strong"
                >
                  {INTERVALS.map((iv) => (
                    <option key={iv.value} value={iv.value}>
                      {iv.label}
                    </option>
                  ))}
                </select>
              </label>
              {error ? (
                <p className="rounded border border-danger/40 bg-danger-bg px-3 py-2 text-[12.5px] text-danger">
                  {error}
                </p>
              ) : null}
              <div className="mt-1 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={close}
                  className="rounded border border-border px-4 py-2.5 text-[13.5px] font-medium text-muted-foreground transition-colors hover:border-border-strong"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex items-center justify-center gap-2 rounded bg-accent px-4 py-2.5 text-[13.5px] font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-70"
                >
                  {pending ? <Loader2 className="size-4 animate-spin" strokeWidth={2.25} /> : null}
                  Create price
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
