'use client';

import { intervalLabel, PRICE_INTERVALS } from '@nombaone/core-contracts/billing';
import { Loader2, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

import { toKobo } from '@/lib/money';
import { createPriceAction } from '@/lib/plans-actions';

import type { PriceInterval } from '@nombaone/core-contracts/types';

/**
 * The escape hatch, and the REPAIR path.
 *
 * Editing a plan is how a merchant sets what it costs — this covers the two cases that form does
 * not: an arbitrary cadence it does not list (`month × 3` is quarterly, `minute × 1` is every
 * minute), and a legacy plan left with NO active price at all, which cannot be billed until one
 * exists. It is no longer offered as a general "add a price" step beside Edit.
 *
 * Built FROM the enum, never re-typed: the hand-written list this replaces had already drifted
 * (it predated `minute`), and a cadence list that lies is a mispriced subscription.
 */
const INTERVALS: { value: PriceInterval; label: string }[] = PRICE_INTERVALS.map((value) => ({
  value,
  label: value.charAt(0).toUpperCase() + value.slice(1),
}));

export function NewPriceButton({ planRef, label = 'Add price' }: { planRef: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [interval, setInterval] = useState<PriceInterval>('month');
  const [intervalCount, setIntervalCount] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // The SAME parser the server action uses, so the field cannot validate here and round differently there.
  const kobo = toKobo(amount);
  const count = /^\d+$/.test(intervalCount) ? parseInt(intervalCount, 10) : null;

  function close() {
    setOpen(false);
    setError(null);
    setAmount('');
    setInterval('month');
    setIntervalCount('1');
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
        {label}
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
              <div className="flex flex-col gap-[7px]">
                <span className="text-[12.5px] font-medium text-foreground">Billing interval</span>
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] text-subtle-foreground">Every</span>
                  <input
                    name="intervalCount"
                    inputMode="numeric"
                    aria-label="Interval count"
                    value={intervalCount}
                    onChange={(e) => setIntervalCount(e.target.value)}
                    className="w-16 rounded border border-border bg-surface-2 px-3 py-2.5 text-[13.5px] text-foreground outline-none focus:border-border-strong"
                  />
                  <select
                    name="interval"
                    aria-label="Interval unit"
                    value={interval}
                    onChange={(e) => setInterval(e.target.value as PriceInterval)}
                    className="flex-1 rounded border border-border bg-surface-2 px-3 py-2.5 text-[13.5px] text-foreground outline-none focus:border-border-strong"
                  >
                    {INTERVALS.map((iv) => (
                      <option key={iv.value} value={iv.value}>
                        {iv.label}
                        {count !== null && count !== 1 ? 's' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-[11.5px] text-subtle-foreground">
                  {count !== null && count >= 1 ? (
                    <>
                      Bills <span className="text-foreground">{intervalLabel(interval, count)}</span>.
                    </>
                  ) : (
                    'Bill every N intervals — N must be a whole number, 1 or more.'
                  )}
                </span>
              </div>
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
